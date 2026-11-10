import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { applyTheme, readThemePref } from "./lib/theme";
import "./styles/index.scss";

// 方案一 U5: seasonal accent — only --sakura/--sakura-soft shift, theme colors untouched.
const month = new Date().getMonth() + 1;
const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
document.documentElement.dataset.season = season;

// 方案一 U6: two-state theme (light default / dark), persisted in localStorage.
applyTheme(readThemePref());

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
