import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LoadingState from '../../../components/ui/LoadingState';
import apiClient from '../../../services/apiClient.js';

const OrganizationApprovalQueue = ({ onApprovalChange }) => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveDialog, setApproveDialog] = useState({ open: false, org: null });
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    loadPendingOrganizations();
  }, []);

  const loadPendingOrganizations = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.listPendingOrganizations();
      if (result.success) {
        setOrganizations(result.organizations || []);
      }
    } catch (error) {
      console.error('Failed to load pending organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = (org) => {
    if (actionLoading) return;
    setApproveDialog({ open: true, org });
  };

  const handleApproveConfirm = async () => {
    if (!approveDialog.org || isApproving) return;

    try {
      setIsApproving(true);
      setActionLoading(approveDialog.org.id);
      const result = await apiClient.admin.approveOrganization(approveDialog.org.id);
      if (result.success) {
        // Remove from pending list
        setOrganizations(prev => prev.filter(o => o.id !== approveDialog.org.id));
        setApproveDialog({ open: false, org: null });
        if (onApprovalChange) onApprovalChange();
      } else {
        throw new Error('Failed to approve organization');
      }
    } catch (error) {
      console.error('Failed to approve organization:', error);
      setApproveDialog({ open: false, org: null });
      alert('Failed to approve organization. Please try again.');
    } finally {
      setIsApproving(false);
      setActionLoading(null);
    }
  };

  const handleApproveCancel = () => {
    setApproveDialog({ open: false, org: null });
  };

  const handleReject = (org) => {
    setSelectedOrg(org);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!selectedOrg || actionLoading) return;

    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }

    try {
      setActionLoading(selectedOrg.id);
      const result = await apiClient.admin.rejectOrganization(selectedOrg.id, rejectReason);
      if (result.success) {
        // Remove from pending list
        setOrganizations(prev => prev.filter(o => o.id !== selectedOrg.id));
        setShowRejectModal(false);
        setSelectedOrg(null);
        setRejectReason('');
        if (onApprovalChange) onApprovalChange();
      }
    } catch (error) {
      console.error('Failed to reject organization:', error);
      alert('Failed to reject organization. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (org) => {
    try {
      const result = await apiClient.admin.getOrganization(org.id);
      if (result.success) {
        setSelectedOrg({ ...org, ...result.organization, stats: result.stats });
      }
    } catch (error) {
      console.error('Failed to load organization details:', error);
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading approvals"
        message="Fetching pending organization requests."
        variant="card"
        tone="secondary"
      />
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="text-center py-12">
          <Icon name="CheckCircle" className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
            All Caught Up!
          </h3>
          <p className="text-gray-600 dark:text-slate-400">
            No pending organization approvals at this time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Pending Organization Approvals
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {organizations.length} organization{organizations.length !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadPendingOrganizations}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="space-y-4">
          {organizations.map((org) => (
            <motion.div
              key={org.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-900/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Icon name="Building" className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100 truncate">
                        {org.displayName || org.name}
                      </h3>
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
                    {org.memberCount > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
                        <Icon name="UserCheck" className="w-4 h-4" />
                        <span>{org.memberCount} member{org.memberCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(org)}
                    loading={actionLoading === org.id}
                    disabled={actionLoading === org.id}
                    className="bg-green-600 hover:bg-green-700 text-white min-w-[100px]"
                  >
                    <div className="flex items-center gap-2">
                      {actionLoading !== org.id && <Icon name="CheckCircle" className="w-4 h-4" />}
                      <span>{actionLoading === org.id ? 'Processing...' : 'Approve'}</span>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReject(org)}
                    disabled={actionLoading === org.id}
                    className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 min-w-[100px]"
                  >
                    <Icon name="XCircle" className="w-4 h-4 mr-2" />
                    Reject
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(org)}
                    className="min-w-[100px]"
                  >
                    <Icon name="Info" className="w-4 h-4 mr-2" />
                    Details
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && selectedOrg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !actionLoading && setShowRejectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <Icon name="AlertTriangle" className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1">
                    Reject Organization
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Rejecting: <strong>{selectedOrg.displayName || selectedOrg.name}</strong>
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a clear reason for rejection..."
                  rows={4}
                  disabled={actionLoading}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                />
                <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
                  This message will be visible to the organization owner.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => !actionLoading && setShowRejectModal(false)}
                  disabled={actionLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReject}
                  disabled={actionLoading || !rejectReason.trim()}
                  loading={actionLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      {selectedOrg && !showRejectModal && selectedOrg.stats && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedOrg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4"
              style={{ overflow: 'auto' }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm"
                onClick={() => setSelectedOrg(null)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-white/40 dark:border-slate-700/60 my-auto"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}
              >
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                        <Icon name="Building" className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                          {selectedOrg.displayName || selectedOrg.name}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          Organization Details
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedOrg(null)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <Icon name="X" className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-500">Owner</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {selectedOrg.owner?.fullName || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            {selectedOrg.owner?.email}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-500">Industry</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {selectedOrg.industry || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-500">Company Size</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {selectedOrg.companySize || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-slate-500">Registration Date</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {new Date(selectedOrg.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    {selectedOrg.stats && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                          Activity Statistics
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {selectedOrg.stats.memberCount || 0}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Members</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {selectedOrg.stats.jobCount || 0}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Jobs</p>
                          </div>
                          <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                              {selectedOrg.stats.interviewCount || 0}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-slate-400 mt-1">Interviews</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                      <Button
                        onClick={() => {
                          handleApprove(selectedOrg);
                        }}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Icon name="CheckCircle" className="w-4 h-4 mr-2" />
                        Approve Organization
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleReject(selectedOrg);
                        }}
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                      >
                        <Icon name="XCircle" className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={approveDialog.open}
        onClose={handleApproveCancel}
        onConfirm={handleApproveConfirm}
        title={`Approve organization "${approveDialog.org?.displayName || ''}"?`}
        message="This will grant them full access to the platform."
        confirmText="OK"
        cancelText="Cancel"
        variant="info"
        isLoading={isApproving || actionLoading === approveDialog.org?.id}
      />
    </div>
  );
};

export default OrganizationApprovalQueue;

