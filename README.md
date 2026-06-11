# Nalu

基于 Tauri 2 的本地优先个人助手，前端使用 Vue 3 + Vue Router + Pinia + TypeScript + Vite + Tailwind CSS 4。

## 许可证

[MIT](LICENSE)

## 环境要求

- Node.js 20+
- pnpm
- Rust 工具链及 Tauri 平台依赖

## 开发

```bash
pnpm install
pnpm dev
```

启动桌面应用：

```bash
pnpm tauri:dev
```

## 验证

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

## 安全说明

本项目为本地桌面应用，信任本地运行环境。部分 Tauri 命令（如数据库查询、Shell 执行）具有较高权限，仅应在本地使用，不适合多用户或远程部署场景。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 架构

- [架构概述](docs/ARCHITECTURE.md)
- [技术栈](docs/TECH_STACK.md)
