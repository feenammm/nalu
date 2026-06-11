# Nalu 实现细节与技术规范

**版本**：v0.1.0 MVP  
**日期**：2026-06-06  
**状态**：MVP 已完成，可运行

---

## 一、已实现功能清单

### 1. 仪表盘（Dashboard）
- 统计卡片：待办任务数、已完成数、笔记数、备忘录数、日程事件数
- 快捷导航：8 个可点击卡片跳转到各功能模块
- 最近任务列表：支持直接勾选完成（toggle_task）
- 最近笔记列表：展示标题、内容摘要、标签

### 2. 任务管理（Tasks）
- 按项目分组筛选
- 添加/删除/切换完成状态
- SQLite 持久化，支持 created_at / updated_at 时间戳

### 3. 笔记与备忘录（Notes）
- 双面板布局：左侧列表 + 右侧编辑器
- 支持笔记（note）和备忘（memo）两种类型
- 标签系统（逗号分隔）
- 全文搜索

### 4. 剪贴板管理（Clipboard）
- 监听模式：每 2 秒轮询系统剪贴板
- 文本支持：自动捕获文本内容
- 图片支持：检测剪贴板图片，通过 Canvas 转 base64 PNG data URL 存储
- 文件路径支持：content_type = "file"
- 历史列表：按时间倒序，支持复制和删除
- 快窗弹窗：`Shift+Cmd+C` 全局快捷键唤起紧凑弹窗，支持一键复制
- 清空全部功能

### 5. 番茄钟（Pomodoro）
- SVG 圆环进度条显示
- 工作/休息自动切换
- 自定义工作时长（默认 25 分钟）和休息时长（默认 5 分钟）
- 后台 Tokio 异步计时器（`tauri::async_runtime::spawn`）
- 事件通知：`pomodoro-tick`（每秒）、`pomodoro-work-end`、`pomodoro-break-end`
- 系统通知弹窗 + Web Audio API 蜂鸣音（800Hz 正弦波，0.5 秒）
- 已完成番茄计数

### 6. 日程管理（Schedule）
- 添加事件：标题 + 日期 + 时间
- 标记完成/删除
- 定时检查：每 60 秒扫描一次，在 `reminder_minutes` 窗口内触发系统通知 + 蜂鸣音
- 防重复通知：已通知的事件 ID 记录在 Set 中

### 7. 闹钟（Alarm）
- 设置时间（HH:MM）、标签、重复模式（不重复/每天/工作日/周末）
- 每 30 秒检查一次当前时间是否匹配
- 工作日/周末重复判断（基于 Date.getDay()）
- 系统通知 + Web Audio API 蜂鸣音
- 启用/禁用切换

### 8. MySQL 工具
- 连接管理：主机、端口、用户名、密码
- Root 密码记忆：成功连接后自动保存到 localStorage，下次自动填充
- 数据库列表：连接后自动拉取，过滤系统库
- 数据库导出：通过 `mysqldump` 命令生成带时间戳的 SQL 文件
- 数据库导入：选择 .sql 文件，读取内容通过 `query_drop` 执行
- SQL 查询：textarea 输入，支持 SELECT/SHOW/DESCRIBE 查询和非查询
- 用户管理：维护 用户名-密码-数据库 表，支持同步到 MySQL 服务器
- 用户导入/导出：JSON 文件格式，支持保存和加载

### 9. AI 集成（Settings）
- OpenAI 兼容 API 配置（DeepSeek、OpenAI、自定义）
- API URL、API Key、Model 设置
- 测试连接功能

### 10. 国际化（i18n）
- 中文（默认）和英文双语
- 点号分隔键查找：`t("nav.dashboard")` → `"仪表盘"`
- localStorage 持久化语言选择
- 响应式切换：`onLocaleChange` + `localeVersion` 强制重渲染
- 设置页语言切换按钮

### 11. 命令面板（Command Palette）
- `Cmd+K` 全局快捷键唤起
- 模糊搜索
- 键盘导航（上下选择、回车执行）
- 导航命令：跳转到所有功能模块

---

## 二、数据库 Schema（SQLite）

数据库文件位于 `app_data_dir/nalu.db`。

