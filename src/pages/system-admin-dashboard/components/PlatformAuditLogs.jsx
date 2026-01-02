import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient.js';

const PlatformAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    loadAuditLogs();
  }, [offset]);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.getAuditLogs(limit, offset);
      if (result.success) {
        setLogs(result.logs || []);
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'ORG_APPROVED':
        return { name: 'CheckCircle', color: 'text-green-600 dark:text-green-400' };
      case 'ORG_REJECTED':
        return { name: 'XCircle', color: 'text-red-600 dark:text-red-400' };
      case 'ORG_SUSPENDED':
        return { name: 'AlertTriangle', color: 'text-orange-600 dark:text-orange-400' };
      case 'ORG_ACTIVATED':
        return { name: 'CheckCircle', color: 'text-blue-600 dark:text-blue-400' };
      case 'SETTINGS_UPDATED':
        return { name: 'Settings', color: 'text-purple-600 dark:text-purple-400' };
      case 'USER_SUSPENDED':
        return { name: 'UserX', color: 'text-red-600 dark:text-red-400' };
      case 'ADMIN_SEEDED':
        return { name: 'Shield', color: 'text-purple-600 dark:text-purple-400' };
      default:
        return { name: 'Activity', color: 'text-gray-600 dark:text-gray-400' };
    }
  };

  const getActionLabel = (action) => {
    return action
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatMetadata = (metadata) => {
    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    return (
      <div className="mt-2 text-xs text-gray-600 dark:text-slate-400 space-y-1">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <span className="font-medium">{key}:</span>
            <span className="truncate">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading && logs.length === 0) {
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
              Platform Audit Logs
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              System-level actions and administrative activities
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadAuditLogs}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <Icon name="RefreshCw" className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="FileText" className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-400">
              No audit logs available yet.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {logs.map((log, index) => {
                const icon = getActionIcon(log.action);
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-900/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-slate-800 shrink-0`}>
                        <Icon name={icon.name} className={`w-4 h-4 ${icon.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-slate-100">
                                {getActionLabel(log.action)}
                              </span>
                              {log.targetType && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                  {log.targetType}
                                </span>
                              )}
                            </div>
                            {(log.actor || log.actorId) && (
                              <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                                by {log.actor?.fullName || log.actor?.email || log.actorType || `Admin ${log.actorId || 'System'}`}
                              </p>
                            )}
                            {formatMetadata(log.metadata)}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {new Date(log.createdAt || log.timestamp).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-slate-500">
                              {new Date(log.createdAt || log.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-200 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                disabled={offset === 0 || loading}
              >
                <Icon name="ChevronLeft" className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600 dark:text-slate-400">
                Showing {offset + 1} - {offset + logs.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => prev + limit)}
                disabled={logs.length < limit || loading}
              >
                Next
                <Icon name="ChevronRight" className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100 mb-3">
          Action Types
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { action: 'ORG_APPROVED', description: 'Organization approval granted' },
            { action: 'ORG_REJECTED', description: 'Organization approval denied' },
            { action: 'ORG_SUSPENDED', description: 'Organization access suspended' },
            { action: 'ORG_ACTIVATED', description: 'Organization reactivated' },
            { action: 'SETTINGS_UPDATED', description: 'System settings modified' },
            { action: 'USER_SUSPENDED', description: 'User account suspended' },
          ].map(({ action, description }) => {
            const icon = getActionIcon(action);
            return (
              <div key={action} className="flex items-start gap-2 text-sm">
                <Icon name={icon.name} className={`w-4 h-4 mt-0.5 ${icon.color}`} />
                <div>
                  <p className="font-medium text-gray-900 dark:text-slate-100">
                    {getActionLabel(action)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlatformAuditLogs;

