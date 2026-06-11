export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "nalu-theme";
const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");

function isDarkPreferred(): boolean {
  return darkMedia.matches;
}

function apply(mode: ThemeMode): void {
  const shouldDark = mode === "dark" || (mode === "system" && isDarkPreferred());
  document.documentElement.classList.toggle("dark", shouldDark);
}

/** Read the stored theme (defaults to "system"). */
function read(): ThemeMode {
  return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "system";
}

/** Persist and apply a new theme mode. */
export function setTheme(mode: ThemeMode): void {
  localStorage.setItem(STORAGE_KEY, mode);
  apply(mode);
}

/** Initialise theme on app startup. Call once from main.ts / popup entry. */
export function initTheme(): () => void {
  const mode = read();
  apply(mode);

  // When mode is "system", re-evaluate whenever the OS preference changes.
  const handler = () => {
    if (read() === "system") apply("system");
  };
  darkMedia.addEventListener("change", handler);
  return () => darkMedia.removeEventListener("change", handler);
}

/** Returns the currently effective theme ("light" | "dark"). */
export function effectiveTheme(): "light" | "dark" {
  const mode = read();
  if (mode === "system") return isDarkPreferred() ? "dark" : "light";
  return mode;
}
