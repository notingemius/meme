import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ThemeColors } from './theme';
import { LightTheme, DarkTheme } from './theme';
import { loadSettings, updateSetting } from './game/settings';

type ThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: LightTheme,
  isDark: false,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => setIsDark(s.darkMode));
  }, []);

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      updateSetting('darkMode', next);
      return next;
    });
  }, []);

  const value: ThemeContextValue = {
    colors: isDark ? DarkTheme : LightTheme,
    isDark,
    toggle,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
