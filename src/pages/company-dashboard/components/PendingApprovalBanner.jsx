import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../../../components/AppIcon';

const PendingApprovalBanner = ({ organization }) => {
  if (!organization || organization.status !== 'PENDING') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 sm:mb-6"
    >
      <div className="rounded-2xl border-2 border-yellow-400 dark:border-yellow-600 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 p-4 sm:p-6 shadow-lg">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="shrink-0">
            <div className="p-2 sm:p-3 rounded-full bg-yellow-400/20 dark:bg-yellow-600/20">
              <Icon name="Clock" className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-700 dark:text-yellow-400 animate-pulse" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-yellow-900 dark:text-yellow-100 mb-1 sm:mb-2">
              Organization Approval Pending
            </h3>
            <p className="text-sm sm:text-base text-yellow-800 dark:text-yellow-200 mb-3 sm:mb-4">
              Your organization registration is under review by our system administrators. You can view your organization settings but cannot create jobs or send interview invitations until approval is granted.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                <Icon name="CheckCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✓ View organization details and settings</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                <Icon name="CheckCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✓ View organization members</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-700 dark:text-yellow-300">
                <Icon name="CheckCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✓ Browse existing jobs (if any)</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 opacity-60">
                <Icon name="XCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✗ Create or modify jobs</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 opacity-60">
                <Icon name="XCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✗ Send interview invitations</span>
              </div>
              <div className="flex items-start gap-2 text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 opacity-60">
                <Icon name="XCircle" className="w-4 h-4 shrink-0 mt-0.5" />
                <span>✗ Manage team members</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/50 dark:bg-slate-900/30 border border-yellow-300 dark:border-yellow-700">
              <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                <Icon name="Info" className="w-4 h-4 inline mr-1" />
                What happens next?
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Our team will review your organization details and verify your business documentation. This typically takes 1-2 business days. You'll receive an email notification once your organization is approved.
              </p>
            </div>

            {organization.createdAt && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">
                Registered on {new Date(organization.createdAt).toLocaleDateString()} at {new Date(organization.createdAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PendingApprovalBanner;

