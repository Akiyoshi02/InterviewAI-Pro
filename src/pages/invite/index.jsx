import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import apiClient from '../../services/apiClient.js';
import { useAuth } from '../../contexts/AuthContext.jsx';

const useQuery = () => {
  const { search } = useLocation();
  return React.useMemo(() => new URLSearchParams(search), [search]);
};

const InvitePage = () => {
  const query = useQuery();
  const token = query.get('token');
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();

  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const loadPreview = useCallback(async () => {
    if (!token) {
      setError('Missing invitation token.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await apiClient.invitations.preview(token);
      if (result.success) {
        setPreview(result);
        setError('');
      } else {
        setError('Invitation not found or expired.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load invitation.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    setActionMessage('');
    setError('');
    try {
      const result = await apiClient.invitations.accept(token);
      if (result.success) {
        if (result.interview?.id) {
          // Redirect to interview lobby
          navigate(`/interview-lobby/${result.interview.id}`);
        } else {
          setActionMessage('Invitation accepted! You can now access the interview session.');
        }
      } else {
        setError('Failed to accept invitation.');
      }
    } catch (err) {
      setError(err.message || 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  };

  const handleCopyToken = async () => {
    if (!token || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header userType="candidate" isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="candidate"
            isCollapsed={isNavCollapsed}
            onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
          />

          <main
            className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}
          >
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 xs:py-8 sm:py-10">
              <div className="mb-4">
                <Button variant="ghost" size="sm" onClick={() => navigate('/jobs')}>
                  ← Back to jobs
                </Button>
              </div>
              <motion.div
                className="rounded-3xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 sm:p-10 shadow-[0_30px_80px_rgba(15,23,42,0.15)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur space-y-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="space-y-2 text-center">
                  <p className="text-xs uppercase tracking-[0.4em] text-blue-600 dark:text-blue-400">Interview invitation</p>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100">You're invited to interview</h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Join a structured AI-assisted screening session prepared by the hiring team.
                  </p>
                </div>

                {loading && (
                  <div className="flex justify-center py-10">
                    <LoadingState
                      variant="inline"
                      title="Loading invitation..."
                      tone="primary"
                    />
                  </div>
                )}

                {!loading && error && (
                  <div className="text-center text-red-600 dark:text-red-400">{error}</div>
                )}

                {!loading && preview && (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-white/40 dark:border-slate-700/40 bg-white dark:bg-slate-900/70 p-5">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{preview.job?.title}</h2>
                      <p className="text-sm text-gray-500 dark:text-slate-400">{preview.job?.department}</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300 mt-4">{preview.job?.description}</p>
                      <div className="mt-4 text-sm text-gray-500 dark:text-slate-400">
                        Interview format:&nbsp;
                        {(preview.job?.interviewTypes || []).join(', ') || 'Standard AI session'}
                        &nbsp;• Duration: {preview.job?.duration || 30} minutes
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 dark:border-blue-500/40 bg-blue-50/80 dark:bg-blue-500/10 p-4 text-sm text-blue-900 dark:text-blue-100 space-y-1">
                      <div>
                        Invitation for <strong>{preview.invitation?.email}</strong> · Stage: {preview.invitation?.stage}
                        {preview.invitation?.expiresAt && (
                          <>
                            &nbsp;• Expires {new Date(preview.invitation.expiresAt).toLocaleString()}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="font-mono text-blue-800 dark:text-blue-200 truncate">{token}</span>
                        <Button variant="outline" size="xs" onClick={handleCopyToken}>
                          {copied ? 'Copied!' : 'Copy token'}
                        </Button>
                      </div>
                    </div>

                    {actionMessage && (
                      <div className="space-y-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 text-sm">
                        <p>{actionMessage}</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button variant="outline" onClick={() => navigate('/practice-interview-setup')}>
                            Warm up session
                          </Button>
                          <Button onClick={() => navigate('/live-interview-session')}>
                            Join live interview
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        Signed in as {user?.email}
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <Button
                          onClick={handleAccept}
                          disabled={accepting}
                          className="rounded-full"
                        >
                          {accepting ? 'Accepting...' : 'Accept Invitation'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default InvitePage;
