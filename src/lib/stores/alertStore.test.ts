import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { dismissAlert, showAlert, useAlertStore } from "$lib/stores/alertStore";

describe("alertStore", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts as null", () => {
    expect(useAlertStore().current).toBeNull();
  });

  it("shows and dismisses an alert", () => {
    const onDismiss = vi.fn();
    showAlert({ title: "Test", body: "Hello", onDismiss });
    expect(useAlertStore().current?.title).toBe("Test");
    expect(useAlertStore().current?.onDismiss).toBe(onDismiss);
    dismissAlert();
    expect(useAlertStore().current).toBeNull();
  });

  it("replaces the previous alert", () => {
    showAlert({ title: "First", body: "A" });
    showAlert({ title: "Second", body: "B" });
    expect(useAlertStore().current?.title).toBe("Second");
  });
});
