# EdNovas Cloud (EdNovas云)

![Sample](https://raw.githubusercontent.com/EdNovas/ednovas_clash/refs/heads/main/photo_2025-12-09_13-55-24.jpg)

一个基于 Electron + React + Mihomo (Clash Meta) 内核的现代化跨平台代理客户端。

## ✨ 支持平台

| 平台 | 架构 | 格式 | 备注 |
| :--- | :--- | :--- | :--- |
| **Windows** | x64 | `.exe` | Win 10/11 推荐 |
| **macOS** | Intel / Apple Silicon | `.dmg` | 通用支持 |
| **Linux** | x64 / ARM64 | `.deb` / `.AppImage` | 完美适配 Ubuntu 22/24 |

## ⭐ 功能特点

- **🚀 极速内核**: 内置高性能 [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta) 内核，支持最新协议。
- **🎨 现代化 UI**: 精心设计的深色主题，支持实时流量/速度监控。
- **🌍 跨平台**: 一套代码，同时支持 Windows, macOS 和 Linux (包括 ARM 设备)。
- **🔌 TUN 模式**: 支持虚拟网卡模式，接管系统所有流量（Linux 需 root 权限）。
- **🐧 Linux 优化**: 针对 Linux 桌面环境进行了特别适配（图标、系统代理、自动启动）。
- **📥 自动更新**: 配合 GitHub Actions 实现全自动构建发布。

## 📦 下载安装

请前往 [Releases](../../releases) 页面下载最新版本。

### 🪟 Windows
直接下载 `.exe` 安装程序运行即可。

### 🍎 macOS
下载 `.dmg` 文件，将 `EdNovas Cloud` 拖入 `Applications` 文件夹。
> 如提示“文件已损坏”或“无法验证开发者”，请在终端运行：
> `sudo xattr -rd com.apple.quarantine /Applications/EdNovas\ Cloud.app`

### 🐧 Linux (Ubuntu/Debian)

**推荐使用 DEB 包安装**：

```bash
# 安装下载的 deb 包
sudo apt install ./EdNovas-Cloud-*-Linux-amd64.deb

# 如果安装后图标未显示，请尝试注销并重新登录
```

**或者使用 AppImage (免安装)**：
```bash
chmod +x EdNovas-Cloud-*-Linux-x64.AppImage
./EdNovas-Cloud-*-Linux-x64.AppImage
```

#### 关于 Linux 的 TUN 模式
在 Linux 上启用 TUN 模式需要 **root 权限**。如果您必须使用 TUN 模式，请通过终端启动：
```bash
sudo ednovas-cloud --no-sandbox
```
*如果不使用 TUN 模式，普通系统代理只需直接在应用菜单启动即可。*

## 🔨 本地开发

如果您想自己编译或修改代码：

```bash
# 1. 克隆仓库
git clone https://github.com/YourUsername/YourRepo.git
cd my-airport-client

# 2. 安装依赖
npm install

# 3. 准备内核文件
# 请根据您的系统下载对应的 mihomo 内核，重命名并放入 resources/bin/ 目录：
# - Windows: resources/bin/EdNovas-Core.exe
# - macOS/Linux: resources/bin/EdNovas-Core (记得 chmod +x)

# 4. 启动开发模式
npm run electron:dev

# 5. 打包构建
npm run electron:build
```

## 📜 许可证

MIT License
