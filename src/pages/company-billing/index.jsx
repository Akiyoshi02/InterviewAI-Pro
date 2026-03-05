import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';

const CompanyBillingPage = () => {
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [upgradeMessage, setUpgradeMessage] = useState(null);

  // Handle Stripe redirect status
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setUpgradeMessage('Payment successful! Your subscription has been activated.');
      setSearchParams({}, { replace: true });
    } else if (status === 'cancelled') {
      setUpgradeMessage('Checkout was cancelled. You can try again whenever you\'re ready.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const userType = user?.accountType?.toUpperCase() === 'COMPANY' ? 'company' : null;
  const isAdmin = user?.organizationContext?.membership?.role === 'ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadBillingData = useCallback(async () => {
    if (!userType) return;
    setLoading(true);
    setError(null);
    try {
      const [plansRes, usageRes] = await Promise.allSettled([
        apiClient.billing.getPlans(),
        apiClient.billing.getUsage(),
      ]);

      if (plansRes.status === 'fulfilled' && plansRes.value?.success) {
        setPlans(plansRes.value.plans || []);
      }
      if (usageRes.status === 'fulfilled' && usageRes.value?.success) {
        setUsage(usageRes.value.usage || {});
      }

      if (isAdmin) {
        const [subRes, histRes] = await Promise.allSettled([
          apiClient.billing.getSubscription(),
          apiClient.billing.getBillingHistory(30),
        ]);
        if (subRes.status === 'fulfilled' && subRes.value?.success) {
          setSubscription(subRes.value.subscription || null);
        }
        if (histRes.status === 'fulfilled' && histRes.value?.success) {
          setHistory(histRes.value.history || []);
        }
      }
    } catch (err) {
      setError(err?.message || 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
  }, [userType, isAdmin]);

  useEffect(() => {
    loadBillingData();
  }, [loadBillingData]);

  const handleUpgradeClick = async (planId) => {
    if (!isAdmin) return;
    setUpgradeMessage(null);
    try {
      const res = await apiClient.billing.createCheckoutSession(planId);
      if (res?.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setUpgradeMessage(res?.message || 'Payment integration coming soon.');
      }
    } catch (err) {
      setUpgradeMessage(err?.message || 'Unable to start checkout.');
    }
  };

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Checking your session"
        message="Verifying secure access to billing and usage."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (!userType) {
    return null;
  }

  if (loading) {
    return (
      <LoadingState
        title="Loading billing"
        message="Fetching your plan and usage."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  const currentPlan = subscription?.plan || { id: 'free', name: 'Free', price: 0, interval: 'month' };
  const usageEntries = usage && typeof usage === 'object' ? Object.entries(usage) : [];

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>

      <Header
        userType={userType}
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType={userType}
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />
          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
              isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
            }`}
          >
            <motion.section
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="CreditCard" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    Billing &amp; Usage
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Manage your plan, view usage, and billing history.
                  </p>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <p className="text-sm text-amber-800 dark:text-amber-200">{error}</p>
                </div>
              )}

              {upgradeMessage && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20 p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">{upgradeMessage}</p>
                </div>
              )}

              {/* Current plan */}
              <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Current plan</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {currentPlan.name?.charAt(0) || 'F'}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-slate-100">{currentPlan.name || 'Free'}</p>
                      <p className="text-sm text-gray-500 dark:text-slate-400">
                        {currentPlan.price === 0 ? 'No charge' : `$${currentPlan.price}/${currentPlan.interval || 'month'}`}
                      </p>
                    </div>
                  </div>
                  {subscription?.status && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                      {subscription.status}
                    </span>
                  )}
                </div>
              </div>

              {/* Usage */}
              {usageEntries.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Usage this period</h2>
                  <div className="space-y-3">
                    {usageEntries.map(([feature, data]) => {
                      const limit = data?.limit;
                      const current = data?.current ?? 0;
                      const isUnlimited = limit === 'unlimited' || limit === -1;
                      const pct = isUnlimited ? 0 : (data?.percentage ?? 0);
                      const label = String(feature).replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                      return (
                        <div key={feature} className="flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-700 dark:text-slate-300">{label}</span>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden max-w-[80px]">
                              <div
                                className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all"
                                style={{ width: isUnlimited ? '0%' : `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">
                              {isUnlimited ? `${current} used` : `${current} / ${limit}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Billing history (admin only) */}
              {isAdmin && history.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Billing history</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700">
                          <th className="text-left py-2 text-gray-600 dark:text-slate-400 font-medium">Date</th>
                          <th className="text-left py-2 text-gray-600 dark:text-slate-400 font-medium">Event</th>
                          <th className="text-right py-2 text-gray-600 dark:text-slate-400 font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.slice(0, 20).map((event, i) => (
                          <tr key={event.id || i} className="border-b border-gray-100 dark:border-slate-800">
                            <td className="py-2 text-gray-700 dark:text-slate-300">
                              {event.date ? new Date(event.date).toLocaleDateString() : '--'}
                            </td>
                            <td className="py-2 text-gray-700 dark:text-slate-300">{event.type || event.eventType || '--'}</td>
                            <td className="py-2 text-right text-gray-700 dark:text-slate-300">
                              {event.amount != null ? `$${event.amount}` : '--'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Upgrade / plans (admin) */}
              {isAdmin && plans.length > 0 && (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 p-4 sm:p-6 shadow-lg">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-4">Plans</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`rounded-xl border p-4 ${
                          plan.id === currentPlan.id
                            ? 'border-blue-500 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/50'
                        }`}
                      >
                        <p className="font-semibold text-gray-900 dark:text-slate-100">{plan.name}</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-slate-100 mt-1">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && <span className="text-sm font-normal text-gray-500">/mo</span>}
                        </p>
                        {plan.id !== currentPlan.id && plan.price > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3 w-full"
                            onClick={() => handleUpgradeClick(plan.id)}
                          >
                            Upgrade
                          </Button>
                        )}
                        {plan.id === currentPlan.id && (
                          <span className="inline-block mt-3 text-xs font-medium text-blue-600 dark:text-blue-400">Current plan</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-4">
                    Payment upgrades are processed securely. Stripe integration coming soon.
                  </p>
                </div>
              )}
            </motion.section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default CompanyBillingPage;
