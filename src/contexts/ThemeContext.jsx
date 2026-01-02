import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEME_OPTIONS = ['light', 'dark', 'system'];

const getSystemTheme = () => {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const getStoredTheme = () => {
  const savedTheme = localStorage.getItem('theme');
  return THEME_OPTIONS.includes(savedTheme) ? savedTheme : null;
};

const resolveTheme = (themePreference, systemTheme) =>
  themePreference === 'system' ? systemTheme : themePreference;

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize theme synchronously to prevent flash
  const getInitialTheme = () => getStoredTheme() || getSystemTheme();

  const [theme, setTheme] = useState(() => {
    const initialTheme = getInitialTheme();
    const initialResolvedTheme = resolveTheme(initialTheme, getSystemTheme());
    // Apply theme immediately to prevent flash
    const root = document.documentElement;
    if (initialResolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return initialTheme;
  });

  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());
  const resolvedTheme = resolveTheme(theme, systemTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme, resolvedTheme]);

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
    mediaQuery.addListener(handleChange);
    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  const setThemePreference = (nextTheme) => {
    if (!THEME_OPTIONS.includes(nextTheme)) return;
    setTheme(nextTheme);
  };

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const currentIndex = THEME_OPTIONS.indexOf(prevTheme);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % THEME_OPTIONS.length;
      return THEME_OPTIONS[nextIndex];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemePreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

