# EdNovas Cloud (EdNovas云)

![Sample](https://raw.githubusercontent.com/EdNovas/ednovas_clash/refs/heads/main/photo_2025-12-09_13-55-24.jpg)

一个基于 Electron + React + Mihomo (Clash Meta) 内核的现代化跨平台代理客户端。

## ✨ 支持平台

| 平台 | 架构 | 格式 | 备注 |
| :--- | :--- | :--- | :--- |
| **Windows** | x64 | `.exe` | Win 10/11 推荐 |
| **macOS** | Intel / Apple Silicon | `.dmg` | 通用支持 |
| **Linux** | x64 / ARM64 | `.deb` | 完美适配 Ubuntu 22/24 |

## ⭐ 功能特点

- **🚀 极速内核**: 内置高性能 [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta) 内核，支持最新协议。
- **🎨 现代化 UI**: 精心设计的深色主题，支持实时流量/速度监控。
- **🌍 跨平台**: 一套代码，同时支持 Windows, macOS 和 Linux (包括 ARM 设备)。
- **🔌 TUN 模式**: 支持虚拟网卡模式，接管系统所有流量（Linux 支持自动提权重启）。
- **🐧 Linux 优化**: 针对 Linux 桌面环境进行了特别适配（图标、系统代理、自动启动）。
- **🇺🇸 完美显示**: 内置 Twemoji 支持，完美渲染节点名称中的国旗图标，拒绝显示为字母。
- **🛡️ 智能避让**: 采用 22222 端口及动态 API 端口，完美解决与其他代理软件的冲突。
- **📥 自动更新**: 配合 GitHub Actions 实现全自动构建发布。

## 📦 下载安装

请前往 [Releases](../../releases) 页面下载最新版本。

### 🪟 Windows
直接下载 `.exe` 安装程序运行即可。

### 🍎 macOS
下载 `.dmg` 文件，将 `EdNovas Cloud` 拖入 `Applications` 文件夹。
> **⚠️ 首次运行如果提示"文件已损坏"或"无法打开" / "cannot be verified"：**
> 
> **方法一（推荐）: 终端命令**
> ```bash
> sudo xattr -cr /Applications/EdNovasCloud.app
> ```
> 运行后即可正常打开应用。
>
> **方法二**: 前往 **系统设置 > 隐私与安全性 (System Settings > Privacy & Security)**，找到 Security 区域，在 "EdNovasCloud was blocked..." 提示旁点击 **"仍要打开" (Open Anyway)**。
>
> **方法三**: 在 Finder 中找到应用，**右键点击**图标，选择 **打开**，然后在弹出的确认框中再次点击 **打开**。

### 🐧 Linux (Ubuntu/Debian)

仅支持 **DEB 包安装**：

```bash
# 安装下载的 deb 包
sudo apt install ./EdNovas-Cloud-*-Linux-amd64.deb

# 如果安装后图标未显示，请尝试注销并重新登录
```

#### 关于 Linux 的 TUN 模式
在 Linux 上启用 TUN 模式需要 **root 权限**。
目前请通过终端使用以下命令启动软件：
```bash
sudo ednovas-cloud --no-sandbox
```
*如果不使用 TUN 模式，普通用户直接点击图标启动即可使用系统代理模式。*
*注意：重启后的软件运行在 root 权限下，配置（如 Token）会自动从用户环境迁移。*

**⚠️ 常见问题：开启 TUN 模式后白屏或无法启动？**
如果遇到 `Authorization required` 或 `xcb_connect() failed` 错误，这是因为 root 用户无法访问当前桌面的显示服务 (X11/Wayland)。
请在终端执行以下命令授权，然后重试：
```bash
xhost +si:localuser:root
```
*(此命令允许 root 用户访问您的图形界面，通常重启后失效)*

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
npm run dev

# 5. 打包构建
npm run dist
```

## 📜 许可证

MIT License
