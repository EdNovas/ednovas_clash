// electron/main.ts
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { spawn, ChildProcess, execSync } from 'child_process'
import fs from 'fs'

// 🟢 极早期的启动日志，用于调试"起不来"的问题
try {
    const logFile = path.join(app.getPath('userData'), 'boot_trace.log');
    fs.appendFileSync(logFile, `${new Date().toISOString()} - App Starting... Exec: ${process.execPath}\n`);
} catch (e) { }

// 🟢 错误日志记录
const logError = (error: any) => {
    try {
        // 尝试将日志保存在安装目录 (exe 所在目录)
        // 注意：如果安装在 C:\Program Files 且没有管理员权限，这里可能会写入失败。
        // 但为了满足"保存在安装目录"，我们优先尝试这里。
        const installDir = path.dirname(app.getPath('exe'));
        const logPath = path.join(installDir, 'crash-error.log');

        const message = error.stack || error.toString();
        fs.appendFileSync(logPath, `${new Date().toISOString()} - ${message}\r\n`);
    } catch (e) {
        // 如果写入安装目录失败 (例如权限不足)，回退到 UserData
        try {
            const userDataPath = app.getPath('userData');
            if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });
            const fallbackLogPath = path.join(userDataPath, 'crash-error-fallback.log');
            const message = error.stack || error.toString();
            fs.appendFileSync(fallbackLogPath, `${new Date().toISOString()} - [Fallback] ${message}\r\n`);
        } catch (ignored) { }
    }
}

process.on('uncaughtException', (error) => {
    logError(error);
    // Optional: Show error dialog before exit
    // dialog.showErrorBox('Application Error', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    logError(reason);
});

let mainWindow: BrowserWindow | null = null
let clashProcess: ChildProcess | null = null
let tray: Tray | null = null
let isQuitting = false

