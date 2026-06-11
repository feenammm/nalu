# Nalu 技术选型定版

**项目名称**：Nalu（纳鲁）
**缩写**：NL
**项目代号**：nalux
**日期**：2026-06-06
**状态**：已定版

**选型原则**：最快开发速度优先，可一定程度牺牲性能。

---

## 环境要求（需升级）

| 工具 | 当前版本 | 要求版本 | 操作 |
|------|---------|---------|------|
| Node.js | v16.20.2 | **v20+** | 需升级（项目提供 `.nvmrc`） |
| Rust | 未安装 | **1.88+（最新 stable）** | 需安装（`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh`） |
| pnpm | 未检测 | **v10+** | 需安装（`npm install -g pnpm`） |

---

## 技术栈定版

### 核心框架

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 桌面框架 | **Tauri** | **2.11.2** | 桌面应用壳，系统 WebView 渲染，原生 API |
| 后端语言 | **Rust** | **1.88+** (Edition 2024) | Tauri 后端逻辑，插件运行时 |
| 前端框架 | **Vue 3** | **3.5** | UI 组件与响应式系统 |
| 前端路由 | **Vue Router** | **4.6** | Hash SPA 路由和 `<router-view>` |
| 全局状态 | **Pinia** | **3.0** | 跨页面应用状态 |
| 构建工具 | **Vite** | **6.4** | 前端开发服务器 + 构建 |
| 类型系统 | **TypeScript** | **5.6** | 前端类型安全，减少运行时 bug |
| CSS 方案 | **Tailwind CSS** | **4.3.0** | 原子化 CSS，极速写样式 |
| 图标库 | **lucide-vue-next** | **0.468** | Vue 图标组件 |

### Rust 后端依赖

| 库 | 版本 | 用途 |
|---|------|------|
| `tauri` | 2.11.2 | 核心框架 |
| `serde` | 1.0.228 | 序列化/反序列化 |
| `serde_json` | 1.0.150 | JSON 处理 |
| `tokio` | 1.52.3 (features: full) | 异步运行时 |
| `rusqlite` | 0.40.1 (features: bundled) | SQLite 嵌入式数据库，bundled 免装系统库 |
| `mysql_async` | 0.37.0 | MySQL 异步客户端 |
| `automerge` | 0.10.0 | CRDT 数据同步 |
| `axum` | 0.8.9 | 同步中继服务（V2 阶段） |
| `chrono` | 最新 | 日期时间处理 |
| `reqwest` | 最新 (features: json) | HTTP 客户端（AI API 调用） |
| `tracing` | 最新 | 结构化日志 |
| `uuid` | 最新 (features: v4) | UUID 生成 |

### Tauri 插件（官方）

| 插件 | npm 版本 | Rust 版本 | 用途 |
|------|---------|----------|------|
| `@tauri-apps/plugin-notification` | 2.3.3 | 2.3.3 | 系统通知（番茄钟、闹钟提醒） |
| `@tauri-apps/plugin-shell` | 2.3.5 | 2.3.5 | 执行系统命令（调用 mysqldump） |
| `@tauri-apps/plugin-clipboard-manager` | 2.3.2 | 2.3.2 | 剪贴板读写 |
| `@tauri-apps/plugin-global-shortcut` | 2.3.2 | 2.3.2 | 全局热键（命令面板唤起） |
| `@tauri-apps/plugin-store` | 2.4.3 | 2.4.3 | 轻量 KV 存储（插件配置） |
| `@tauri-apps/plugin-dialog` | 2.7.1 | 2.7.1 | 文件/目录选择对话框 |
| `@tauri-apps/plugin-fs` | 最新 | 最新 | 文件系统操作 |
| `@tauri-apps/plugin-process` | 最新 | 最新 | 进程管理（退出、重启） |

### 前端 npm 依赖

