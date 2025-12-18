const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron', 'main.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// ============================================
// Fix 1: Mac TUN Mode - Replace the darwin relaunch section
// ============================================
const oldMacTunMode = `        } else if (process.platform === 'darwin') {
            // macOS: Use osascript to requries admin privileges
            const cmd = \`"\${exe}" --tun-mode\`;
            console.log('Relaunching Mac:', cmd);

            // 🟢 CRITICAL FIX:
            // 1. Release lock so new instance can start
            app.releaseSingleInstanceLock();

            // 2. Run in background so osascript returns immediately
            // We use 'nohup' and '&' to detach the process
            const script = \`do shell script \\\\\\"nohup \${cmd.replace(/"/g, '\\\\\\\\\\"')} > /dev/null 2>&1 &\\\\\\" with administrator privileges\`;

            const { exec } = require('child_process');
            exec(\`osascript -e "\${script}"\`, (error: any, stdout: any, stderr: any) => {
                // Even if error, we should probably quit or show error.
                // But since it's backgrounded, we might not get immediate error if auth fails?
                // osascript throws if auth is cancelled.
                if (error) {
                    console.error('Mac Relaunch Error:', error);
                    // Relaquire lock if failed? simplifying: just show error dialog or quit.
                    // If user cancelled, we shouldn't quit.
                    // Since we released lock, we are vulnerable to other instances, but rare.
                    resolve({ success: false, error: 'User cancelled or failed' });
                } else {
                    isQuitting = true;
                    app.exit(0);
                    resolve({ success: true });
                }
            });
        }`;

const newMacTunMode = `        } else if (process.platform === 'darwin') {
            // macOS: Use osascript to request admin privileges
            const exe = app.getPath('exe');

            // Create a launcher script that will be run with admin privileges
            const launcherScript = path.join(app.getPath('userData'), 'tun_launcher.sh');
            const launcherContent = \`#!/bin/bash
"\${exe}" --tun-mode > /dev/null 2>&1 &
disown
exit 0
\`;
            fs.writeFileSync(launcherScript, launcherContent, { mode: 0o755 });

            // Now run this script with admin privileges
            const escapedLauncher = launcherScript.replace(/"/g, '\\\\"');
            const script = \`do shell script "\\\\"\${escapedLauncher}\\\\"" with administrator privileges\`;

            // Release lock so new instance can start
            app.releaseSingleInstanceLock();

            // Force quit mechanism: Set a timeout to quit regardless of osascript result
            setTimeout(() => {
                isQuitting = true;
                setSystemProxySync(false);
                app.exit(0);
            }, 3000);

            const { exec } = require('child_process');
            exec(\`osascript -e '\${script}'\`, (error: any) => {
                if (error) {
                    // Re-acquire lock since we failed or user cancelled
                    app.requestSingleInstanceLock();
                    resolve({ success: false, error: 'User cancelled or failed' });
                } else {
                    isQuitting = true;
                    setSystemProxySync(false);
                    app.exit(0);
                    resolve({ success: true });
                }
            });
        }`;

// ============================================
// Fix 2: Mac Auto Start - Replace get-auto-start and set-auto-start handlers
// ============================================
const oldAutoStart = `        // 🟢 开机自启控制
        ipcMain.handle('get-auto-start', () => {
            return app.getLoginItemSettings().openAtLogin;
        });

        ipcMain.handle('set-auto-start', (_event, enable: boolean) => {
            if (process.platform === 'darwin') {
                // Correctly resolve the .app path from the binary path
                // Binary: /Applications/EdNovasCloud.app/Contents/MacOS/EdNovasCloud
                // Bundle: /Applications/EdNovasCloud.app
                const appBundlePath = path.resolve(process.execPath, '../../..');

                console.log('Setting AutoStart Mac:', appBundlePath);

                app.setLoginItemSettings({
                    openAtLogin: enable,
                    path: appBundlePath
                });
            } else {
                app.setLoginItemSettings({
                    openAtLogin: enable,
                    path: process.execPath, // 明确指定可执行文件路径
                    args: []
                });
            }
            return { success: true };
        });`;