// ... (getClashBinaryPath 函数保持不变) ...
const getClashBinaryPath = () => {
    const exeName = process.platform === 'win32' ? 'EdNovas-Core.exe' : 'EdNovas-Core';
    const candidates = [
        path.join(process.cwd(), 'resources', 'bin', exeName),
        path.join(app.getAppPath(), 'resources', 'bin', exeName),
        path.join(process.resourcesPath, 'resources', 'bin', exeName),
        path.join(__dirname, '../../resources/bin', exeName),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    throw new Error(`Kernel not found: ${exeName}`);
}

// 🟢 获取资源文件路径 (通用)
const getAssetPath = (filename: string) => {
    const candidates = [
        path.join(process.cwd(), 'resources', filename), // 开发环境
        path.join(app.getAppPath(), 'resources', filename),
        path.join(process.resourcesPath, 'resources', filename), // 生产环境
        path.join(__dirname, '../../resources', filename),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

// 🟢 初始化 GEO 文件 (如果 UserData 没有，就从资源目录复制)
const initGeoFiles = (userDataPath: string) => {
    // 🟢 移除了 Country.mmdb，因为内核使用 geoip.metadb
    const files = ['geoip.metadb', 'geosite.dat'];
    files.forEach(file => {
        const destPath = path.join(userDataPath, file);
        if (!fs.existsSync(destPath)) {
            const sourcePath = getAssetPath(file);
            if (sourcePath) {
                console.log(`Copying ${file} to ${userDataPath}`);
                fs.copyFileSync(sourcePath, destPath);
            }
        }
    });
}

// 🟢 同步设置系统代理 (保证退出时能立即执行)
const setSystemProxySync = (enable: boolean) => {
    if (process.platform === 'win32') {
        try {
            if (enable) {
                execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 1 /f`);
                execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer /t REG_SZ /d "127.0.0.1:7890" /f`);
            } else {
                execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f`);
            }
        } catch (e) {
            console.error('Windows Proxy Set Error:', e);
        }
    } else if (process.platform === 'darwin') {
        try {
            const services = ['Wi-Fi', 'Ethernet', 'Thunderbolt Ethernet', 'USB 10/100/1000 LAN'];
            services.forEach(service => {
                try {
                    if (enable) {
                        execSync(`networksetup -setwebproxy "${service}" 127.0.0.1 7890`);
                        execSync(`networksetup -setsecurewebproxy "${service}" 127.0.0.1 7890`);
                        execSync(`networksetup -setsocksfirewallproxy "${service}" 127.0.0.1 7890`);
                    } else {
                        execSync(`networksetup -setwebproxystate "${service}" off`);
                        execSync(`networksetup -setsecurewebproxystate "${service}" off`);
                        execSync(`networksetup -setsocksfirewallproxystate "${service}" off`);
                    }
                } catch (e) {
                    // Ignore errors for services that don't exist
                }
            });
        } catch (e) {
            console.error('Mac Proxy Set Error:', e);
        }
    } else if (process.platform === 'linux') {
        try {
            // 简单适配 GNOME 环境
            // 1. GNOME Settings (Keep existing)
            if (enable) {
                try { execSync('gsettings set org.gnome.system.proxy mode "manual"'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.http host "127.0.0.1"'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.http port 7890'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.https host "127.0.0.1"'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.https port 7890'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.socks host "127.0.0.1"'); } catch (e) { }
                try { execSync('gsettings set org.gnome.system.proxy.socks port 7890'); } catch (e) { }
            } else {
                try { execSync('gsettings set org.gnome.system.proxy mode "none"'); } catch (e) { }
            }
        } catch (e) {
            console.error('Linux Proxy Set Error:', e);
        }
    }
}

const startClash = async (configPath: string) => {
    // 1. Kill existing child process reference
    if (clashProcess) {
        try { clashProcess.kill(); clashProcess = null; } catch (e) { }
    }

    // 2. 🟢 Force kill any external ghost processes to free port 9090
    // Try multiple methods to ensure it's dead
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /f /im EdNovas-Core.exe', { stdio: 'ignore' });
        } else {
            // Linux/Mac: Try pkill, killall, and fuser on the port
            try { execSync('pkill -9 -f EdNovas-Core', { stdio: 'ignore' }); } catch { }
            try { execSync('killall -9 EdNovas-Core', { stdio: 'ignore' }); } catch { }
            // Try to kill whatever is holding port 9090
            try { execSync('fuser -k 9090/tcp', { stdio: 'ignore' }); } catch { }
        }
    } catch (e) { }

    try {
        const binaryPath = getClashBinaryPath();

        // 3. Ensure binary permission
        if (process.platform !== 'win32') {
            try { fs.chmodSync(binaryPath, 0o755); } catch (e) { console.error('Chmod error:', e); }
        }

        const configDir = path.dirname(configPath);

        // 4. 🟢 Wait for port release (Increased delay)
        await new Promise(r => setTimeout(r, 2000));

        // 5. Spawn new process
        clashProcess = spawn(binaryPath, ['-d', configDir, '-f', configPath]);

        clashProcess.stdout?.on('data', (data) => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clash-log', data.toString());
        });
        clashProcess.stderr?.on('data', (data) => {
            const msg = data.toString();
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('clash-log', `❌ ${msg}`);
            // Check for port error specifically
            if (msg.includes('bind: address already in use')) {
                console.error('Port still in use!');
            }
        });
    } catch (err: any) {
        if (mainWindow) mainWindow.webContents.send('clash-log', `❌ 启动失败: ${err.message}`);
    }
}

// 🟢 创建系统托盘
const createTray = () => {
    const iconPath = path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/icon.png' : '../dist/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip('EdNovas Cloud');

    const updateMenu = (sysProxyEnabled: boolean, mode: string) => {
        const contextMenu = Menu.buildFromTemplate([
            { label: '打开面板', click: () => mainWindow?.show() },
            { type: 'separator' },
            {
                label: '系统代理',
                type: 'checkbox',
                checked: sysProxyEnabled,
                click: () => mainWindow?.webContents.send('tray-toggle-proxy')
            },
            {
                label: '代理模式',
                submenu: [
                    { label: '规则模式 (Rule)', type: 'radio', checked: mode === 'Rule', click: () => mainWindow?.webContents.send('tray-change-mode', 'Rule') },
                    { label: '全局模式 (Global)', type: 'radio', checked: mode === 'Global', click: () => mainWindow?.webContents.send('tray-change-mode', 'Global') },
                    { label: '直连模式 (Direct)', type: 'radio', checked: mode === 'Direct', click: () => mainWindow?.webContents.send('tray-change-mode', 'Direct') }
                ]
            },
            { type: 'separator' },
            { label: '彻底退出', click: () => { isQuitting = true; app.quit(); } }
        ]);
        tray?.setContextMenu(contextMenu);
    };

    // 初始菜单
    updateMenu(false, 'Rule');

    // 监听单击打开
    tray.on('click', () => mainWindow?.show());

    // 监听渲染进程状态更新，同步托盘菜单
    ipcMain.on('sync-tray-state', (_event, { sysProxy, mode }) => {
        updateMenu(sysProxy, mode);
    });
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1100, height: 750,
        minWidth: 900, minHeight: 600,
        center: true,
        title: 'EdNovas Cloud',
        icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/ezv9d7ezv9d7ezv9.jpg' : '../dist/ezv9d7ezv9d7ezv9.jpg'),
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#1a1b1e',
            symbolColor: '#ffffff',
            height: 45
        },
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
    })
    mainWindow.setMenu(null);
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }

    // 🟢 拦截关闭事件，最小化到托盘
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
            return false;
        }
    });
}

// Add relaunch-as-admin handler
ipcMain.handle('relaunch-as-admin', () => {
    const exe = app.getPath('exe');
    // 使用 Start-Process 并传递参数，确保路径被正确引用
    const cmd = `Start-Process -FilePath "${exe}" -Verb RunAs`;
    console.log('Relaunching:', cmd);

    // Log relaunch
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'boot_trace.log'), `${new Date().toISOString()} - [Relaunch] Relaunching as admin: ${cmd}\n`); } catch (e) { }

    spawn('powershell.exe', ['-Command', cmd], { detached: true, stdio: 'ignore' });
    isQuitting = true;
    app.exit(0); // 🟢 强制立即退出，防止锁释放慢
});

// Add check-is-admin handler
ipcMain.handle('check-is-admin', () => {
    try {
        execSync('net session', { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
});

// 🟢 单实例锁 (防止开启多个窗口)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'boot_trace.log'), `${new Date().toISOString()} - [Startup] Duplicate instance detected. Quitting.\n`); } catch (e) { }
    app.quit();
} else {
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'boot_trace.log'), `${new Date().toISOString()} - [Startup] Instance lock acquired. Starting main window.\n`); } catch (e) { }

    app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
        try { fs.appendFileSync(path.join(app.getPath('userData'), 'boot_trace.log'), `${new Date().toISOString()} - [Event] Second instance triggered. Focusing main window.\n`); } catch (e) { }
        // 当运行第二个实例时，聚焦到主窗口
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            // 如果窗口隐藏 (托盘模式)，则显示
            if (!mainWindow.isVisible()) mainWindow.show();
            mainWindow.focus();
        }
    });

    app.whenReady().then(() => {
        createWindow();
        createTray();

        ipcMain.handle('start-clash-service', async (event, configContent) => {
            try {
                const userDataPath = app.getPath('userData');
                if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true });

                // 🟢 检查并复制 GEO 数据库
                initGeoFiles(userDataPath);

                const configPath = path.join(userDataPath, 'config.yaml');
                fs.writeFileSync(configPath, configContent, 'utf-8');
                startClash(configPath);
                return { success: true, msg: 'Clash 已启动' }
            } catch (error: any) {
                return { success: false, msg: error.message }
            }
        })

        ipcMain.handle('set-system-proxy', (_event, enable: boolean) => {
            setSystemProxySync(enable);
            return { success: true };
        });

        ipcMain.on('open-external', (_event, url: string) => {
            const { shell } = require('electron');
            shell.openExternal(url);
        });

        // 🟢 开机自启控制
        ipcMain.handle('get-auto-start', () => {
            return app.getLoginItemSettings().openAtLogin;
        });

        ipcMain.handle('set-auto-start', (_event, enable: boolean) => {
            app.setLoginItemSettings({
                openAtLogin: enable,
                path: process.execPath, // 明确指定可执行文件路径
                args: []
            });
            return { success: true };
        });

        // 🟢 获取应用版本号
        ipcMain.handle('get-app-version', () => {
            return app.getVersion();
        });
    })
}

app.on('before-quit', () => {
    setSystemProxySync(false);
    if (clashProcess) clashProcess.kill();
})