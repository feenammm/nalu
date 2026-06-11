import { test, expect } from "@playwright/test";

const tauriMock = `
  window.__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => {
      if (cmd === "get_tasks") return [];
      if (cmd === "get_notes") return [];
      if (cmd === "get_clipboard_history") return [];
      if (cmd === "get_alarms") return [];
      if (cmd === "pomodoro_get_state") return {
        is_running: false, is_break: false,
        remaining_seconds: 1500, work_duration: 1500,
        break_duration: 300, completed_count: 0,
      };
      if (cmd === "get_schedules") return [];
      if (cmd === "pomodoro_set_duration") return {
        is_running: false, is_break: false,
        remaining_seconds: (args?.workMinutes || 25) * 60,
        work_duration: (args?.workMinutes || 25) * 60,
        break_duration: (args?.breakMinutes || 5) * 60,
        completed_count: 0,
      };
      return null;
    },
    transformCallback: (cb) => cb,
  };
  window.__TAURI__ = {
    event: { listen: async () => () => {}, emit: async () => {} },
    window: { getCurrentWindow: () => ({ hide: async () => {}, show: async () => {}, isVisible: async () => true }) },
    core: { invoke: window.__TAURI_INTERNALS__.invoke },
  };
`;

test.describe("Nalu App E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(tauriMock);
  });

  // Helper: sidebar nav button
  const navBtn = (page: any, name: string) =>
    page.getByRole("navigation").getByRole("button", { name });

  test("app loads and shows sidebar navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    await expect(navBtn(page, "番茄钟")).toBeVisible();
    await expect(navBtn(page, "闹钟")).toBeVisible();
    await expect(navBtn(page, "设置")).toBeVisible();
  });

  test("navigate to pomodoro page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await navBtn(page, "番茄钟").click();
    await page.waitForTimeout(500);

    // Timer display
    await expect(page.getByText("25:00")).toBeVisible();
    await expect(page.getByText("专注时间")).toBeVisible();
  });

  test("navigate to alarm page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await navBtn(page, "闹钟").click();
    await page.waitForTimeout(500);

    await expect(page.getByText("设置闹钟")).toBeVisible();
    await expect(page.locator('input[type="time"]')).toBeVisible();
  });

  test("pomodoro shows timer circle and duration inputs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await navBtn(page, "番茄钟").click();
    await page.waitForTimeout(500);

    // SVG timer circle
    await expect(page.locator("svg circle").first()).toBeAttached();

    // Duration number inputs (work + break)
    const numberInputs = page.locator('input[type="number"]');
    await expect(numberInputs).toHaveCount(2);
  });

  test("alarm form has all required fields", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await navBtn(page, "闹钟").click();
    await page.waitForTimeout(500);

    // Time input
    await expect(page.locator('input[type="time"]')).toBeVisible();

    // Label text input
    await expect(page.locator('input[type="text"]')).toBeVisible();

    // Repeat select with correct options
    const select = page.locator("select");
    await expect(select).toBeVisible();
    await expect(select.locator('option[value="none"]')).toHaveCount(1);
    await expect(select.locator('option[value="daily"]')).toHaveCount(1);
    await expect(select.locator('option[value="weekdays"]')).toHaveCount(1);
    await expect(select.locator('option[value="weekends"]')).toHaveCount(1);
  });

  test("multiple page navigation works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Dashboard → Pomodoro
    await navBtn(page, "番茄钟").click();
    await page.waitForTimeout(300);
    await expect(page.getByText("25:00")).toBeVisible();

    // Pomodoro → Alarm
    await navBtn(page, "闹钟").click();
    await page.waitForTimeout(300);
    await expect(page.getByText("设置闹钟")).toBeVisible();

    // Alarm → Settings
    await navBtn(page, "设置").click();
    await page.waitForTimeout(300);
    await expect(page.locator("main h1").first()).toBeAttached();
  });
});