const newAutoStart = `        // 🟢 开机自启控制
        ipcMain.handle('get-auto-start', () => {
            if (process.platform === 'darwin') {
                // Check for LaunchAgent plist file
                const homeDir = require('os').homedir();
                const plistPath = path.join(homeDir, 'Library', 'LaunchAgents', 'com.ednovas.cloud.plist');
                return fs.existsSync(plistPath);
            } else {
                return app.getLoginItemSettings().openAtLogin;
            }
        });

        ipcMain.handle('set-auto-start', (_event, enable: boolean) => {
            if (process.platform === 'darwin') {
                try {
                    const appBundlePath = path.resolve(process.execPath, '../../..');
                    // For unsigned apps, use LaunchAgent plist file
                    const homeDir = require('os').homedir();
                    const launchAgentsDir = path.join(homeDir, 'Library', 'LaunchAgents');
                    const plistPath = path.join(launchAgentsDir, 'com.ednovas.cloud.plist');

                    if (enable) {
                        // Create LaunchAgents directory if it doesn't exist
                        if (!fs.existsSync(launchAgentsDir)) {
                            fs.mkdirSync(launchAgentsDir, { recursive: true });
                        }

                        // Create plist content
                        const binaryPath = path.join(appBundlePath, 'Contents', 'MacOS', 'EdNovasCloud');
                        const plistContent = \`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ednovas.cloud</string>
    <key>ProgramArguments</key>
    <array>
        <string>\${binaryPath}</string>
        <string>--hidden</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>\`;
                        fs.writeFileSync(plistPath, plistContent, 'utf-8');

                        // Register with launchctl
                        try {
                            const { execSync } = require('child_process');
                            const uid = process.getuid ? process.getuid() : 0;
                            try { execSync(\`launchctl bootout gui/\${uid} "\${plistPath}"\`, { stdio: 'ignore' }); } catch { }
                            execSync(\`launchctl bootstrap gui/\${uid} "\${plistPath}"\`);
                        } catch (e: any) {
                            console.error('launchctl error:', e);
                        }
                    } else {
                        // Remove the plist file
                        if (fs.existsSync(plistPath)) {
                            try {
                                const { execSync } = require('child_process');
                                const uid = process.getuid ? process.getuid() : 0;
                                execSync(\`launchctl bootout gui/\${uid} "\${plistPath}"\`, { stdio: 'ignore' });
                            } catch { }

                            fs.unlinkSync(plistPath);
                        }
                    }
                    return { success: true };
                } catch (err: any) {
                    return { success: false, error: err.message };
                }
            } else {
                app.setLoginItemSettings({
                    openAtLogin: enable,
                    path: process.execPath,
                    args: []
                });
            }
            return { success: true };
        });`;

// Normalize line endings for matching
const normalizeLE = (str) => str.replace(/\r\n/g, '\n');

let normalizedContent = normalizeLE(content);
const normalizedOldTun = normalizeLE(oldMacTunMode);
const normalizedNewTun = normalizeLE(newMacTunMode);
const normalizedOldAuto = normalizeLE(oldAutoStart);
const normalizedNewAuto = normalizeLE(newAutoStart);

// Apply fixes
let tunReplaced = false;
let autoReplaced = false;

if (normalizedContent.includes(normalizedOldTun)) {
    normalizedContent = normalizedContent.replace(normalizedOldTun, normalizedNewTun);
    tunReplaced = true;
    console.log('✅ Mac TUN mode fix applied successfully!');
} else {
    console.log('⚠️  Mac TUN mode pattern not found - may already be applied or code has changed.');
}

if (normalizedContent.includes(normalizedOldAuto)) {
    normalizedContent = normalizedContent.replace(normalizedOldAuto, normalizedNewAuto);
    autoReplaced = true;
    console.log('✅ Mac Auto Start fix applied successfully!');
} else {
    console.log('⚠️  Mac Auto Start pattern not found - may already be applied or code has changed.');
}

// Restore CRLF if original had it
if (content.includes('\r\n')) {
    normalizedContent = normalizedContent.replace(/\n/g, '\r\n');
}

fs.writeFileSync(filePath, normalizedContent, 'utf-8');

console.log('\n📄 File saved: electron/main.ts');
console.log(`   TUN Mode Fix: ${tunReplaced ? 'Applied' : 'Skipped'}`);
console.log(`   Auto Start Fix: ${autoReplaced ? 'Applied' : 'Skipped'}`);
