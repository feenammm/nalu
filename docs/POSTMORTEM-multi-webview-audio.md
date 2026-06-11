# 复盘：番茄钟 / 闹钟通知系统与多 WebView 音频 Bug

> 日期：2026-06-07
> 涉及文件：`pomodoro.rs`、`alarm.rs`、`+layout.svelte`、`notifications.ts`、`alertSound.ts`

---

## 背景

用户反馈番茄钟和闹钟的提醒"听不到、没感觉"。原始实现只在对应页面的组件内播放一个短促的提示音，切走页面后完全静默。

需求很明确：更长的铃声 + 系统通知 + 应用内弹窗，且在任意页面都能触发。

---

## 时间线

### 第一轮：实现通知功能

把提示音升级为 5 个音符的旋律（Web Audio API `OscillatorNode`），加入循环播放、系统通知（`@tauri-apps/plugin-notification`）和应用内弹窗（`AlertModal` 组件）。

一切正常，**但没有测试"不在当前页面"的场景。**

### 第二轮：发现不在当前页面不会响

原因：通知逻辑写在 `PomodoroPage.svelte` 和 `AlarmPage.svelte` 里，组件销毁后监听器就没了。

修复：把通知监听搬到 `+layout.svelte`，通过 `initGlobalNotifications()` 全局注册一次。番茄钟的计时逻辑也移到 Rust 后端（`pomodoro.rs` 后台任务），避免 WebView 隐藏时 JS 被节流导致定时器失效。

**教训：依赖 WebView JS 定时器做后台任务不可靠，macOS 会冻结隐藏 WebView 的 `setInterval`/`setTimeout`。**

### 第三轮：点"稍后提醒"后声音不停

第一次修复：`stopLoopingAlert()` 只把 `looping` 设为 `false`，但已经通过 `osc.start()` / `osc.stop()` 调度好的振荡器还在播放。

修复方案：用 `audioCtx.close()` 销毁整个音频上下文——"核弹选项"，确保所有振荡器立刻停止。

**教训：Web Audio API 的 `OscillatorNode` 一旦被调度，仅靠 `osc.stop()` 不够可靠。需要彻底销毁 `AudioContext` 才能保证静音。**

### 第四轮：快速触发事件产生孤儿循环

用户操作路径：设闹钟 → 关窗口 → 闹钟响 → 开窗口 → 点稍后提醒。隐藏期间事件堆积，开窗口后一次性涌入，多次 `fireAlarm()` 调用互相覆盖 `loopTimer` 变量，导致旧的 `setTimeout` 变成孤儿——无法被停止。

修复方案：引入代际计数器（generation counter）。每次 `startLoopingAlert()` 递增计数器并记录自己的代数，每次 tick 检查代数是否匹配。`stopLoopingAlert()` 递增全局计数器，所有孤儿循环在下一次 tick 时检测到代数不匹配就自动退出。加上 `activeAlarmId` 去重，防止同一闹钟重复触发。

**教训：事件驱动的异步循环必须有"自杀开关"。代际计数器是一种简单可靠的模式——每个循环携带一个版本号，全局版本号一变，旧循环自行终止。**

### 第五轮：两个声音重叠，关闭后变小但不停

用户精确描述："注意到两个声音重叠在一起播，点了稍后提醒之后声音变小了但没停。"

变小 = 停了一个还剩一个。说明有**两个独立的音频实例**在播放。

**根因**：Tauri 的 `app.emit()` 会广播到所有 WebView。应用有两个窗口——主窗口（main）和剪贴板弹窗（clipboard-popup）。`+layout.svelte` 在两个窗口中都会执行，导致两个 WebView 各自注册了事件监听、各自创建了 `AudioContext`。用户点"关闭"只停了主窗口的音频，clipboard-popup 窗口的音频成了孤儿。

修复：
1. **Rust 端**：`pomodoro.rs` 和 `alarm.rs` 的 `emit()` 改为 `emit_to("main", ...)`，事件只发给主窗口
2. **前端**：`+layout.svelte` 加路由守卫 `page.url.pathname === "/"`，只在主页面初始化通知监听

**教训：Tauri 多窗口应用中，`+layout.svelte` / `App.svelte` 级别的全局代码会在每个 WebView 中执行。任何"全局"副作用（事件监听、音频、WebSocket）都必须判断自己是否在目标窗口中运行。**

---

## 核心经验总结

### 1. `app.emit()` vs `app.emit_to()`

| 方法 | 行为 | 适用场景 |
|------|------|----------|
| `app.emit(event, payload)` | 广播到**所有** WebView | 所有窗口都需要响应的事件（如主题切换） |
| `app.emit_to(label, event, payload)` | 只发给指定窗口 | 只有特定窗口处理的事件（如闹钟、倒计时） |

