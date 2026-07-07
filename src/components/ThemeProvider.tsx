import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, BORDER_RADIUS, SHADOWS, ThemeMode } from '../config/theme';
import { keyValueStore } from '../database/keyValueStore';

interface ThemeContextProps {
  mode: ThemeMode;
  colors: typeof COLORS.light;
  typography: typeof TYPOGRAPHY;
  spacing: typeof SPACING;
  borderRadius: typeof BORDER_RADIUS;
  shadows: typeof SHADOWS;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>((systemColorScheme as ThemeMode) || 'light');

  // Load saved theme on mount
  useEffect(() => {
    async function loadSavedTheme() {
      const savedTheme = await keyValueStore.getItem('ui_theme_mode');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setMode(savedTheme);
      }
    }
    loadSavedTheme();
  }, []);

  const setThemeMode = async (newMode: ThemeMode) => {
    setMode(newMode);
    await keyValueStore.setItem('ui_theme_mode', newMode);
  };

  const toggleTheme = () => {
    const nextMode = mode === 'light' ? 'dark' : 'light';
    setThemeMode(nextMode);
  };

  const colors = COLORS[mode];

  return (
    <ThemeContext.Provider
      value={{
        mode,
        colors,
        typography: TYPOGRAPHY,
        spacing: SPACING,
        borderRadius: BORDER_RADIUS,
        shadows: SHADOWS,
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
