import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import { deriveAchievementBadges } from '../candidate-dashboard/utils/candidateInsights.js';

// ── Weekly Challenges ─────────────────────────────────────────────────────

function getWeekChallenges() {
  const now = new Date();
  const weekNum = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
  // Rotate challenges weekly using weekNum as seed
  const pool = [
    { id: 'c1', title: 'Speed Run', desc: 'Complete 3 practice interviews in under 20 minutes each.', xp: 150, icon: 'Zap' },
    { id: 'c2', title: 'High Achiever', desc: 'Score 80% or above in 2 interviews.', xp: 200, icon: 'Star' },
    { id: 'c3', title: 'Mix Master', desc: 'Try 3 different interview categories this week.', xp: 175, icon: 'Shuffle' },
    { id: 'c4', title: 'Consistency King', desc: 'Practice on 4 different days this week.', xp: 125, icon: 'Calendar' },
    { id: 'c5', title: 'Feedback Focus', desc: 'Review and save feedback from 2 completed interviews.', xp: 100, icon: 'BookOpen' },
    { id: 'c6', title: 'STAR Storyteller', desc: 'Build and save 3 STAR answers in the Prep Library.', xp: 120, icon: 'Star' },
    { id: 'c7', title: 'Solo Grind', desc: 'Complete 5 practice sessions in total.', xp: 250, icon: 'Trophy' },
  ];
  const start = (weekNum * 3) % pool.length;
  return [pool[start % pool.length], pool[(start + 1) % pool.length], pool[(start + 2) % pool.length]];
}

// ── Streak Calendar ──────────────────────────────────────────────────────

export function buildStreakData(interviews) {
  const today = new Date();
  const completedInterviews = interviews.filter(
    (interview) => String(interview?.status || '').toUpperCase() === 'COMPLETED',
  );
  const calDays = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const hasActivity = completedInterviews.some((iv) => {
      const ivDate = (iv.endedAt || iv.completedAt || iv.updatedAt || iv.createdAt || '').split('T')[0];
      return ivDate === dateStr;
    });
    calDays.push({ date: dateStr, hasActivity, isToday: i === 0 });
  }

  // Compute current streak
  let streak = 0;
  const sorted = [...calDays].reverse();
  for (const day of sorted) {
    if (day.hasActivity) streak++;
    else if (!day.isToday) break;
  }

  return { calDays, currentStreak: streak };
}

// ── XP System ────────────────────────────────────────────────────────────

export function computeXP(interviews) {
  let xp = 0;
  for (const iv of interviews) {
    if (iv.status === 'COMPLETED') {
      xp += 50; // base per interview
      if ((iv.overallScore || 0) >= 80) xp += 30;
      if ((iv.overallScore || 0) >= 90) xp += 50;
    }
  }
  return xp;
}

export function getLevel(xp) {
  const levels = [
    { level: 1, minXP: 0, title: 'Newcomer' },
    { level: 2, minXP: 100, title: 'Practitioner' },
    { level: 3, minXP: 300, title: 'Contender' },
    { level: 4, minXP: 600, title: 'Achiever' },
    { level: 5, minXP: 1000, title: 'Expert' },
    { level: 6, minXP: 1500, title: 'Master' },
    { level: 7, minXP: 2500, title: 'Elite' },
    { level: 8, minXP: 4000, title: 'Legend' },
  ];
  let current = levels[0];
  let next = levels[1];
  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].minXP) {
      current = levels[i];
      next = levels[i + 1] || null;
    }
  }
  const progress = next
    ? Math.min(100, Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100))
    : 100;
  return { ...current, next, xp, progress };
}

// ── Main Page ─────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'achievements', label: 'Achievements', icon: 'Trophy' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'BarChart2' },
];

