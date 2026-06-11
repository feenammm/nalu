# 参与贡献

## 开发环境

```bash
pnpm install
pnpm dev          # 前端开发服务器
pnpm tauri:dev    # 桌面应用（热更新）
```

## 技术栈

- **前端**：Vue 3、TypeScript、Tailwind CSS 4、Vite
- **桌面**：Tauri 2、Rust
- **测试**：Vitest（单元测试）、Playwright（e2e）

## 提交前检查

```bash
pnpm check        # 类型检查
pnpm test         # 单元测试
pnpm test:e2e     # e2e 测试
pnpm build        # 生产构建
```

## 代码规范

- Vue 组件统一使用 `<script setup lang="ts">`
- 使用 Composition API（`ref()` / `computed()`），避免 Options API
- 优先使用 Tailwind 原子类，减少自定义 CSS
- Rust 代码遵循 2024 edition 惯例，使用 `cargo fmt` 和 `cargo clippy`

## 架构文档

参见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) 和 [docs/TECH_STACK.md](docs/TECH_STACK.md)。
