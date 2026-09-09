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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const applyTheme = (next: Theme) => {
    const resolved = resolveTheme(next);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.documentElement.classList.toggle("dark", resolved === "dark");
    setResolvedTheme(resolved);
  };

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