const GamificationPage = () => {
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [interviews, setInterviews] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ivRes, lbRes] = await Promise.allSettled([
          apiClient.interviews.getMyInterviews(),
          apiClient.referrals.getLeaderboard(),
        ]);
        if (ivRes.status === 'fulfilled' && ivRes.value?.success) {
          setInterviews(ivRes.value?.interviews || ivRes.value?.data || []);
        }
        if (lbRes.status === 'fulfilled' && lbRes.value?.success) {
          setLeaderboard(lbRes.value.leaderboard || []);
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const { calDays, currentStreak } = useMemo(() => buildStreakData(interviews), [interviews]);
  const xp = useMemo(() => computeXP(interviews), [interviews]);
  const levelInfo = useMemo(() => getLevel(xp), [xp]);
  const badges = useMemo(() => deriveAchievementBadges({ interviews }), [interviews]);
  const earnedBadges = badges.filter((b) => b.earned);
  const weekChallenges = useMemo(() => getWeekChallenges(), []);

  // Track challenge completion from localStorage
  const [completedChallenges, setCompletedChallenges] = useState(() => {
    try { return JSON.parse(localStorage.getItem('completed_challenges') || '[]'); } catch { return []; }
  });

  const toggleChallenge = (id) => {
    setCompletedChallenges((prev) => {
      const updated = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      localStorage.setItem('completed_challenges', JSON.stringify(updated));
      return updated;
    });
  };

  if (loading) return <LoadingState title="Loading achievements" variant="fullscreen" tone="primary" />;

  return (
    <div className="dashboard-shell">
      <Header userType="candidate" isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation userType="candidate" isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Achievements & Progress</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Track your streaks, badges, XP, and weekly challenges.
              </p>
            </motion.div>

            {/* XP / Level card */}
            <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-blue-200">Level {levelInfo.level}</p>
                  <p className="text-xl font-bold">{levelInfo.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{xp} XP</p>
                  {levelInfo.next && <p className="text-xs text-blue-200">{levelInfo.next.minXP - xp} XP to Level {levelInfo.next.level}</p>}
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-blue-500/40 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${levelInfo.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-white"
                />
              </div>
              <div className="flex items-center gap-4 mt-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Icon name="Flame" size={16} className="text-orange-300" />
                  <span>{currentStreak} day streak</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="Trophy" size={16} className="text-yellow-300" />
                  <span>{earnedBadges.length} badges</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="Target" size={16} className="text-green-300" />
                  <span>{interviews.filter(i => i.status === 'COMPLETED').length} interviews</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon name={tab.icon} size={14} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === 'overview' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                {/* Streak Calendar */}
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg p-5">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="Flame" size={16} className="text-orange-500" />
                    Practice Streak – Last 30 Days
                  </h2>
                  <div className="grid grid-cols-10 gap-1.5">
                    {calDays.map((day) => (
                      <div
                        key={day.date}
                        title={day.date}
                        className={`aspect-square rounded-md transition-all ${
                          day.isToday
                            ? 'ring-2 ring-blue-500 ring-offset-1'
                            : ''
                        } ${
                          day.hasActivity
                            ? 'bg-gradient-to-br from-green-400 to-emerald-500 shadow-sm'
                            : 'bg-gray-100 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-3">
                    {currentStreak > 0 ? `🔥 ${currentStreak}-day streak! Keep it up.` : 'Complete an interview today to start your streak!'}
                  </p>
                </div>

                {/* Weekly Challenges */}
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg p-5">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Icon name="Zap" size={16} className="text-yellow-500" />
                    Weekly Challenges
                  </h2>
                  <div className="space-y-3">
                    {weekChallenges.map((challenge) => {
                      const done = completedChallenges.includes(challenge.id);
                      return (
                        <div key={challenge.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          done
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
                            : 'bg-gray-50 dark:bg-slate-700/30 border-gray-200 dark:border-slate-700'
                        }`}>
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            done ? 'bg-green-500' : 'bg-blue-100 dark:bg-blue-900/30'
                          }`}>
                            <Icon name={done ? 'Check' : challenge.icon} size={16} className={done ? 'text-white' : 'text-blue-600 dark:text-blue-400'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{challenge.title}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{challenge.desc}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">+{challenge.xp} XP</span>
                            <button
                              onClick={() => toggleChallenge(challenge.id)}
                              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                                done
                                  ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                                  : 'border-gray-300 text-gray-600 dark:border-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600'
                              }`}
                            >
                              {done ? 'Done ✓' : 'Mark done'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Achievements */}
            {activeTab === 'achievements' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    {earnedBadges.length} / {badges.length} earned
                  </p>
                  <div className="h-2 w-32 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${badges.length ? (earnedBadges.length / badges.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {earnedBadges.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Earned</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {earnedBadges.map((badge) => (
                        <div key={badge.id} className="relative rounded-xl border-2 border-blue-200 dark:border-blue-700/50 bg-white/80 dark:bg-slate-800/80 p-4 text-center shadow">
                          <div className={`w-12 h-12 ${badge.color} rounded-full flex items-center justify-center mx-auto mb-2`}>
                            <Icon name={badge.icon} size={22} color="white" />
                          </div>
                          <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">{badge.name}</p>
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">{badge.description}</p>
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow">
                            <Icon name="Check" size={12} color="white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">In Progress</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {badges.filter((b) => !b.earned).map((badge) => (
                      <div key={badge.id} className="relative rounded-xl border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 p-4 text-center opacity-80">
                        <div className={`w-12 h-12 ${badge.color} rounded-full flex items-center justify-center mx-auto mb-2 opacity-60`}>
                          <Icon name={badge.icon} size={22} color="white" />
                        </div>
                        <p className="text-xs font-semibold text-gray-700 dark:text-slate-300">{badge.name}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 line-clamp-2">{badge.description}</p>
                        {badge.progress !== undefined && badge.total > 0 && (
                          <div className="mt-2">
                            <p className="text-xs text-gray-400 mb-1">{badge.progress}/{badge.total}</p>
                            <div className="h-1 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                                style={{ width: `${(badge.progress / badge.total) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Leaderboard */}
            {activeTab === 'leaderboard' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Top referrers by points (referral leaderboard). Interview score leaderboard coming soon.
                </p>
                {leaderboard.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-10 text-center space-y-3">
                    <Icon name="Trophy" size={36} className="text-gray-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm text-gray-500 dark:text-slate-400">Leaderboard is empty. Refer friends to appear here!</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg overflow-hidden">
                    {leaderboard.slice(0, 15).map((entry, idx) => (
                      <div key={entry.userId} className={`flex items-center gap-3 px-5 py-3 border-b border-gray-100 dark:border-slate-700/50 last:border-0 ${
                        entry.userId === user?.id ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                      }`}>
                        <span className={`text-sm font-bold w-6 text-center ${
                          idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-600' : 'text-gray-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(entry.displayName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                            {entry.userId === user?.id ? 'You' : entry.displayName}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-400">{entry.totalReferrals} referrals</p>
                        </div>
                        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{entry.totalPoints} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default GamificationPage;
