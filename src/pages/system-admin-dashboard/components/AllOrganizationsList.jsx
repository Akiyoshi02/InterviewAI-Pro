import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const AllOrganizationsList = () => {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);

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
    } finally {
      setLoading(false);
    }
  };

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

  if (loading && organizations.length === 0) {
    return (
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
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

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDetails(org)}
                    className="shrink-0"
                  >
                    <Icon name="Info" className="w-4 h-4 mr-2" />
                    Details
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedOrg && selectedOrg.stats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOrg(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto"
          >
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
                    <p className="text-xs text-gray-500 dark:text-slate-500">Status</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                      {selectedOrg.status}
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
                </div>
              </div>

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
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default AllOrganizationsList;


