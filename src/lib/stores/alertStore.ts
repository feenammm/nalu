import { defineStore } from "pinia";
import { ref } from "vue";

export interface AlertConfig {
  title: string;
  body: string;
  buttonText?: string;
  snoozeText?: string;
  onDismiss?: () => void;
  onSnooze?: () => void;
}

export const useAlertStore = defineStore("alert", () => {
  const current = ref<AlertConfig | null>(null);

  function show(config: AlertConfig) {
    current.value = config;
  }

  function dismiss() {
    current.value = null;
  }

  return { current, show, dismiss };
});

export function showAlert(config: AlertConfig) {
  useAlertStore().show(config);
}

export function dismissAlert() {
  useAlertStore().dismiss();
}
