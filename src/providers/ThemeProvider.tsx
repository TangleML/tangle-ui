import type { ReactNode } from "react";
import { useContext, useEffect, useLayoutEffect, useState } from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";
import { getStorage } from "@/utils/typedStorage";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "App/theme";

const themeStorage = getStorage<
  typeof THEME_STORAGE_KEY,
  Record<typeof THEME_STORAGE_KEY, Theme>
>();

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createRequiredContext<ThemeContextValue>("ThemeContext");

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

function readStoredTheme(): Theme {
  const stored = themeStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  // Follow OS-level changes so "system" stays accurate while it's selected.
  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    themeStorage.setItem(THEME_STORAGE_KEY, next);
  };

  return (
    <ThemeContext value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext>
  );
};

export const useTheme = () => useRequiredContext(ThemeContext);

export const useThemeOptional = (): ThemeContextValue | null =>
  useContext(ThemeContext) ?? null;
