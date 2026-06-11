/**
 * Global notification listeners for Pomodoro and Alarm.
 * Initialized once in AppLayout so notifications work regardless of the current page.
 *
 * Pomodoro timer-end events are emitted by the Rust backend (pomodoro.rs).
 * Alarm trigger events are emitted by the Rust backend (alarm.rs alarm checker).
 * All timing logic runs in Rust — immune to WebView JS throttling when the window is hidden.
 */
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { playAlertChime, startLoopingAlert, stopLoopingAlert } from "$lib/utils/alertSound";
import { showAlert, dismissAlert } from "$lib/stores/alertStore";
import { useSettingsStore } from "$lib/stores/settingsStore";

let initialized = false;

// Guard against duplicate alarm fires (e.g. queued events from hidden webview)
let activeAlarmId: string | null = null;

interface AlarmPayload {
  id: string;
  time: string;
  label: string;
  repeat: string;
  active: boolean;
  created_at: string;
}

function fireAlarm(alarm: AlarmPayload) {
  const settings = useSettingsStore();
  // If the same alarm is already ringing, skip — prevents orphan loops
  // from queued events when the webview was hidden
  if (activeAlarmId === alarm.id) return;
  activeAlarmId = alarm.id;

  // CRITICAL: clean up any previous sound BEFORE starting new ones.
  // Without this, rapid-fire events overwrite loopTimer but leave the
  // old timer running → orphan loop that can never be stopped.
  stopLoopingAlert();

  const body = alarm.label || "闹钟响了";
  sendNotification({ title: "闹钟响了！", body });
  startLoopingAlert(settings.soundSettings.alarm);
  showAlert({
    title: "⏰ 闹钟响了！",
    body,
    buttonText: "关闭",
    snoozeText: "稍后提醒",
    onDismiss: () => {
      stopLoopingAlert();
      activeAlarmId = null;
    },
    onSnooze: () => {
      stopLoopingAlert();
      activeAlarmId = null;
      dismissAlert();
      // Re-fire after 5 minutes
      setTimeout(() => fireAlarm(alarm), 5 * 60 * 1000);
    },
  });
}

function resumePomodoro() {
  invoke("pomodoro_start").catch((error) => {
    console.error("Failed to resume pomodoro", error);
  });
}

/**
 * Initialize global event listeners for pomodoro and alarm.
 * Safe to call multiple times — only initializes once.
 */
export async function initGlobalNotifications() {
  if (initialized) return;
  initialized = true;

  // ── Pomodoro: listen for timer-end events ──
  await listen<number>("pomodoro-work-end", () => {
    const settings = useSettingsStore();
    sendNotification({ title: "番茄钟", body: "工作时段结束！该休息了。" });
    playAlertChime(settings.soundSettings.pomodoro);
    showAlert({
      title: "🍅 工作结束",
      body: "工作时段结束！该休息了。",
      buttonText: "开始休息",
      onDismiss: resumePomodoro,
    });
  });

  await listen("pomodoro-break-end", () => {
    const settings = useSettingsStore();
    sendNotification({ title: "番茄钟", body: "休息结束！继续工作吧。" });
    playAlertChime(settings.soundSettings.pomodoro);
    showAlert({
      title: "🍅 休息结束",
      body: "休息结束！继续工作吧。",
      buttonText: "开始专注",
      onDismiss: resumePomodoro,
    });
  });

  // ── Alarm: listen for alarm-triggered events from Rust backend ──
  await listen<AlarmPayload>("alarm-triggered", (event) => {
    fireAlarm(event.payload);
  });
}