| 包 | 版本 | 用途 |
|---|------|------|
| `@tauri-apps/api` | 2.11.0 | Tauri 前端 API |
| `@tauri-apps/cli` | 2.11.2 | Tauri CLI（开发/构建） |
| `vue` | 3.5 | 前端框架 |
| `vue-router` | 4.6 | 前端路由 |
| `pinia` | 3.0 | 全局状态 |
| `vite` | 6.4 | 构建工具 |
| `typescript` | 5.6 | 类型系统 |
| `tailwindcss` | 4.3.0 | CSS 方案 |
| `@milkdown/core` | 7.21.2 | Markdown 编辑器核心 |
| `@milkdown/preset-commonmark` | 最新 | Markdown 基础语法 |
| `@milkdown/plugin-listener` | 最新 | 编辑器事件监听 |
| `lucide-vue-next` | 0.468 | 图标库 |

### 开发工具链

| 工具 | 版本 | 用途 |
|------|------|------|
| `pnpm` | v10+ | 包管理（快、磁盘友好） |
| `prettier` | 最新 | 代码格式化 |
| `eslint` | 最新 | 代码检查 |
| `vitest` | 最新 | 单元测试（Vite 原生） |
| `vue-tsc` | 2.2 | Vue 类型检查 |

---

## 项目结构

```
nalomu-uni-platform/
├── docs/                      # 项目文档
│   └── TECH_STACK.md          # 本文件
├── src/                       # 前端源码（Vue）
│   ├── lib/
│   │   ├── components/        # 通用 UI 组件
│   │   ├── stores/            # Pinia stores（全局状态）
│   │   ├── plugins/           # 内置插件前端
│   │   └── utils/             # 工具函数
│   ├── router.ts              # Vue Router hash 路由
│   ├── App.vue                # 根组件
│   └── main.ts                # 入口
├── src-tauri/                 # Rust 后端
│   ├── src/
│   │   ├── main.rs            # 入口
│   │   ├── commands/          # Tauri commands（前端可调用）
│   │   │   ├── mod.rs
│   │   │   ├── clipboard.rs   # 剪贴板相关
│   │   │   ├── database.rs    # SQLite + MySQL
│   │   │   ├── tasks.rs       # 任务管理
│   │   │   ├── notes.rs       # 笔记/备忘
│   │   │   ├── schedule.rs    # 日程/闹钟
│   │   │   ├── pomodoro.rs    # 番茄钟
│   │   │   └── ai.rs          # AI 服务调用
│   │   ├── db/                # 数据库层
│   │   │   ├── mod.rs
│   │   │   ├── migrations.rs  # SQLite 迁移
│   │   │   └── models.rs     # 数据模型
│   │   ├── plugins/           # 插件系统
│   │   │   ├── mod.rs
│   │   │   ├── loader.rs     # 插件加载
│   │   │   ├── registry.rs   # 命令注册表
│   │   │   └── runtime.rs    # 插件运行时
│   │   └── sync/              # 同步引擎（V2）
│   │       ├── mod.rs
│   │       └── crdt.rs       # Automerge 集成
│   ├── Cargo.toml             # Rust 依赖
│   ├── tauri.conf.json        # Tauri 配置
│   └── capabilities/          # 权限配置
├── plugins/                   # 插件开发目录
│   ├── nalu-clipboard/        # 内置：剪贴板管理
│   ├── nalu-mysql/            # 内置：MySQL 导入导出
│   ├── nalu-pomodoro/         # 内置：番茄钟
│   ├── nalu-ai/               # 内置：AI 助手
│   └── README.md              # 插件开发指南
├── mobile/                    # 移动端（V2 阶段）
├── relay-server/              # 同步中继服务（V2 阶段）
├── package.json
├── pnpm-lock.yaml
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── README.md
```

---

## Cargo.toml 参考

```toml
[package]
name = "nalu"
version = "0.1.0"
edition = "2024"

[dependencies]
tauri = { version = "2.11.2", features = ["tray-icon"] }
tauri-plugin-notification = "2.3.3"
tauri-plugin-shell = "2.3.5"
tauri-plugin-clipboard-manager = "2.3.2"
tauri-plugin-global-shortcut = "2.3.2"
tauri-plugin-store = "2.4.3"
tauri-plugin-dialog = "2.7.1"
tauri-plugin-fs = "2"
tauri-plugin-process = "2"
serde = { version = "1.0.228", features = ["derive"] }
serde_json = "1.0.150"
tokio = { version = "1.52.3", features = ["full"] }
rusqlite = { version = "0.40.1", features = ["bundled"] }
mysql_async = "0.37.0"
automerge = "0.10.0"
axum = "0.8.9"
chrono = { version = "0.4", features = ["serde"] }
reqwest = { version = "0.12", features = ["json"] }
tracing = "0.1"
tracing-subscriber = "0.3"
uuid = { version = "1", features = ["v4"] }

[build-dependencies]
tauri-build = { version = "2", features = [] }
```

