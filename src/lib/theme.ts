export const THEME_KEY = "manabi_theme";

export type ThemePref = "system" | "light" | "dark";

export function readThemePref(): ThemePref {
  const value = localStorage.getItem(THEME_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function writeThemePref(pref: ThemePref) {
  localStorage.setItem(THEME_KEY, pref);
}

export function cycleTheme(pref: ThemePref): ThemePref {
  return pref === "system" ? "light" : pref === "light" ? "dark" : "system";
}

export function applyTheme(pref: ThemePref) {
  const dark = pref === "dark"
    || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
