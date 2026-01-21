import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { Monitor, Moon, Sun, ArrowUp } from 'lucide-react';
import { THEME_OPTIONS, useTheme } from '../contexts/ThemeContext';
import { AnimatePresence, motion } from 'framer-motion';
import { isLoadingScreenActive, subscribeLoadingScreen } from '../utils/loadingScreenState';
import { FLOATING_BUTTON_MOTION } from '../utils/floatingButtonMotion';

const ThemeToggleButton = () => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const loadingScreenActive = useSyncExternalStore(
    subscribeLoadingScreen,
    isLoadingScreenActive,
    isLoadingScreenActive
  );
  const [showBackToTop, setShowBackToTop] = useState(false);
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
  const isDashboardView = pathname?.startsWith('/company-')
    || pathname?.startsWith('/candidate-')
    || pathname === '/my-applications'
    || pathname?.startsWith('/jobs')
    || pathname === '/practice-interview-setup';
  const themePositionClass = isDashboardView
    ? 'bottom-36 lg:bottom-24'
    : 'bottom-36 lg:bottom-24';
  const backToTopPositionClass = isDashboardView
    ? 'bottom-52 lg:bottom-40'
    : 'bottom-20 lg:bottom-8';
  const shouldShowBackToTop = showBackToTop;
  const { initial, animate, exit, transition } = FLOATING_BUTTON_MOTION;

  useEffect(() => {
    if (loadingScreenActive) {
      setShowBackToTop(false);
      return undefined;
    }

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingScreenActive]);

  if (loadingScreenActive) {
    return null;
  }

  const handleBackToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <motion.button
        type="button"
        onClick={toggleTheme}
        className={`fixed ${themePositionClass} right-4 lg:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95`}
        aria-label={buttonLabel}
        title={buttonLabel}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={initial}
        animate={animate}
        transition={transition}
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

      <AnimatePresence>
        {shouldShowBackToTop && (
          <motion.button
            type="button"
            onClick={handleBackToTop}
            className={`fixed ${backToTopPositionClass} right-4 lg:right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-slate-900/90 dark:bg-slate-100/90 border border-slate-800/40 dark:border-slate-200/60 text-white dark:text-slate-900 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 active:scale-95`}
            aria-label="Back to top"
            title="Back to top"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            initial={initial}
            animate={animate}
            exit={exit}
            transition={transition}
          >
            <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default ThemeToggleButton;

