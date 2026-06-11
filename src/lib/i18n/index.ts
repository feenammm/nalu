import { computed } from "vue";
import { storeToRefs } from "pinia";
import { zh } from "./zh";
import { en } from "./en";
import { useSettingsStore } from "$lib/stores/settingsStore";

export type Locale = "zh" | "en";
type TranslationShape<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : TranslationShape<T[K]>;
};
export type Translations = TranslationShape<typeof zh>;

const translations: Record<Locale, Translations> = { zh, en };

export function useI18n() {
  const settings = useSettingsStore();
  const { locale } = storeToRefs(settings);

  function t(key: string): string {
    let result: unknown = translations[locale.value];
    for (const part of key.split(".")) {
      if (result && typeof result === "object" && part in result) {
        result = (result as Record<string, unknown>)[part];
      } else {
        return key;
      }
    }
    return typeof result === "string" ? result : key;
  }

  return {
    locale,
    t,
    setLocale: settings.setLocale,
    version: computed(() => locale.value),
  };
}
