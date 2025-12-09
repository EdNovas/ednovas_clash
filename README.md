# EdNovas 云客户端

![Logo](https://raw.githubusercontent.com/EdNovas/ednovas_clash/refs/heads/main/public/ezv9d7ezv9d7ezv9.jpg) (如果需要可以替换为您自己的Logo URL)

一个基于 Electron + React + Clash Meta 内核的现代化代理客户端，专为 Windows 用户设计。

## ✨ 功能特点

- **🚀 极速内核**: 内置高性能 EdNovas-Core (Clash Meta) 内核。
- **🎨 现代化 UI**: 精心设计的暗色主题界面，支持动态流量显示。
- **🛡️ 智能分流**: 自动识别国内外流量，支持规则模式、全局模式和直连模式。
- **🔌 TUN 模式**: 支持虚拟网卡 (TUN) 模式，接管系统所有流量（包括不支持代理的软件）。
- **📥 自动配置**: 一键登录/订阅，自动下载配置与规则。
- **🧩 智能依赖**: 内置 GeoIP 和 GeoSite 数据库，首次启动自动部署，无需漫长下载。
- **🔄 自动更新**: 支持 GitHub Actions 自动构建与发布。

## 🛠️ 技术栈

- **Frontend**: React, TypeScript, Vite
- **Desktop**: Electron
- **Core**: Clash Meta (EdNovas-Core)
- **Styling**: Standard CSS (Grid/Flexbox)

## 📦 如何使用

1.  从 [Releases](../../releases) 页面下载最新的安装包 (`.exe`)。
2.  安装并运行程序。
3.  输入您的订阅账号密码登录即可使用。

## 🔨 本地开发

如果您想自己编译或修改代码：

```bash
# 1. 克隆仓库
git clone https://github.com/YourUsername/YourRepo.git
cd my-airport-client

# 2. 安装依赖
npm install

# 3. 放置资源文件
# 请确保 resources/ 目录下包含以下文件：
# - resources/bin/EdNovas-Core.exe
# - resources/geoip.metadb
# - resources/geosite.dat

# 4. 启动开发模式
npm run electron:dev

# 5. 打包构建
npm run electron:build
```

## 📜 许可证

MIT License
