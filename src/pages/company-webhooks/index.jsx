import React, { useState, useEffect, useCallback } from 'react';
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

const SUPPORTED_EVENTS = [
  { id: 'application.created', label: 'New Application', desc: 'A candidate submits an application.' },
  { id: 'application.status_changed', label: 'Application Status Changed', desc: 'Application status updated.' },
  { id: 'interview.completed', label: 'Interview Completed', desc: 'A candidate completes an interview.' },
  { id: 'interview.scheduled', label: 'Interview Scheduled', desc: 'An interview is scheduled or rescheduled.' },
  { id: 'candidate.hired', label: 'Candidate Hired', desc: 'A candidate is marked as hired.' },
];

const StatusBadge = ({ ok }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    ok
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  }`}>
    <Icon name={ok ? 'CheckCircle' : 'XCircle'} size={11} />
    {ok ? 'OK' : 'Failed'}
  </span>
);

const EMPTY_FORM = { url: '', events: [], description: '' };

const CompanyWebhooksPage = () => {
  const { user, logout, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const [webhooks, setWebhooks] = useState([]);
  const [supportedEvents, setSupportedEvents] = useState(SUPPORTED_EVENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newSecret, setNewSecret] = useState(null);

  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState({});
  const [expandedDeliveries, setExpandedDeliveries] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  const userType = 'company';
  const isAdmin = user?.organizationContext?.membership?.role === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.webhooks.list();
      if (res?.success) {
        setWebhooks(res.webhooks || []);
        if (res.supportedEvents) setSupportedEvents(SUPPORTED_EVENTS);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load webhooks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setFormError(null);
    if (!form.url) return setFormError('URL is required.');
    if (form.events.length === 0) return setFormError('Select at least one event.');
    setSaving(true);
    try {
      const res = await apiClient.webhooks.create(form);
      if (res?.success) {
        setNewSecret(res.secret);
        setShowForm(false);
        setForm(EMPTY_FORM);
        await load();
      } else {
        setFormError(res?.error || 'Failed to create webhook.');
      }
    } catch (err) {
      setFormError(err?.message || 'Failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (wh) => {
    try {
      await apiClient.webhooks.update(wh.id, { active: !wh.active });
      setWebhooks((prev) => prev.map((w) => w.id === wh.id ? { ...w, active: !w.active } : w));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this webhook?')) return;
    try {
      await apiClient.webhooks.remove(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch { /* ignore */ }
  };

  const handleTest = async (id) => {
    setTestingId(id);
    setTestResult((p) => ({ ...p, [id]: null }));
    try {
      const res = await apiClient.webhooks.test(id);
      setTestResult((p) => ({ ...p, [id]: res }));
    } finally {
      setTestingId(null);
    }
  };

  const handleViewDeliveries = async (id) => {
    if (expandedDeliveries === id) {
      setExpandedDeliveries(null);
      return;
    }
    setExpandedDeliveries(id);
    setDeliveriesLoading(true);
    try {
      const res = await apiClient.webhooks.deliveries(id);
      setDeliveries(res?.deliveries || []);
    } finally {
      setDeliveriesLoading(false);
    }
  };

  const toggleEvent = (eventId) => {
    setForm((p) => ({
      ...p,
      events: p.events.includes(eventId) ? p.events.filter((e) => e !== eventId) : [...p.events, eventId],
    }));
  };

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Checking your session"
        message="Verifying secure access to webhooks."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Admin access required to manage webhooks.</p>
      </div>
    );
  }

  if (loading) {
    return <LoadingState title="Loading webhooks" message="Please wait..." variant="fullscreen" tone="primary" />;
  }

  return (
    <div className="dashboard-shell">
      <Header userType={userType} isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation userType={userType} isCollapsed={isNavCollapsed} onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)} />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="shrink-0 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 p-3 shadow-lg shadow-purple-500/30">
                  <Icon name="Webhook" size={24} color="white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">Webhooks</h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    Receive real-time HTTP notifications when events happen in your hiring pipeline.
                  </p>
                </div>
              </div>
              <Button
                iconName="Plus"
                onClick={() => { setShowForm(true); setNewSecret(null); }}
                className="w-full justify-center sm:w-auto"
              >
                Add Webhook
              </Button>
            </motion.div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Secret reveal banner */}
            <AnimatePresence>
              {newSecret && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2"
                >
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                    <Icon name="Key" size={15} />
                    Webhook created - save your signing secret now
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    This secret will only be shown once. Store it securely to verify incoming webhook signatures.
                  </p>
                  <code className="block font-mono text-sm bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded px-3 py-2 break-all">
                    {newSecret}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => setNewSecret(null)}>
                    I've saved it
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Create form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-lg p-5 space-y-4"
                >
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">New Webhook</h2>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Endpoint URL *</label>
                    <input
                      type="url"
                      value={form.url}
                      onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
                      placeholder="https://your-server.com/webhook"
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Description (optional)</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="e.g. Notify our ATS system"
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Events to subscribe *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUPPORTED_EVENTS.map((ev) => (
                        <label key={ev.id} className="flex items-start gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50">
                          <input
                            type="checkbox"
                            checked={form.events.includes(ev.id)}
                            onChange={() => toggleEvent(ev.id)}
                            className="mt-0.5 h-4 w-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <span className="text-xs font-medium text-gray-800 dark:text-slate-200">{ev.label}</span>
                            <p className="text-xs text-gray-500 dark:text-slate-400">{ev.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formError && <p className="text-xs text-red-500">{formError}</p>}
                  <div className="flex gap-2">
                    <Button onClick={handleCreate} disabled={saving} size="sm">
                      {saving ? 'Creating...' : 'Create webhook'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null); }}>
                      Cancel
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Webhook list */}
            {webhooks.length === 0 && !showForm && (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 p-10 text-center space-y-3">
                <Icon name="Webhook" size={36} className="text-gray-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm text-gray-500 dark:text-slate-400">No webhooks yet. Add one to start receiving events.</p>
              </div>
            )}

            <div className="space-y-4">
              {webhooks.map((wh) => (
                <div key={wh.id} className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${wh.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{wh.url}</p>
                      {wh.description && (
                        <p className="text-xs text-gray-500 dark:text-slate-400">{wh.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {wh.events.map((ev) => (
                          <span key={ev} className="inline-flex px-1.5 py-0.5 rounded text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {wh.lastDelivery && (
                        <StatusBadge ok={wh.lastDelivery.success} />
                      )}
                    </div>
                  </div>

                  {testResult[wh.id] && (
                    <div className={`text-xs rounded-lg px-3 py-2 ${
                      testResult[wh.id].ok
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    }`}>
                      {testResult[wh.id].message || testResult[wh.id].error}
                    </div>
                  )}

                  {/* Deliveries */}
                  {expandedDeliveries === wh.id && (
                    <div className="space-y-1 border-t border-gray-100 dark:border-slate-700 pt-3">
                      <p className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-2">Recent deliveries</p>
                      {deliveriesLoading ? (
                        <p className="text-xs text-gray-400">Loading...</p>
                      ) : deliveries.length === 0 ? (
                        <p className="text-xs text-gray-400">No deliveries yet.</p>
                      ) : (
                        deliveries.slice(0, 10).map((d) => (
                          <div key={d.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-400 py-1 border-b border-gray-100 dark:border-slate-700/50">
                            <span className="font-mono">{d.eventType}</span>
                            <StatusBadge ok={d.status === 'delivered'} />
                            <span>{d.createdAt ? new Date(d.createdAt).toLocaleString() : '--'}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      iconName="FlaskConical"
                      onClick={() => handleTest(wh.id)}
                      disabled={testingId === wh.id}
                    >
                      {testingId === wh.id ? 'Sending...' : 'Test'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      iconName="List"
                      onClick={() => handleViewDeliveries(wh.id)}
                    >
                      {expandedDeliveries === wh.id ? 'Hide' : 'Deliveries'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      iconName={wh.active ? 'PauseCircle' : 'PlayCircle'}
                      onClick={() => handleToggleActive(wh)}
                    >
                      {wh.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      iconName="Trash2"
                      onClick={() => handleDelete(wh.id)}
                      className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Signing Guide */}
            <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow p-5 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Icon name="Shield" size={15} className="text-blue-500" />
                Verifying Webhook Signatures
              </h2>
              <p className="text-xs text-gray-600 dark:text-slate-400">
                Each webhook is sent with an <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">X-Webhook-Signature</code> header
                in the format <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">t=TIMESTAMP,v1=SIGNATURE</code>.
              </p>
              <p className="text-xs text-gray-600 dark:text-slate-400">
                To verify: compute HMAC-SHA256 of <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">TIMESTAMP.BODY</code> using your signing secret.
                Compare to the <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded">v1</code> value. Reject requests where
                <code className="font-mono bg-gray-100 dark:bg-slate-700 px-1 rounded ml-1">|now - TIMESTAMP| &gt; 300s</code>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CompanyWebhooksPage;