**默认应该用 `emit_to`**，除非你确定所有窗口都需要这个事件。`emit()` 在多窗口场景下极易制造重复副作用。

### 2. 多 WebView 全局代码陷阱

SvelteKit 的 `+layout.svelte`、`+layout.ts`、`App.svelte` 中的顶层代码会在**每个 WebView 窗口**中执行。常见坑：

- 全局事件监听重复注册（每个窗口各一份）
- `AudioContext` 重复创建（每个窗口各一份，互不干扰，关一个另一个还在响）
- WebSocket 连接重复建立
- 全局状态 store 各窗口独立（不是共享的）

**防御方式**：在产生副作用前判断环境。

```svelte
<!-- 用路由判断（推荐，不依赖 Tauri API） -->
<script>
  import { page } from "$app/state";
  $effect(() => {
    if (page.url.pathname === "/") {
      initGlobalNotifications();
    }
  });
</script>
```

```svelte
<!-- 用窗口 label 判断（需要 mock，E2E 测试要补 label） -->
<script>
  import { getCurrentWindow } from "@tauri-apps/api/window";
  $effect(() => {
    if (getCurrentWindow().label === "main") {
      initGlobalNotifications();
    }
  });
</script>
```

路由判断更健壮，因为它不依赖 Tauri 运行时 API，E2E 测试的 mock 也更简单。

### 3. WebView JS 节流

macOS / Windows 会对隐藏的 WebView 进行 JS 节流：

- `setInterval` / `setTimeout` 的回调被延迟或跳过
- `requestAnimationFrame` 完全暂停
- Web Audio 可能继续播放（不受节流影响）

**后台定时任务必须放在 Rust 端**（`tauri::async_runtime::spawn` + `tokio::time::sleep`），不能依赖前端 JS 定时器。

注意：Tauri 的 `setup` 回调运行在主线程上，不在 tokio runtime 上下文中。必须用 `tauri::async_runtime::spawn` 而非 `tokio::spawn`，否则会 panic: "no reactor running"。

### 4. Web Audio API 的正确停止方式

```typescript
// 错误：仅设标志位，已调度的振荡器继续播放
looping = false;

// 错误：逐个 stop 振荡器，但你可能已经丢失了引用
oscillators.forEach(osc => osc.stop());

// 正确：销毁整个 AudioContext
audioCtx.close();
audioCtx = null;
```

### 5. 代际计数器模式

用于保证异步循环可以被可靠终止：

```typescript
let generation = 0;

function startLoop() {
  const myGen = ++generation;
  function tick() {
    if (myGen !== generation) return; // 孤儿检测，自行终止
    doWork();
    setTimeout(tick, interval);
  }
  tick();
}

function stopAll() {
  generation++; // 所有现存循环在下一次 tick 时自杀
}
```

比 `clearTimeout` / `clearInterval` 更可靠，因为不需要维护 timer ID（尤其在多次 start/stop 导致 ID 被覆盖的场景）。

---

## 自动化测试的局限

这个 bug 暴露了一个测试盲区：现有测试（Vitest 单元 + Playwright E2E）都无法覆盖"多 WebView 窗口同时存在"的场景。

Playwright 主要面向单页面测试。虽然可以通过 `context.newPage()` 模拟多页面，但 Tauri 的 WebView 窗口和浏览器 tab 不完全等价，Audio API 在 CI 的 headless 环境下行为也不一致。

如果要补测试，优先级：
1. **Rust 端**：抽取"事件目标窗口"的判断逻辑做单元测试，确保 `emit_to` 指向正确窗口
2. **前端组件测试**：mock `page.url.pathname`，验证非 `/` 路径不会调用 `initGlobalNotifications`
3. **E2E 多窗口**：成本高、稳定性低，建议作为手动回归项而非 CI 必过

---

## 相关文件索引

| 文件 | 职责 |
|------|------|
| `src-tauri/src/commands/alarm.rs` | 闹钟 CRUD + 后台检查器（每 10s 检查，`emit_to("main")`） |
| `src-tauri/src/commands/pomodoro.rs` | 番茄钟计时器（后台任务，`emit_to("main")`） |
| `src/routes/+layout.svelte` | 全局布局，路由守卫控制通知初始化 |
| `src/lib/utils/notifications.ts` | 全局事件监听（番茄钟 + 闹钟），`fireAlarm` 含去重和代际保护 |
| `src/lib/utils/alertSound.ts` | Web Audio 音频引擎，代际计数器 + `AudioContext.close()` |
| `src/lib/stores/alertStore.ts` | 弹窗状态 store |
| `src/lib/components/AlertModal.svelte` | 弹窗 UI 组件 |
