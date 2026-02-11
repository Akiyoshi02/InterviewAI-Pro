import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LoadingState from '../../../components/ui/LoadingState';
import { useToast } from '../../../components/ui/Toast.jsx';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';

const MIN_SUSPENSION_REASON_LENGTH = 10;

const AllOrganizationsList = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [suspendDialog, setSuspendDialog] = useState({ open: false, org: null });
  const [suspensionReason, setSuspensionReason] = useState('');
  const [activateDialog, setActivateDialog] = useState({ open: false, org: null });
  const { success: showSuccessToast, error: showErrorToast, warning: showWarningToast } = useToast();
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadOrganizationsRef = useRef(null);

  useEffect(() => {
    loadOrganizations();
  }, [statusFilter]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.listOrganizations(statusFilter, 100);
      if (result.success) {
        setOrganizations(result.organizations || []);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      showErrorToast('Failed to load organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizationsRef.current = loadOrganizations;
  }, [loadOrganizations]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadOrganizationsRef.current?.();
      }, 300);
    },
  });

  useEffect(
    () => () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
    },
    [],
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'PENDING':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300';
      case 'REJECTED':
        return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      case 'SUSPENDED':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (value) => {
    if (!value) return 'Not available';
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return 'Not available';
    return parsedDate.toLocaleDateString();
  };

  const handleViewDetails = async (org) => {
    try {
      const result = await apiClient.admin.getOrganization(org.id);
      if (result.success) {
        setSelectedOrg({ ...org, ...result.organization, stats: result.stats });
      }
    } catch (error) {
      console.error('Failed to load organization details:', error);
      showErrorToast('Failed to load organization details.');
    }
  };

  const applyOrganizationUpdate = (updatedOrganization) => {
    if (!updatedOrganization?.id) return;

    const normalizedStatus = (updatedOrganization.status || '').toUpperCase();

    setOrganizations((prev) => {
      const next = prev.map((org) => (
        org.id === updatedOrganization.id
          ? { ...org, ...updatedOrganization }
          : org
      ));

      if (statusFilter && statusFilter !== normalizedStatus) {
        return next.filter((org) => org.id !== updatedOrganization.id);
      }

      return next;
    });

    setSelectedOrg((prev) => {
      if (!prev || prev.id !== updatedOrganization.id) return prev;
      return { ...prev, ...updatedOrganization };
    });
  };

  const closeSuspendDialog = () => {
    if (actionLoading) return;
    setSuspendDialog({ open: false, org: null });
    setSuspensionReason('');
  };

  const openSuspendDialog = (org) => {
    setSuspendDialog({ open: true, org });
    setSuspensionReason('');
  };

  const openActivateDialog = (org) => {
    setActivateDialog({ open: true, org });
  };

  const closeActivateDialog = () => {
    if (actionLoading) return;
    setActivateDialog({ open: false, org: null });
  };

  const handleSuspendOrganization = async () => {
    const target = suspendDialog.org;
    if (!target || actionLoading) return;

    const trimmedReason = suspensionReason.trim();
    if (trimmedReason.length < MIN_SUSPENSION_REASON_LENGTH) {
      showWarningToast(`Please provide at least ${MIN_SUSPENSION_REASON_LENGTH} characters for the suspension reason.`);
      return;
    }

    try {
      setActionLoading(target.id);
      const result = await apiClient.admin.suspendOrganization(target.id, trimmedReason);
      if (!result?.success || !result.organization) {
        throw new Error('Failed to suspend organization.');
      }

      applyOrganizationUpdate(result.organization);
      setSuspendDialog({ open: false, org: null });
      setSuspensionReason('');
      showSuccessToast('Organization suspended successfully.');
    } catch (error) {
      console.error('Failed to suspend organization:', error);
      showErrorToast(error?.message || 'Failed to suspend organization.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivateOrganization = async () => {
    const target = activateDialog.org;
    if (!target || actionLoading) return;

    try {
      setActionLoading(target.id);
      const result = await apiClient.admin.activateOrganization(target.id);
      if (!result?.success || !result.organization) {
        throw new Error('Failed to reactivate organization.');
      }

      applyOrganizationUpdate(result.organization);
      setActivateDialog({ open: false, org: null });
      showSuccessToast('Organization reactivated successfully.');
    } catch (error) {
      console.error('Failed to reactivate organization:', error);
      showErrorToast(error?.message || 'Failed to reactivate organization.');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (!selectedOrg) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSelectedOrg(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [selectedOrg]);

  useEffect(() => {
    if (selectedOrg || !suspendDialog.open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedOrg, suspendDialog.open]);

  if (loading && organizations.length === 0) {
    return (
      <LoadingState
        title="Loading organizations"
        message="Retrieving organization directory."
        variant="card"
        tone="secondary"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              All Organizations
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {organizations.length} organization{organizations.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadOrganizations}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Button
            variant={statusFilter === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'PENDING' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === 'APPROVED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('APPROVED')}
          >
            Approved
          </Button>
          <Button
            variant={statusFilter === 'REJECTED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('REJECTED')}
          >
            Rejected
          </Button>
          <Button
            variant={statusFilter === 'SUSPENDED' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('SUSPENDED')}
          >
            Suspended
          </Button>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="Building" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400">
              {statusFilter ? `No ${statusFilter.toLowerCase()} organizations found.` : 'No organizations found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <motion.div
                key={org.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-900/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Icon name="Building" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                            {org.displayName || org.name}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(org.status)}`}>
                            {org.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          Owner: {org.owner?.fullName || org.owner?.email || 'Unknown'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                      {org.industry && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <Icon name="Briefcase" className="w-4 h-4" />
                          <span>{org.industry}</span>
                        </div>
                      )}
                      {org.companySize && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <Icon name="Users" className="w-4 h-4" />
                          <span>{org.companySize} employees</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                        <Icon name="Clock" className="w-4 h-4" />
                        <span>Registered {new Date(org.createdAt).toLocaleDateString()}</span>
                      </div>
                      {org.approvedAt && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                          <Icon name="CheckCircle" className="w-4 h-4" />
                          <span>Approved {new Date(org.approvedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewDetails(org)}
                    >
                      <Icon name="Info" className="w-4 h-4 mr-2" />
                      Details
                    </Button>

                    {org.status === 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openSuspendDialog(org)}
                        disabled={actionLoading === org.id}
                        className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                      >
                        <Icon name="PauseCircle" className="w-4 h-4 mr-2" />
                        Suspend
                      </Button>
                    )}

                    {org.status === 'SUSPENDED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openActivateDialog(org)}
                        disabled={actionLoading === org.id}
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                      >
                        <Icon name="PlayCircle" className="w-4 h-4 mr-2" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {typeof document !== 'undefined' && selectedOrg && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setSelectedOrg(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Organization details"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-white/40 dark:border-slate-700/60 shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
          >
            <div className="sticky top-0 z-10 px-6 py-5 border-b border-gray-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex-shrink-0">
                    <Icon name="Building" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 truncate">
                      {selectedOrg.displayName || selectedOrg.name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Organization Details
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(selectedOrg.status)}`}>
                    {selectedOrg.status || 'UNKNOWN'}
                  </span>
                  <button
                    onClick={() => setSelectedOrg(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label="Close organization details"
                  >
                    <Icon name="X" className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                  Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/40 p-4">
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Owner</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                      {selectedOrg.owner?.fullName || 'Not assigned'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                      {selectedOrg.owner?.email || 'No owner email'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/40 p-4">
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Industry</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-slate-100 capitalize">
                      {selectedOrg.industry || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/40 p-4">
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Company Size</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                      {selectedOrg.companySize || 'Not specified'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/40 p-4">
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Timeline</p>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        Registered: {formatDate(selectedOrg.createdAt)}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        Approved: {formatDate(selectedOrg.approvedAt)}
                      </p>
                      {selectedOrg.suspendedAt && (
                        <p className="text-sm text-orange-700 dark:text-orange-300">
                          Suspended: {formatDate(selectedOrg.suspendedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/40 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">
                    Moderation Actions
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrg.status)}`}>
                    {selectedOrg.status || 'UNKNOWN'}
                  </span>
                </div>

                {selectedOrg.status === 'APPROVED' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      This organization is active. Suspend access if policy violations are detected.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSuspendDialog(selectedOrg)}
                      disabled={actionLoading === selectedOrg.id}
                      className="border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
                    >
                      <Icon name="PauseCircle" className="w-4 h-4 mr-2" />
                      Suspend Organization
                    </Button>
                  </div>
                )}

                {selectedOrg.status === 'SUSPENDED' && (
                  <div className="space-y-2">
                    {selectedOrg.suspensionReason && (
                      <div className="rounded-lg border border-orange-200 dark:border-orange-900/40 bg-orange-50/70 dark:bg-orange-900/20 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                          Suspension reason
                        </p>
                        <p className="mt-1 text-sm text-orange-800 dark:text-orange-200 break-words">
                          {selectedOrg.suspensionReason}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 dark:text-slate-400">
                      Restore access once compliance issues have been resolved.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openActivateDialog(selectedOrg)}
                      disabled={actionLoading === selectedOrg.id}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                    >
                      <Icon name="PlayCircle" className="w-4 h-4 mr-2" />
                      Reactivate Organization
                    </Button>
                  </div>
                )}

                {selectedOrg.status !== 'APPROVED' && selectedOrg.status !== 'SUSPENDED' && (
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    Post-approval moderation actions are available after organization approval.
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                  Activity Statistics
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center p-4 rounded-xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30">
                    <div className="flex items-center justify-center mb-2">
                      <Icon name="Users" className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    </div>
                    <p className="text-3xl leading-none font-bold text-blue-600 dark:text-blue-400">
                      {selectedOrg.stats?.memberCount || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">Members</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-green-50/80 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30">
                    <div className="flex items-center justify-center mb-2">
                      <Icon name="Briefcase" className="w-4 h-4 text-green-500 dark:text-green-400" />
                    </div>
                    <p className="text-3xl leading-none font-bold text-green-600 dark:text-green-400">
                      {selectedOrg.stats?.jobCount || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">Jobs</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-purple-50/80 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30">
                    <div className="flex items-center justify-center mb-2">
                      <Icon name="MessageSquare" className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-3xl leading-none font-bold text-purple-600 dark:text-purple-400">
                      {selectedOrg.stats?.interviewCount || 0}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-2">Interviews</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {typeof document !== 'undefined' && suspendDialog.open && suspendDialog.org && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
          onClick={closeSuspendDialog}
          role="dialog"
          aria-modal="true"
          aria-label="Suspend organization"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-white/40 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-2xl"
          >
            <div className="px-6 py-5 border-b border-gray-200/70 dark:border-slate-700/70">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                    <Icon name="PauseCircle" className="w-5 h-5 text-orange-600 dark:text-orange-300" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      Suspend Organization
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                      {suspendDialog.org.displayName || suspendDialog.org.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeSuspendDialog}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  aria-label="Close suspend dialog"
                >
                  <Icon name="X" className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-slate-400">
                Provide a clear reason. This note is used for audit and support follow-up.
              </p>
              <textarea
                value={suspensionReason}
                onChange={(event) => setSuspensionReason(event.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Explain why this organization is being suspended..."
                disabled={actionLoading === suspendDialog.org.id}
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-60"
              />
              <p className="text-xs text-gray-500 dark:text-slate-500 text-right">
                {suspensionReason.trim().length}/{MIN_SUSPENSION_REASON_LENGTH} minimum
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-200/70 dark:border-slate-700/70 flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={closeSuspendDialog}
                disabled={actionLoading === suspendDialog.org.id}
                className="sm:flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSuspendOrganization}
                disabled={
                  actionLoading === suspendDialog.org.id
                  || suspensionReason.trim().length < MIN_SUSPENSION_REASON_LENGTH
                }
                className="sm:flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Icon name="PauseCircle" className="w-4 h-4 mr-2" />
                Suspend Access
              </Button>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      <ConfirmDialog
        open={activateDialog.open}
        onClose={closeActivateDialog}
        onConfirm={handleActivateOrganization}
        title={`Reactivate "${activateDialog.org?.displayName || activateDialog.org?.name || 'organization'}"?`}
        message="This will restore organization access and switch status back to APPROVED."
        confirmText="Reactivate"
        cancelText="Cancel"
        variant="info"
        isLoading={Boolean(activateDialog.org && actionLoading === activateDialog.org.id)}
      />
    </div>
  );
};

export default AllOrganizationsList;