---

## package.json 参考

```json
{
  "name": "nalu",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.11.0",
    "@tauri-apps/plugin-notification": "^2.3.3",
    "@tauri-apps/plugin-shell": "^2.3.5",
    "@tauri-apps/plugin-clipboard-manager": "^2.3.2",
    "@tauri-apps/plugin-global-shortcut": "^2.3.2",
    "@tauri-apps/plugin-store": "^2.4.3",
    "@tauri-apps/plugin-dialog": "^2.7.1",
    "@tauri-apps/plugin-fs": "^2",
    "@tauri-apps/plugin-process": "^2",
    "@milkdown/core": "^7.21.2",
    "@milkdown/preset-commonmark": "^7.21.2",
    "@milkdown/plugin-listener": "^7.21.2",
    "lucide-svelte": "^0.400.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.11.2",
    "svelte": "^5.56.2",
    "vite": "^8.0.16",
    "typescript": "^6.0.3",
    "tailwindcss": "^4.3.0",
    "prettier": "^3",
    "prettier-plugin-svelte": "^3",
    "eslint": "^9",
    "vitest": "^3",
    "svelte-check": "^4"
  }
}
```

---

## 开发阶段规划（快速优先）

### Phase 1：MVP 骨架（1-2 周）

目标：跑通 Tauri + Svelte 项目，命令面板能弹出来。

- [ ] 环境准备：安装 Rust、升级 Node.js 到 22、安装 pnpm
- [ ] `pnpm create tauri-app` 初始化项目（选 Svelte + TypeScript）
- [ ] 集成 Tailwind CSS 4 + shadcn-svelte
- [ ] 实现系统托盘 + 全局热键唤起
- [ ] 实现命令面板基础 UI（搜索框 + 列表）
- [ ] SQLite 初始化 + 基础 migration

### Phase 2：核心功能（3-4 周）

目标：内置插件全部可用。

- [ ] 剪贴板管理插件（记录历史、搜索、复制）
- [ ] MySQL 导入导出插件（连接、执行 SQL、dump/restore）
- [ ] 任务计划（项目分组、待办 CRUD、Markdown 编辑）
- [ ] 备忘录/笔记（统一管理、标签分类）
- [ ] 番茄钟（倒计时、休息提醒、系统通知）
- [ ] 日程/闹钟（日历视图、定时通知）

### Phase 3：插件系统（2 周）

目标：可以自己写新插件加进来。

- [ ] 插件 manifest 规范 + 加载器
- [ ] 命令注册表（插件注册命令 → 命令面板可搜索）
- [ ] 插件间通信（JSON-RPC over IPC）
- [ ] 插件开发模板 + `nalu init` CLI
- [ ] 热重载（开发模式）

### Phase 4：移动端同步（3-4 周）

目标：手机上能看到和编辑待办、笔记。

- [ ] Automerge CRDT 集成到 Rust 后端
- [ ] 中继服务（axum + WebSocket）
- [ ] Tauri Mobile 打包 iOS/Android
- [ ] 移动端 UI 适配（响应式或原生适配层）
- [ ] AI 接入（Ollama 本地 + 云端 API 双模）

---

## 快速启动命令（环境就绪后）

```bash
# 1. 创建项目
pnpm create tauri-app nalu --template svelte-ts

# 2. 进入项目
cd nalu

# 3. 安装依赖
pnpm add @tauri-apps/api @tauri-apps/plugin-notification @tauri-apps/plugin-shell @tauri-apps/plugin-clipboard-manager @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-store @tauri-apps/plugin-dialog @milkdown/core @milkdown/preset-commonmark lucide-svelte

# 4. 安装开发依赖
pnpm add -D tailwindcss prettier prettier-plugin-svelte vitest svelte-check

# 5. 启动开发
pnpm tauri dev
```
