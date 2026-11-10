export const THEME_KEY = "manabi_theme";

export type ThemePref = "light" | "dark";

/** 默认日间模式；只有用户手动选过夜间才会是 dark（旧的 "system" 值按日间处理）。 */
export function readThemePref(): ThemePref {
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function writeThemePref(pref: ThemePref) {
  localStorage.setItem(THEME_KEY, pref);
}

export function cycleTheme(pref: ThemePref): ThemePref {
  return pref === "light" ? "dark" : "light";
}

export function applyTheme(pref: ThemePref) {
  document.documentElement.dataset.theme = pref === "dark" ? "dark" : "light";
}
