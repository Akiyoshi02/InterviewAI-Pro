import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../AppIcon';

const MaintenanceBanner = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-3"
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex-shrink-0">
          <Icon
            name="AlertTriangle"
            className="w-5 h-5 text-amber-600 dark:text-amber-400"
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Platform Maintenance in Progress
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            The platform is currently under maintenance. You can view data but cannot make changes. Please try again later.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default MaintenanceBanner;



