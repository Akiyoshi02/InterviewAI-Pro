import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const AchievementBadges = ({ badges = [] }) => {
  const mockBadges = [
    {
      id: 1,
      name: 'First Steps',
      description: 'Completed your first practice interview',
      icon: 'Award',
      color: 'bg-gradient-to-br from-emerald-500 to-teal-500',
      earned: true,
      earnedDate: '2025-10-15',
      rarity: 'common'
    },
    {
      id: 2,
      name: 'Communication Expert',
      description: 'Achieved 90%+ in communication skills assessment',
      icon: 'MessageCircle',
      color: 'bg-gradient-to-br from-blue-600 to-purple-600',
      earned: true,
      earnedDate: '2025-10-28',
      rarity: 'rare'
    },
    {
      id: 3,
      name: 'Technical Wizard',
      description: 'Scored 95%+ on advanced technical questions',
      icon: 'Code',
      color: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      earned: true,
      earnedDate: '2025-10-30',
      rarity: 'epic'
    },
    {
      id: 4,
      name: 'Consistency Champion',
      description: 'Completed 10 practice sessions in a month',
      icon: 'Target',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      earned: false,
      progress: 7,
      total: 10,
      rarity: 'rare'
    },
    {
      id: 5,
      name: 'Speed Demon',
      description: 'Completed interview in under 20 minutes',
      icon: 'Zap',
      color: 'bg-gradient-to-br from-amber-500 to-orange-500',
      earned: false,
      progress: 0,
      total: 1,
      rarity: 'uncommon'
    },
    {
      id: 6,
      name: 'Perfect Score',
      description: 'Achieved 100% score in any category',
      icon: 'Star',
      color: 'bg-gradient-to-br from-rose-500 to-pink-500',
      earned: false,
      progress: 0,
      total: 1,
      rarity: 'legendary'
    }
  ];

  const badgeData = badges?.length > 0 ? badges : mockBadges;
  const earnedBadges = badgeData?.filter(badge => badge?.earned);
  const availableBadges = badgeData?.filter(badge => !badge?.earned);

  const getRarityColor = (rarity) => {
    const colorMap = {
      common: 'text-gray-500 dark:text-slate-400',
      uncommon: 'text-emerald-600 dark:text-emerald-400',
      rare: 'text-blue-600 dark:text-blue-400',
      epic: 'text-purple-600 dark:text-purple-400',
      legendary: 'text-amber-500 dark:text-amber-400'
    };
    return colorMap?.[rarity] || 'text-gray-500 dark:text-slate-400';
  };

  const getRarityBorder = (rarity) => {
    const borderMap = {
      common: 'border-gray-200 dark:border-slate-700/60',
      uncommon: 'border-emerald-200 dark:border-emerald-500/50',
      rare: 'border-blue-200 dark:border-blue-500/50',
      epic: 'border-purple-200 dark:border-purple-500/50',
      legendary: 'border-amber-200 dark:border-amber-500/60'
    };
    return borderMap?.[rarity] || 'border-white/40 dark:border-slate-700/60';
  };

  return (
    <div className="rounded-3xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Achievement Badges</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {earnedBadges?.length} of {badgeData?.length} badges earned
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName="Trophy"
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400"
        >
          Leaderboard
        </Button>
      </div>
      {/* Progress Overview */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500 dark:text-slate-400">Overall Progress</span>
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {Math.round((earnedBadges?.length / badgeData?.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-900/70 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-purple-600"
            style={{ width: `${(earnedBadges?.length / badgeData?.length) * 100}%` }}
          ></div>
        </div>
      </div>
      {/* Earned Badges */}
      {earnedBadges?.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Earned Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {earnedBadges?.map((badge) => (
              <div
                key={badge?.id}
                className={`relative border-2 ${getRarityBorder(badge?.rarity)} rounded-2xl p-4 text-center hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)] transition-all duration-300 cursor-pointer group bg-white/80 dark:bg-slate-900/70 backdrop-blur`}
              >
                <div className={`w-12 h-12 ${badge?.color} rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-200`}>
                  <Icon name={badge?.icon} size={24} color="white" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-slate-100 text-sm mb-1">{badge?.name}</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{badge?.description}</p>
                <div className={`text-xs font-medium mt-2 ${getRarityColor(badge?.rarity)}`}>
                  {badge?.rarity?.toUpperCase()}
                </div>
                {badge?.earnedDate && (
                  <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                    Earned {new Date(badge.earnedDate)?.toLocaleDateString()}
                  </div>
                )}
                
                {/* Earned indicator */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-success rounded-full flex items-center justify-center shadow-md shadow-emerald-500/40">
                  <Icon name="Check" size={12} color="white" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Available Badges */}
      {availableBadges?.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-4">Available Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {availableBadges?.slice(0, 6)?.map((badge) => (
              <div
                key={badge?.id}
                className={`relative border-2 ${getRarityBorder(badge?.rarity)} rounded-2xl p-4 text-center opacity-70 hover:opacity-95 transition-all duration-200 cursor-pointer bg-white/70 dark:bg-slate-900/70`}
              >
                <div className={`w-12 h-12 ${badge?.color} rounded-full flex items-center justify-center mx-auto mb-3`}>
                  <Icon name={badge?.icon} size={24} color="white" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-slate-100 text-sm mb-1">{badge?.name}</h4>
                <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-2">{badge?.description}</p>
                <div className={`text-xs font-medium mt-2 ${getRarityColor(badge?.rarity)}`}>
                  {badge?.rarity?.toUpperCase()}
                </div>
                
                {/* Progress indicator */}
                {badge?.progress !== undefined && badge?.total && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 dark:text-slate-400 mb-1">
                      {badge?.progress}/{badge?.total}
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-slate-900/70 rounded-full h-1">
                      <div
                        className="h-1 rounded-full transition-all duration-300 bg-gradient-to-r from-blue-600 to-purple-600"
                        style={{ width: `${(badge?.progress / badge?.total) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Lock indicator */}
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-muted rounded-full flex items-center justify-center">
                  <Icon name="Lock" size={12} className="text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* View All Badges */}
      <div className="mt-6 pt-4 border-t border-white/30 dark:border-slate-700/60">
        <Button
          variant="outline"
          fullWidth
          iconName="Trophy"
          iconPosition="left"
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          View All Achievements
        </Button>
      </div>
    </div>
  );
};

export default AchievementBadges;