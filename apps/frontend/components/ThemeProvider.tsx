"use client";

import { createContext, useContext, useEffect, useState } from "react";
import "./theme.module.css";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readSavedTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("pwfb-theme");
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  return "system";
}

const runtimeThemeCss = `
html[data-theme="dark"] body{background:#0b1410!important;color:#e8f1eb!important}
html[data-theme="dark"] .pwfb-shell{background:radial-gradient(circle at 90% 0%,rgba(242,140,24,.08),transparent 28%),#0b1410!important;color:#e8f1eb}
html[data-theme="dark"] .pwfb-topbar{background:rgba(13,25,19,.98)!important;border-color:#26372d!important;color:#edf5ef!important}
html[data-theme="dark"] .pwfb-topbar-left strong,html[data-theme="dark"] .pwfb-page-title,html[data-theme="dark"] .pwfb-panel-header h2{color:#9be1ae!important}
html[data-theme="dark"] .pwfb-topbar-left small,html[data-theme="dark"] .pwfb-user-info small,html[data-theme="dark"] .pwfb-panel-header p,html[data-theme="dark"] .pwfb-page-description{color:#9caf9f!important}
html[data-theme="dark"] .pwfb-user-info strong{color:#f1f6f2!important}
html[data-theme="dark"] .pwfb-sidebar{background:#0d1913!important;border-color:#26372d!important}
html[data-theme="dark"] .pwfb-sidebar-header,html[data-theme="dark"] .pwfb-access,html[data-theme="dark"] .pwfb-sidebar-status{border-color:#26372d!important}
html[data-theme="dark"] .pwfb-nav-link,html[data-theme="dark"] .pwfb-subnav-link{color:#b9c9be!important}
html[data-theme="dark"] .pwfb-nav-link:hover,html[data-theme="dark"] .pwfb-subnav-link:hover{background:#17271f!important;color:#dff4e5!important}
html[data-theme="dark"] .pwfb-nav-link-active,html[data-theme="dark"] .pwfb-nav-link-parent-active,html[data-theme="dark"] .pwfb-subnav-link-active{background:#145f30!important;color:#fff!important}
html[data-theme="dark"] .pwfb-panel{background:#122019!important;border-color:#2b4034!important;box-shadow:0 4px 18px rgba(0,0,0,.22)!important}
html[data-theme="dark"] .pwfb-input,html[data-theme="dark"] input,html[data-theme="dark"] select,html[data-theme="dark"] textarea{background:#101c16!important;color:#edf5ef!important;border-color:#34483c!important}
html[data-theme="dark"] input::placeholder,html[data-theme="dark"] textarea::placeholder{color:#718478!important}
html[data-theme="dark"] .pwfb-label{color:#c7d6cc!important}
html[data-theme="dark"] .pwfb-table th{background:#17271f!important;color:#a9e4b9!important}
html[data-theme="dark"] .pwfb-table td{background:#122019!important;border-color:#26382e!important;color:#c1cec5!important}
html[data-theme="dark"] .bg-white{background-color:#122019!important}
html[data-theme="dark"] .bg-slate-50,html[data-theme="dark"] .bg-gray-50{background-color:#0f1b15!important}
html[data-theme="dark"] .bg-slate-100,html[data-theme="dark"] .bg-gray-100{background-color:#17271f!important}
html[data-theme="dark"] .text-slate-900,html[data-theme="dark"] .text-gray-900,html[data-theme="dark"] .text-slate-800,html[data-theme="dark"] .text-gray-800{color:#edf5ef!important}
html[data-theme="dark"] .text-slate-700,html[data-theme="dark"] .text-gray-700,html[data-theme="dark"] .text-slate-600,html[data-theme="dark"] .text-gray-600{color:#c1cec5!important}
html[data-theme="dark"] .text-slate-500,html[data-theme="dark"] .text-gray-500,html[data-theme="dark"] .text-slate-400,html[data-theme="dark"] .text-gray-400{color:#91a398!important}
html[data-theme="dark"] .border-slate-200,html[data-theme="dark"] .border-gray-200,html[data-theme="dark"] .border-slate-300,html[data-theme="dark"] .border-gray-300{border-color:#2d4136!important}
html[data-theme="dark"] .pwfb-secondary-button{background:#17271f!important;border-color:#385044!important;color:#a9e4b9!important}
html[data-theme="dark"] .pwfb-banking-operation{background:#122019!important;border-color:#2b4034!important;color:#a9e4b9!important}
html[data-theme="dark"] .pwfb-banking-operation-active{background:linear-gradient(180deg,#292017,#172019)!important}
html[data-theme="dark"] .pwfb-operation-header{background:linear-gradient(90deg,#14251c,#251d13)!important}
html[data-theme="dark"] .pwfb-deposit-actions{background:#101c16!important;border-color:#26382e!important}
html[data-theme="dark"] .pwfb-banking-empty{color:#9caf9f!important}
html[data-theme="dark"] .pwfb-verify-field{background:#101c16!important;border-color:#3a4c41!important;color:#87988c!important}
html[data-theme="dark"] .pwfb-record-count{background:#193522!important;color:#9be1ae!important}
.pwfb-theme-switcher{display:flex!important;align-items:center!important;gap:4px!important;padding:4px!important;border:1px solid #dfe7e2!important;border-radius:11px!important;background:#f7faf8!important;position:relative!important;z-index:1000!important;pointer-events:auto!important}
.pwfb-theme-option{border:0!important;border-radius:8px!important;background:transparent!important;color:#66736b!important;font-size:10px!important;font-weight:800!important;padding:7px 9px!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important}
.pwfb-theme-option:hover{background:#eaf7ef!important;color:#0a5c28!important}
.pwfb-theme-option-active{background:#0f7b35!important;color:#fff!important;box-shadow:0 2px 7px rgba(15,123,53,.18)!important}
html[data-theme="dark"] .pwfb-theme-switcher{background:#15251c!important;border-color:#304239!important}
html[data-theme="dark"] .pwfb-theme-option{color:#b4c8ba!important}
html[data-theme="dark"] .pwfb-theme-option:hover{background:#1d3626!important;color:#b8ebc6!important}
html[data-theme="dark"] .pwfb-theme-option-active{background:#168342!important;color:#fff!important}
@media(max-width:760px){.pwfb-theme-switcher{position:fixed!important;right:10px!important;top:68px!important;z-index:99999!important}.pwfb-theme-option{padding:8px 7px!important;font-size:10px!important}}
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const applyTheme = (next: Theme) => {
    const resolved = resolveTheme(next);
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    root.classList.toggle("dark", resolved === "dark");
    setResolvedTheme(resolved);
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "pwfb-runtime-theme";
    style.textContent = runtimeThemeCss;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const initial = readSavedTheme();
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (theme === "system") applyTheme("system");
    };
    media.addEventListener?.("change", handleSystemChange);
    return () => media.removeEventListener?.("change", handleSystemChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    try {
      window.localStorage.setItem("pwfb-theme", next);
    } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
