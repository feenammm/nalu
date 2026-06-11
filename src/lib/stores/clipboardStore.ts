import { defineStore } from "pinia";
import { ref, watch } from "vue";

export const useClipboardStore = defineStore("clipboard", () => {
  const monitoring = ref(localStorage.getItem("nalu-clipboard-monitoring") === "true");
  const lastContent = ref("");

  watch(monitoring, (value) => {
    localStorage.setItem("nalu-clipboard-monitoring", String(value));
  });

  function toggleMonitoring() {
    monitoring.value = !monitoring.value;
  }

  return { monitoring, lastContent, toggleMonitoring };
});