```sql
-- 任务
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project TEXT NOT NULL DEFAULT 'default',
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 笔记/备忘
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    note_type TEXT NOT NULL DEFAULT 'memo',  -- 'memo' | 'note'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 剪贴板历史
CREATE TABLE IF NOT EXISTS clipboard_history (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,                    -- 文本内容 / base64 图片 / 文件路径
    content_type TEXT NOT NULL DEFAULT 'text', -- 'text' | 'image' | 'file'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 日程
CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,               -- ISO 8601 格式
    reminder_minutes INTEGER NOT NULL DEFAULT 5,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 闹钟
CREATE TABLE IF NOT EXISTS alarms (
    id TEXT PRIMARY KEY,
    time TEXT NOT NULL,                       -- "HH:MM" 格式
    label TEXT NOT NULL DEFAULT '',
    repeat TEXT NOT NULL DEFAULT 'none',      -- 'none' | 'daily' | 'weekdays' | 'weekends'
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- MySQL 用户管理
CREATE TABLE IF NOT EXISTS mysql_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL DEFAULT '',
    databases TEXT NOT NULL DEFAULT '',       -- 逗号分隔的数据库名
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

所有表的 `id` 字段使用 `uuid::Uuid::new_v4()` 生成。  
连接管理使用全局静态 `LazyLock<Mutex<Option<Connection>>>`。

---

## 三、Tauri Commands API 参考

### Database
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `db_query` | `sql: String` | `Vec<HashMap>` | 执行 SELECT 查询 |
| `db_execute` | `sql: String` | `usize` | 执行 INSERT/UPDATE/DELETE |

### Tasks
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_tasks` | `project?: String` | `Vec<Task>` | 获取任务列表 |
| `add_task` | `title, project?` | `Task` | 添加任务 |
| `toggle_task` | `id` | `bool` | 切换完成状态 |
| `delete_task` | `id` | `()` | 删除任务 |

### Notes
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_notes` | `note_type?, search?` | `Vec<Note>` | 获取笔记列表 |
| `add_note` | `title, content?, tags?, note_type?` | `Note` | 添加笔记 |
| `update_note` | `id, title?, content?, tags?` | `()` | 更新笔记 |
| `delete_note` | `id` | `()` | 删除笔记 |

### Clipboard
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_clipboard_history` | `limit?: i32` | `Vec<ClipboardEntry>` | 获取历史 |
| `add_clipboard_entry` | `content, content_type?` | `ClipboardEntry` | 添加条目 |
| `get_clipboard_entry` | `id` | `ClipboardEntry` | 获取单个条目 |
| `delete_clipboard_entry` | `id` | `()` | 删除条目 |
| `clear_clipboard_history` | — | `usize` | 清空历史 |

### Pomodoro
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `pomodoro_get_state` | — | `PomodoroState` | 获取状态 |
| `pomodoro_start` | `app: AppHandle` | `()` | 开始计时（spawn 后台任务） |
| `pomodoro_pause` | — | `PomodoroState` | 暂停 |
| `pomodoro_reset` | — | `PomodoroState` | 重置 |
| `pomodoro_skip` | — | `PomodoroState` | 跳过当前阶段 |
| `pomodoro_set_duration` | `work_minutes, break_minutes` | `PomodoroState` | 设置时长 |

### Schedule
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_schedules` | — | `Vec<Schedule>` | 获取日程列表 |
| `add_schedule` | `title, scheduled_at, reminder_minutes?` | `Schedule` | 添加日程 |
| `toggle_schedule` | `id` | `bool` | 切换完成状态 |
| `delete_schedule` | `id` | `()` | 删除日程 |

### Alarm
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_alarms` | — | `Vec<Alarm>` | 获取闹钟列表 |
| `add_alarm` | `time, label, repeat` | `Alarm` | 添加闹钟 |
| `toggle_alarm` | `id` | `bool` | 切换启用状态 |
| `delete_alarm` | `id` | `()` | 删除闹钟 |

### MySQL
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `mysql_test_connection` | `config: MysqlConfig` | `bool` | 测试连接 |
| `mysql_query` | `config, sql` | `MysqlResult` | 执行查询 |
| `mysql_execute` | `config, sql` | `u64` | 执行非查询 SQL |
| `mysql_list_databases` | `config` | `Vec<String>` | 列出数据库（过滤系统库） |
| `mysql_export` | `config, export_dir, table?` | `String` | mysqldump 导出 |
| `mysql_import` | `config, file_path` | `u64` | 导入 SQL 文件 |

### MySQL Users
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `get_mysql_users` | — | `Vec<MysqlUser>` | 获取管理的用户列表 |
| `add_mysql_user` | `username, password, databases` | `MysqlUser` | 添加用户记录 |
| `update_mysql_user` | `id, password?, databases?` | `()` | 更新用户信息 |
| `delete_mysql_user` | `id` | `()` | 删除用户记录 |
| `mysql_create_user_on_server` | `config, new_username, new_password, grant_databases` | `bool` | 同步到 MySQL 服务器 |

### AI
| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `ai_chat` | `config: AiConfig, messages: Vec<AiMessage>` | `AiResponse` | 发送聊天请求 |

---

## 四、前端组件结构

```
src/
├── App.vue                     # Vue 根组件
├── main.ts                     # Vue、Router、Pinia 入口
├── router.ts                   # Hash 路由配置
├── lib/
│   ├── i18n/
│   │   ├── index.ts            # t() 函数 + setLocale() + onLocaleChange()
│   │   ├── zh.ts               # 中文翻译
│   │   └── en.ts               # 英文翻译
│   ├── types.ts                # TypeScript 接口定义
│   ├── components/
│   │   ├── Sidebar.vue         # 左侧导航栏（9 项）
│   │   ├── CommandPalette.vue  # 命令面板（Cmd+K）
│   │   ├── ClipboardPopup.vue  # 剪贴板快窗（Shift+Cmd+C）
│   │   └── pages/
│   │       ├── DashboardPage.vue     # 仪表盘
│   │       ├── TasksPage.vue         # 任务管理
│   │       ├── NotesPage.vue         # 笔记/备忘
│   │       ├── ClipboardPage.vue     # 剪贴板历史
│   │       ├── PomodoroPage.vue      # 番茄钟
│   │       ├── SchedulePage.vue      # 日程管理
│   │       ├── MysqlPage.vue         # MySQL 工具
│   │       ├── AlarmPage.vue         # 闹钟
│   │       └── SettingsPage.vue      # 设置（语言 + AI）
```

