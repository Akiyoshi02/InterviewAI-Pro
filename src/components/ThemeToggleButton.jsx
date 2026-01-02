import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';

const ThemeToggleButton = () => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const currentIndex = THEME_OPTIONS.indexOf(theme);
  const nextTheme =
    currentIndex === -1 ? THEME_OPTIONS[0] : THEME_OPTIONS[(currentIndex + 1) % THEME_OPTIONS.length];
  const nextLabel =
    nextTheme === 'dark' ? 'Dark' : nextTheme === 'light' ? 'Light' : 'System';
  const currentLabel =
    theme === 'system'
      ? `System (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
      : theme === 'dark'
        ? 'Dark'
        : 'Light';
  const buttonLabel = `Theme: ${currentLabel}. Click to switch to ${nextLabel}.`;
  const CurrentIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const currentIconClassName =
    theme === 'light'
      ? 'text-yellow-500'
      : theme === 'dark'
        ? 'text-slate-700 dark:text-slate-200'
        : 'text-gray-700 dark:text-slate-300';

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      className="fixed bottom-36 lg:bottom-24 right-4 lg:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95"
      aria-label={buttonLabel}
      title={buttonLabel}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.span
        className="flex items-center justify-center leading-none"
        initial={false}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <CurrentIcon
          className={`w-5 h-5 sm:w-6 sm:h-6 ${currentIconClassName}`}
          strokeWidth={2.25}
        />
      </motion.span>
    </motion.button>
  );
};

export default ThemeToggleButton;

