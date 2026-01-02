import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SystemStats = ({ stats, onRefresh }) => {
  if (!stats) return null;

  const statCards = [
    {
      title: 'Total Organizations',
      value: stats.organizations.total,
      icon: 'Building',
      color: 'blue',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Pending Approval',
      value: stats.organizations.pending,
      icon: 'Clock',
      color: 'yellow',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      highlight: stats.organizations.pending > 0,
    },
    {
      title: 'Approved',
      value: stats.organizations.approved,
      icon: 'CheckCircle',
      color: 'green',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      title: 'Suspended',
      value: stats.organizations.suspended,
      icon: 'AlertTriangle',
      color: 'red',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      iconColor: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex flex-row items-center justify-between gap-3 sm:gap-4 mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
          Platform Statistics
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="flex items-center gap-2 flex-shrink-0"
        >
          <Icon name="RefreshCw" className="w-4 h-4" />
          <span className="hidden xs:inline">Refresh</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className={`
              rounded-2xl border border-white/40 dark:border-slate-700/50 
              bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg
              ${card.highlight ? 'ring-2 ring-yellow-400 dark:ring-yellow-600' : ''}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className={`inline-flex p-2 rounded-lg ${card.bgColor} mb-3`}>
                  <Icon name={card.icon} className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {card.value}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                  {card.title}
                </div>
              </div>
              {card.highlight && (
                <div className="px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
                  Action needed
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SystemStats;

