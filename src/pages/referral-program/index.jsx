import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

const TIER_CONFIG = {
  none: { label: 'No tier yet', color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-slate-700', icon: 'Award', min: 0 },
  bronze: { label: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: 'Award', min: 1 },
  silver: { label: 'Silver', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700', icon: 'Star', min: 3 },
  gold: { label: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: 'Trophy', min: 10 },
};

const Section = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-5 sm:p-6 shadow-lg space-y-4">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
      <Icon name={icon} size={16} className="text-blue-500" />
      {title}
    </h2>
    {children}
  </div>
);

const ReferralProgramPage = () => {
  const { user, logout } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const [referral, setReferral] = useState(null);
  const [referred, setReferred] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const userType = 'candidate';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [refRes, lbRes] = await Promise.allSettled([
          apiClient.referrals.getMyReferral(),
          apiClient.referrals.getLeaderboard(),
        ]);
        if (refRes.status === 'fulfilled' && refRes.value?.success) {
          setReferral(refRes.value.referral);
          setReferred(refRes.value.referred || []);
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

  const copyLink = () => {
    if (!referral?.referralLink) return;
    navigator.clipboard.writeText(referral.referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return <LoadingState title="Loading referral program" variant="fullscreen" tone="primary" />;
  }

  const tier = TIER_CONFIG[referral?.tier || 'none'];
  const nextTier = referral?.tier === 'gold' ? null
    : referral?.tier === 'silver' ? TIER_CONFIG.gold
    : referral?.tier === 'bronze' ? TIER_CONFIG.silver
    : TIER_CONFIG.bronze;

  const progressToNext = nextTier ? Math.min(100, ((referral?.totalReferrals || 0) / nextTier.min) * 100) : 100;

  return (
    <div className="dashboard-shell">
      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation userType={userType} isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-xl font-bold text-gray-900 dark:text-slate-100">Referral Program</h1>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                Invite friends to InterviewAI Pro and earn reward points.
              </p>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Referrals', value: referral?.totalReferrals || 0, icon: 'Users' },
                { label: 'Completed', value: referral?.completedReferrals || 0, icon: 'CheckCircle' },
                { label: 'Total Points', value: referral?.totalPoints || 0, icon: 'Zap' },
                { label: 'Redeemed', value: referral?.redeemedPoints || 0, icon: 'Gift' },
              ].map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow p-4 text-center space-y-1">
                  <Icon name={stat.icon} size={18} className="text-blue-500 mx-auto" />
                  <p className="text-xl font-bold text-gray-900 dark:text-slate-100">{stat.value}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Tier badge + progress */}
            <Section title="Your Tier" icon="Award">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm ${tier.bg} ${tier.color}`}>
                <Icon name={tier.icon} size={16} />
                {tier.label}
              </div>
              {nextTier && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400">
                    <span>Progress to {nextTier.label}</span>
                    <span>{referral?.totalReferrals || 0} / {nextTier.min}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progressToNext}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TIER_CONFIG).filter(([k]) => k !== 'none').map(([key, t]) => (
                  <div key={key} className={`rounded-lg p-3 text-center space-y-1 border ${
                    referral?.tier === key
                      ? 'border-blue-400 dark:border-blue-600'
                      : 'border-gray-100 dark:border-slate-700'
                  }`}>
                    <Icon name={t.icon} size={20} className={t.color + ' mx-auto'} />
                    <p className={`text-xs font-semibold ${t.color}`}>{t.label}</p>
                    <p className="text-xs text-gray-400">{t.min}+ referrals</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* Referral link */}
            <Section title="Your Referral Link" icon="Link">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Share this link with friends. When they sign up and complete their first interview, you both earn points.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={referral?.referralLink || ''}
                  className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700 px-3 py-2 font-mono text-gray-700 dark:text-slate-300"
                />
                <Button onClick={copyLink} iconName={copied ? 'Check' : 'Copy'} size="sm">
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Your referral code: <code className="font-mono font-semibold text-blue-600 dark:text-blue-400">{referral?.code}</code>
              </p>
            </Section>

            {/* Referred users */}
            <Section title="People You've Referred" icon="Users">
              {referred.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">No referrals yet. Share your link to get started!</p>
              ) : (
                <div className="space-y-2">
                  {referred.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <Icon name="User" size={13} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-sm text-gray-700 dark:text-slate-300">{r.email || 'Anonymous'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          r.status === 'interview_completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {r.status === 'interview_completed' ? 'Completed' : 'Signed up'}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">+{r.pointsAwarded} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Leaderboard */}
            <Section title="Top Referrers" icon="Trophy">
              {leaderboard.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-slate-400">No referrals yet in the community. Be the first!</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.slice(0, 10).map((entry) => (
                    <div key={entry.userId} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                      <span className={`text-sm font-bold w-6 text-center ${
                        entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-slate-400' : entry.rank === 3 ? 'text-amber-600' : 'text-gray-500'
                      }`}>
                        {entry.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                          {entry.userId === user?.id ? 'You' : entry.displayName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{entry.totalReferrals} referrals</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TIER_CONFIG[entry.tier]?.bg} ${TIER_CONFIG[entry.tier]?.color}`}>
                        <Icon name={TIER_CONFIG[entry.tier]?.icon || 'Award'} size={11} />
                        {entry.totalPoints} pts
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ReferralProgramPage;
