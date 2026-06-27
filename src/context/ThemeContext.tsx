import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  MATERIAL_THEME_CHANGE_EVENT,
  applyMaterialTheme,
  buildMaterialThemeFromSeedColor,
  readStoredMaterialTheme,
  type MaterialThemeColors,
} from '../lib/materialTheme';
import { resolveRuntimeConfig } from '../utils/config';

type ThemeContextValue = {
  activeTheme: MaterialThemeColors;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialDarkMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readInitialTheme(): MaterialThemeColors {
  return readStoredMaterialTheme() ?? buildMaterialThemeFromSeedColor(resolveRuntimeConfig().themeSeedColor);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeTheme, setActiveTheme] = useState<MaterialThemeColors>(() => readInitialTheme());
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => readInitialDarkMode());

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  useEffect(() => {
    const handleMaterialThemeChange = () => {
      const nextTheme = readStoredMaterialTheme();

      if (nextTheme) {
        setActiveTheme(nextTheme);
      }
    };

    window.addEventListener(MATERIAL_THEME_CHANGE_EVENT, handleMaterialThemeChange);
    window.addEventListener('storage', handleMaterialThemeChange);

    return () => {
      window.removeEventListener(MATERIAL_THEME_CHANGE_EVENT, handleMaterialThemeChange);
      window.removeEventListener('storage', handleMaterialThemeChange);
    };
  }, []);

  useEffect(() => {
    applyMaterialTheme(activeTheme, isDarkMode);
  }, [activeTheme, isDarkMode]);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      activeTheme,
      isDarkMode,
      toggleDarkMode: () => setIsDarkMode((currentValue) => !currentValue),
    }),
    [activeTheme, isDarkMode],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const contextValue = useContext(ThemeContext);

  if (!contextValue) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return contextValue;
}
