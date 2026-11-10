import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyTheme, readThemePref, THEME_KEY } from "./lib/theme";
import "./styles/index.scss";

// 方案一 U5: seasonal accent — only --sakura/--sakura-soft shift, theme colors untouched.
const month = new Date().getMonth() + 1;
const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
document.documentElement.dataset.season = season;

// 方案一 U6: three-state theme (system / light / dark), persisted in localStorage.
applyTheme(readThemePref());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (readThemePref() === "system") applyTheme("system");
});

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
