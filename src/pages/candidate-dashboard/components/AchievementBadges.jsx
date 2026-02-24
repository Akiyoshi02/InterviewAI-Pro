import React, { useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { deriveAchievementBadges } from '../utils/candidateInsights.js';

const raritySortOrder = Object.freeze({
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1,
});

const toProgressPercent = (badge = {}) => {
  const total = Number(badge?.total) || 1;
  const progress = Number(badge?.progress) || 0;
  return Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
};

const getRaritySortValue = (rarity) => raritySortOrder[String(rarity || '').toLowerCase()] || 0;

const AchievementBadges = ({
  badges = [],
  interviews = [],
  dashboardMetrics = null,
  analytics = null,
  applications = [],
  onViewAll,
  onViewLeaderboard,
}) => {
  const [showAllAvailable, setShowAllAvailable] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState(false);

  const derivedBadges = useMemo(
    () => deriveAchievementBadges({ interviews, dashboardMetrics, analytics, applications }),
    [interviews, dashboardMetrics, analytics, applications],
  );

  const badgeData = useMemo(() => {
    const source = Array.isArray(badges) && badges.length > 0 ? badges : derivedBadges;
    const items = [...source];
    if (leaderboardMode) {
      items.sort((left, right) => {
        const progressDelta = toProgressPercent(right) - toProgressPercent(left);
        if (progressDelta !== 0) return progressDelta;
        return String(left?.name || '').localeCompare(String(right?.name || ''));
      });
      return items;
    }

    items.sort((left, right) => {
      if (Boolean(right?.earned) !== Boolean(left?.earned)) {
        return Number(Boolean(right?.earned)) - Number(Boolean(left?.earned));
      }
      const rarityDelta = getRaritySortValue(right?.rarity) - getRaritySortValue(left?.rarity);
      if (rarityDelta !== 0) return rarityDelta;
      return String(left?.name || '').localeCompare(String(right?.name || ''));
    });
    return items;
  }, [badges, derivedBadges, leaderboardMode]);

  const earnedBadges = badgeData.filter((badge) => badge?.earned);
  const availableBadges = badgeData.filter((badge) => !badge?.earned);
  const visibleAvailableBadges = showAllAvailable ? availableBadges : availableBadges.slice(0, 6);
  const overallProgressPercent = badgeData.length
    ? Math.round((earnedBadges.length / badgeData.length) * 100)
    : 0;

  const handleLeaderboardClick = () => {
    if (typeof onViewLeaderboard === 'function') {
      onViewLeaderboard({ badges: badgeData, leaderboardMode });
      return;
    }
    setLeaderboardMode((prev) => !prev);
  };

  const handleViewAllClick = () => {
    if (typeof onViewAll === 'function') {
      onViewAll({ badges: badgeData, showAllAvailable });
      return;
    }
    setShowAllAvailable((prev) => !prev);
  };

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
    <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-3 sm:p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur">
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 mb-3 sm:mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">Achievement Badges</h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            {earnedBadges?.length} of {badgeData?.length} badges earned
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName="Trophy"
          iconPosition="left"
          onClick={handleLeaderboardClick}
          className="rounded-full text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 w-full xs:w-auto"
        >
          {leaderboardMode ? 'Default Order' : 'Leaderboard'}
        </Button>
      </div>
      {/* Progress Overview */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-slate-400">Overall Progress</span>
          <span className="font-medium text-gray-900 dark:text-slate-100">
            {overallProgressPercent}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-slate-900/70 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-500 bg-gradient-to-r from-blue-600 to-purple-600"
            style={{ width: `${overallProgressPercent}%` }}
          ></div>
        </div>
      </div>
      {/* Earned Badges */}
      {earnedBadges?.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3">Earned Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {earnedBadges?.map((badge) => (
              <div
                key={badge?.id}
                className={`relative border-2 ${getRarityBorder(badge?.rarity)} rounded-xl p-3 text-center hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,23,42,0.1)] dark:hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all duration-200 cursor-pointer group bg-white/80 dark:bg-slate-900/70 backdrop-blur`}
              >
                <div className={`w-10 h-10 ${badge?.color} rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform duration-200`}>
                  <Icon name={badge?.icon} size={20} color="white" />
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
          <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100 mb-3">Available Badges</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visibleAvailableBadges?.map((badge) => (
              <div
                key={badge?.id}
                className={`relative border-2 ${getRarityBorder(badge?.rarity)} rounded-xl p-3 text-center opacity-70 hover:opacity-95 transition-all duration-200 cursor-pointer bg-white/70 dark:bg-slate-900/70`}
              >
                <div className={`w-10 h-10 ${badge?.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                  <Icon name={badge?.icon} size={20} color="white" />
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
      <div className="mt-4 pt-3 border-t border-white/30 dark:border-slate-700/60">
        <Button
          variant="outline"
          fullWidth
          iconName="Trophy"
          iconPosition="left"
          onClick={handleViewAllClick}
          className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
        >
          {showAllAvailable ? 'Show Fewer Achievements' : 'View All Achievements'}
        </Button>
      </div>
    </div>
  );
};

export default AchievementBadges;
