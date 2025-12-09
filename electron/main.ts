// electron/main.ts
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { spawn, ChildProcess, execSync } from 'child_process'
import fs from 'fs'

let mainWindow: BrowserWindow | null = null
let clashProcess: ChildProcess | null = null

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
            if (enable) {
                execSync('gsettings set org.gnome.system.proxy mode "manual"');
                execSync('gsettings set org.gnome.system.proxy.http host "127.0.0.1"');
                execSync('gsettings set org.gnome.system.proxy.http port 7890');
                execSync('gsettings set org.gnome.system.proxy.https host "127.0.0.1"');
                execSync('gsettings set org.gnome.system.proxy.https port 7890');
                execSync('gsettings set org.gnome.system.proxy.socks host "127.0.0.1"');
                execSync('gsettings set org.gnome.system.proxy.socks port 7890');
            } else {
                execSync('gsettings set org.gnome.system.proxy mode "none"');
            }
        } catch (e) {
            console.error('Linux Proxy Set Error:', e);
        }
    }
}

const startClash = async (configPath: string) => {
    if (clashProcess) {
        try { clashProcess.kill() } catch (e) { }
    }
    // 🟢 启动前先尝试清理旧进程 (防止端口占用)
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /f /im EdNovas-Core.exe', { stdio: 'ignore' });
        } else {
            execSync('pkill -f EdNovas-Core', { stdio: 'ignore' });
        }
    } catch (e) { }

    try {
        const binaryPath = getClashBinaryPath();

        // 🟢 Ensure binary is executable on macOS/Linux
        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(binaryPath, 0o755);
            } catch (e) {
                console.error('Failed to chmod binary:', e);
            }
        }

        const configDir = path.dirname(configPath);

        // 增加 1秒 延迟确保端口释放
        await new Promise(r => setTimeout(r, 1000));

        clashProcess = spawn(binaryPath, ['-d', configDir, '-f', configPath]);

        clashProcess.stdout?.on('data', (data) => {
            if (mainWindow) mainWindow.webContents.send('clash-log', data.toString());
        });
        clashProcess.stderr?.on('data', (data) => {
            if (mainWindow) mainWindow.webContents.send('clash-log', `❌ ${data.toString()}`);
        });
    } catch (err: any) {
        if (mainWindow) mainWindow.webContents.send('clash-log', `❌ 启动失败: ${err.message}`);
    }
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1100, height: 750,
        minWidth: 900, minHeight: 600,
        center: true,
        title: 'EdNovas云', // 🟢 设置标题
        icon: path.join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/ezv9d7ezv9d7ezv9.jpg' : '../dist/ezv9d7ezv9d7ezv9.jpg'), // 🟢 设置图标
        titleBarStyle: 'hidden', // 🟢 隐藏原生标题栏背景
        titleBarOverlay: {
            color: '#1a1b1e', // 🟢 设置背景色与应用头部一致，实现"透明"效果
            symbolColor: '#ffffff', // 🟢 设置控制按钮图标颜色
            height: 45 // 🟢 高度
        },
        webPreferences: { nodeIntegration: true, contextIsolation: false, webSecurity: false },
    })
    mainWindow.setMenu(null); // 🟢 隐藏菜单栏
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
    }
}

app.whenReady().then(() => {
    createWindow()

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
})

// 🟢 退出时强制清理 (防断网)
app.on('before-quit', () => {
    setSystemProxySync(false);
    if (clashProcess) clashProcess.kill();
})