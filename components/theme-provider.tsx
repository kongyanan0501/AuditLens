"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyThemeMode,
  defaultThemeMode,
  persistThemeMode,
  readStoredThemeMode,
  type ThemeMode,
} from "@/lib/theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: ThemeMode;
};

export function ThemeProvider({
  children,
  defaultTheme = defaultThemeMode,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeMode(mode);
    persistThemeMode(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === "dark" ? "light" : "dark";
      applyThemeMode(next);
      persistThemeMode(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const stored = readStoredThemeMode();
    if (stored) {
      setThemeState(stored);
      applyThemeMode(stored);
    }
    setMounted(true);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [theme, setTheme, toggleTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
