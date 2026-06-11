/**
 * Tests for the global notifications module.
 * Mocks Tauri APIs and sound/alert modules.
 */
import { describe, it, expect, vi } from "vitest";

// ── Mock Tauri event listener ─────────────────────────────
const eventHandlers: Record<string, Function[]> = {};

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: Function) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(handler);
    return Promise.resolve(() => {});
  }),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
}));

vi.mock("$lib/utils/alertSound", () => ({
  playAlertChime: vi.fn(),
  startLoopingAlert: vi.fn(),
  stopLoopingAlert: vi.fn(),
}));

vi.mock("$lib/stores/settingsStore", () => ({
  useSettingsStore: () => ({
    soundSettings: {
      pomodoro: { type: "preset", id: "gentle-bell" },
      alarm: { type: "preset", id: "warm-chime" },
    },
  }),
}));

vi.mock("$lib/stores/alertStore", () => ({
  showAlert: vi.fn(),
  dismissAlert: vi.fn(),
}));

// Import after mocking
const { initGlobalNotifications } = await import("$lib/utils/notifications");
const { invoke } = await import("@tauri-apps/api/core");
const { sendNotification } = await import("@tauri-apps/plugin-notification");
const { playAlertChime, startLoopingAlert } = await import("$lib/utils/alertSound");
const { showAlert } = await import("$lib/stores/alertStore");

describe("notifications", () => {
  it("registers event listeners on first init", async () => {
    await initGlobalNotifications();
    expect(eventHandlers["pomodoro-work-end"]).toBeDefined();
    expect(eventHandlers["pomodoro-work-end"]!.length).toBeGreaterThanOrEqual(1);
    expect(eventHandlers["pomodoro-break-end"]).toBeDefined();
    expect(eventHandlers["alarm-triggered"]).toBeDefined();
  });

  it("is idempotent — calling init twice only registers once", async () => {
    const countBefore = eventHandlers["pomodoro-work-end"]?.length ?? 0;
    await initGlobalNotifications(); // second call
    const countAfter = eventHandlers["pomodoro-work-end"]?.length ?? 0;
    expect(countAfter).toBe(countBefore); // no new handlers added
  });

  it("pomodoro-work-end triggers notification + sound + alert", () => {
    vi.mocked(sendNotification).mockClear();
    vi.mocked(playAlertChime).mockClear();
    vi.mocked(showAlert).mockClear();

    eventHandlers["pomodoro-work-end"]?.forEach((h) => h({ payload: 0 }));

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "番茄钟" })
    );
    expect(playAlertChime).toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("工作") })
    );
  });

  it("pomodoro confirmation resumes the next phase", () => {
    vi.mocked(invoke).mockClear();
    vi.mocked(showAlert).mockClear();

    eventHandlers["pomodoro-work-end"]?.forEach((h) => h({ payload: 1 }));

    const alertConfig = vi.mocked(showAlert).mock.calls.at(-1)?.[0];
    alertConfig?.onDismiss?.();

    expect(invoke).toHaveBeenCalledWith("pomodoro_start");
  });

  it("pomodoro-break-end triggers notification + sound + alert", () => {
    vi.mocked(sendNotification).mockClear();
    vi.mocked(playAlertChime).mockClear();
    vi.mocked(showAlert).mockClear();

    eventHandlers["pomodoro-break-end"]?.forEach((h) => h({ payload: undefined }));

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "番茄钟" })
    );
    expect(playAlertChime).toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("休息") })
    );
  });

  it("alarm-triggered fires alarm with looping sound + snooze", () => {
    vi.mocked(sendNotification).mockClear();
    vi.mocked(startLoopingAlert).mockClear();
    vi.mocked(showAlert).mockClear();

    const alarmPayload = {
      id: "test-alarm",
      time: "08:00",
      label: "起床",
      repeat: "daily",
      active: true,
      created_at: "2026-01-01",
    };

    eventHandlers["alarm-triggered"]?.forEach((h) => h({ payload: alarmPayload }));

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "闹钟响了！" })
    );
    expect(startLoopingAlert).toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "⏰ 闹钟响了！",
        body: "起床",
        buttonText: "关闭",
        snoozeText: "稍后提醒",
      })
    );
  });

  it("alarm without label uses default body text", () => {
    vi.mocked(showAlert).mockClear();

    eventHandlers["alarm-triggered"]?.forEach((h) =>
      h({ payload: { id: "x", time: "09:00", label: "", repeat: "none", active: true, created_at: "" } })
    );

    expect(showAlert).toHaveBeenCalledWith(
      expect.objectContaining({ body: "闹钟响了" })
    );
  });
});