### 路由策略
采用 **Vue Router + hash history** 的 SPA 模式。主布局通过 `<router-view>` 渲染页面，独立剪贴板窗口使用 `/#/clipboard-popup`。Hash 路由避免 Tauri 静态资源环境直接访问子路径时出现 404。

### 全局快捷键
| 快捷键 | 功能 |
|--------|------|
| `Cmd+K` / `Ctrl+K` | 打开/关闭命令面板 |
| `Shift+Cmd+C` / `Shift+Ctrl+C` | 打开/关闭剪贴板快窗 |

---

## 五、Rust 后端结构

```
src-tauri/src/
├── main.rs                     # 入口，调用 nalu_lib::run()
├── lib.rs                      # 注册所有插件和命令，初始化数据库
├── db/
│   ├── mod.rs
│   └── database.rs             # SQLite 连接管理 + 表创建
└── commands/
    ├── mod.rs                  # 模块声明
    ├── database.rs             # SQLite 通用查询
    ├── tasks.rs                # 任务 CRUD
    ├── notes.rs                # 笔记 CRUD
    ├── clipboard.rs            # 剪贴板历史 CRUD
    ├── pomodoro.rs             # 番茄钟（后台 Tokio 计时器）
    ├── schedule.rs             # 日程 CRUD
    ├── alarm.rs                # 闹钟 CRUD
    ├── mysql.rs                # MySQL 连接/查询/导入导出
    ├── mysql_users.rs          # MySQL 用户管理
    └── ai.rs                   # AI API 调用
```

### 关键技术决策

1. **异步命令**：MySQL 和 AI 命令标记为 `async fn`，Tauri 自动在 Tokio 运行时中调度。
2. **番茄钟计时器**：使用 `tauri::async_runtime::spawn`（而非 `tokio::spawn`）确保在 Tauri 运行时上下文中执行。
3. **数据库连接**：全局静态 `LazyLock<Mutex<Option<Connection>>>`，通过 `get_connection()` 获取 MutexGuard。
4. **rusqlite 生命周期**：在有参数过滤的查询中，使用独立的 `prepare` + `query_map` 调用避免 `params!` 宏临时值生命周期问题。
5. **MySQL 导出**：使用 `std::process::Command` 调用 `mysqldump`，不依赖 Rust 库做 dump。
6. **音频通知**：前端使用 Web Audio API 生成 800Hz 正弦波蜂鸣音，不依赖音频文件。

---

## 六、已知问题与限制

### 已修复的问题
1. ~~rusqlite `params!` 宏生命周期错误~~ → 拆分 match arms
2. ~~SvelteKit snippet 响应性失效~~ → 改用状态路由 SPA
3. ~~`tokio::spawn` 在同步命令中无运行时~~ → 改用 `tauri::async_runtime::spawn`
4. ~~lucide `Loader` 图标不存在~~ → 改用 `LoaderCircle`
5. ~~Svelte 表达式中不能渲染组件~~ → 改用 `{#if}` 块

### 当前限制
1. 剪贴板文件支持仅限路径存储，不支持文件内容深拷贝
2. 图片复制回剪贴板时，仅复制 data URL 文本（非原生图片）
3. `svelte:component` 在 Runes 模式下已弃用（产生警告），后续可改为动态组件语法
4. MySQL 导入依赖整个 SQL 文件加载到内存，大文件可能受限
5. 闹钟和日程的通知检查在前端执行，关闭页面后停止工作（后续可移到 Rust 后台）

### 构建警告（非阻塞）
- 多个 a11y 警告（`a11y_label_has_associated_control`、`a11y_click_events_have_key_events`）
- `<svelte:component>` 弃用警告

---

## 七、开发工作流

### 环境
- **Node.js**: 22.22.0（通过 nvm）
- **Rust**: 1.96.0（Edition 2024）
- **pnpm**: 10.33.0
- **平台**: macOS (aarch64-apple-darwin)

### 启动开发
```bash
source ~/.nvm/nvm.sh && nvm use 22
cd /Volumes/NALOMU_MAC/web/nalomu-uni-platform
pnpm tauri dev
```

### 项目路径
`/Volumes/NALOMU_MAC/web/nalomu-uni-platform`（外置磁盘 NALOMU_MAC）

### 数据路径
`~/Library/Application Support/com.nalomu.nalu/nalu.db`

### Git 仓库
已初始化，首次提交：`990597e`
