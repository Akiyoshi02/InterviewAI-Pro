import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LoadingState from '../../../components/ui/LoadingState';
import { useToast } from '../../../components/ui/Toast.jsx';
import apiClient from '../../../services/apiClient.js';
import { useRealtimePathFeed } from '../../../hooks/useRealtimePathFeed';

const CHECK_STYLES = {
  pass: {
    border: 'border-emerald-200 dark:border-emerald-900/40',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'CheckCircle2',
  },
  warn: {
    border: 'border-amber-200 dark:border-amber-900/40',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'AlertTriangle',
  },
  fail: {
    border: 'border-red-200 dark:border-red-900/40',
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    icon: 'XCircle',
  },
  info: {
    border: 'border-blue-200 dark:border-blue-900/40',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    icon: 'Info',
  },
};

const RECOMMENDATION_STYLES = {
  ready: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: 'ShieldCheck',
  },
  caution: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: 'ShieldAlert',
  },
  high_risk: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-700 dark:text-red-300',
    icon: 'ShieldX',
  },
};

const normalizeStatus = (status) => (CHECK_STYLES[status] ? status : 'info');
const MIN_REJECTION_REASON_LENGTH = 15;
const MIN_REJECTION_TAG_OTHER_LENGTH = 3;
const MAX_REJECTION_TAGS = 4;
const MAX_REJECTION_OTHER_DETAILS = 8;
const OTHER_REJECTION_TAG = 'OTHER';
const DEFAULT_REJECTION_REASON_CODE = 'OTHER';
const REJECTION_REASON_PRESETS = [
  {
    code: 'DOCUMENT_MISSING',
    label: 'Missing/incomplete legal documents',
    helper: 'Business registration or authority proof is missing or incomplete.',
  },
  {
    code: 'DOCUMENT_MISMATCH',
    label: 'Registration details mismatch',
    helper: 'Submitted details conflict with the uploaded legal document.',
  },
  {
    code: 'IDENTITY_MISMATCH',
    label: 'Owner identity mismatch',
    helper: 'Owner/contact identity could not be confidently tied to the company.',
  },
  {
    code: 'DOMAIN_MISMATCH',
    label: 'Website/email domain mismatch',
    helper: 'Company website and email domains are inconsistent.',
  },
  {
    code: 'PUBLIC_EMAIL_DOMAIN',
    label: 'Public email provider used',
    helper: 'Company contact uses a public provider instead of a business domain.',
  },
  {
    code: 'INSUFFICIENT_PUBLIC_PRESENCE',
    label: 'Insufficient public footprint',
    helper: 'Public signals are too weak for trust verification.',
  },
  {
    code: 'HIGH_RISK_SIGNALS',
    label: 'High-risk signals detected',
    helper: 'Critical verification checks indicate elevated risk.',
  },
  {
    code: 'INCOMPLETE_REGISTRATION',
    label: 'Core registration fields missing',
    helper: 'Important company data is incomplete or inconsistent.',
  },
  {
    code: 'OTHER',
    label: 'Other',
    helper: 'Use a custom explanation when no standard category fits.',
  },
];

const REJECTION_PRESET_MAP = REJECTION_REASON_PRESETS.reduce((map, preset) => {
  map[preset.code] = preset;
  return map;
}, {});
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const isElementVisible = (element) => Boolean(
  element
  && (element.offsetWidth || element.offsetHeight || element.getClientRects().length),
);

const getFocusableElements = (container) => {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => isElementVisible(element) && element.getAttribute('aria-hidden') !== 'true');
};

const formatDate = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return 'Not provided';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not provided';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const getOrganizationStatusBadgeClass = (status) => {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
    case 'PENDING':
      return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
    case 'REJECTED':
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
    case 'SUSPENDED':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300';
    default:
      return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300';
  }
};

const getApiOrigin = () => {
  const fallback = 'http://localhost:3000';
  const apiUrl = import.meta.env.VITE_API_URL || fallback;
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : fallback;
  try {
    return new URL(apiUrl, browserOrigin).origin;
  } catch {
    return apiUrl.replace(/\/api\/?$/i, '').replace(/\/$/, '');
  }
};

const normalizeUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return `https://${value}`;
};

const normalizeAssetUrl = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const apiOrigin = getApiOrigin();
  if (trimmed.startsWith('/')) return `${apiOrigin}${trimmed}`;
  if (trimmed.startsWith('uploads/')) return `${apiOrigin}/${trimmed}`;
  return `https://${trimmed}`;
};

const summarizeCountryStatus = (value) => {
  switch (value) {
    case 'match':
      return 'Country matched';
    case 'mismatch':
      return 'Country mismatch';
    case 'missing_in_document':
      return 'Country not detected in document';
    case 'not_provided':
      return 'Country not provided by registrant';
    default:
      return 'Country check unavailable';
  }
};

const humanizeValue = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const DetailField = ({
  label,
  value,
  icon = 'Info',
  href = null,
  fullWidth = false,
  singleLine = false,
}) => {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== '';
  const rowClass = fullWidth ? 'sm:col-span-2' : '';
  const valueString = hasValue ? String(value) : '';

  return (
    <div className={`rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/60 p-3 ${rowClass}`}>
      <div className="flex items-start gap-2">
        <Icon name={icon} className="w-4 h-4 text-gray-400 dark:text-slate-500 mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-500">
            {label}
          </p>
          {hasValue ? (
            href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                title={valueString}
                className={`mt-1 block text-base font-medium text-blue-600 dark:text-blue-400 hover:underline ${singleLine ? 'truncate whitespace-nowrap overflow-hidden' : 'break-all'}`}
              >
                {value}
              </a>
            ) : (
              <p
                title={valueString}
                className={`mt-1 text-base font-medium text-gray-900 dark:text-slate-100 ${singleLine ? 'truncate whitespace-nowrap overflow-hidden' : 'break-words'}`}
              >
                {value}
              </p>
            )
          ) : (
            <p className="mt-1 text-base text-gray-500 dark:text-slate-500">Not provided</p>
          )}
        </div>
      </div>
    </div>
  );
};

const OrganizationApprovalQueue = ({ onApprovalChange }) => {
  const { success: showSuccessToast, error: showErrorToast, warning: showWarningToast } = useToast();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectReasonCode, setRejectReasonCode] = useState(DEFAULT_REJECTION_REASON_CODE);
  const [rejectReasonTags, setRejectReasonTags] = useState([]);
  const [rejectReasonTagOther, setRejectReasonTagOther] = useState('');
  const [rejectReasonTagOtherItems, setRejectReasonTagOtherItems] = useState([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approveDialog, setApproveDialog] = useState({ open: false, org: null });
  const [isApproving, setIsApproving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    risk: true,
    checklist: false,
  });
  const rejectModalRef = useRef(null);
  const detailsModalRef = useRef(null);
  const previousFocusedRef = useRef(null);
  const actionLoadingRef = useRef(actionLoading);
  const realtimeRefreshTimeoutRef = useRef(null);
  const loadPendingOrganizationsRef = useRef(null);

  useEffect(() => {
    loadPendingOrganizations();
  }, []);

  useEffect(() => {
    actionLoadingRef.current = actionLoading;
  }, [actionLoading]);

  useEffect(() => {
    setRejectReasonTags((prev) => prev.filter((tag) => tag !== rejectReasonCode));
  }, [rejectReasonCode]);

  useEffect(() => {
    if (!rejectReasonTags.includes(OTHER_REJECTION_TAG)) {
      setRejectReasonTagOther('');
      setRejectReasonTagOtherItems([]);
    }
  }, [rejectReasonTags]);

  const loadPendingOrganizations = async () => {
    try {
      setLoading(true);
      const result = await apiClient.admin.listPendingOrganizations();
      if (result.success) {
        setOrganizations(result.organizations || []);
      }
    } catch (error) {
      console.error('Failed to load pending organizations:', error);
      showErrorToast('Failed to load pending organizations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingOrganizationsRef.current = loadPendingOrganizations;
  }, [loadPendingOrganizations]);

  useRealtimePathFeed({
    path: 'adminFeeds/global',
    enabled: true,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }
      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        loadPendingOrganizationsRef.current?.();
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
        if (selectedOrg?.id === approveDialog.org.id) {
          setSelectedOrg(null);
        }
        setApproveDialog({ open: false, org: null });
        showSuccessToast('Organization approved successfully.');
        if (onApprovalChange) onApprovalChange();
      } else {
        throw new Error('Failed to approve organization');
      }
    } catch (error) {
      console.error('Failed to approve organization:', error);
      setApproveDialog({ open: false, org: null });
      showErrorToast(error?.message || 'Failed to approve organization. Please try again.');
    } finally {
      setIsApproving(false);
      setActionLoading(null);
    }
  };

  const handleApproveCancel = () => {
    setApproveDialog({ open: false, org: null });
  };

  const handleReject = (org) => {
    setRejectTarget(org);
    setRejectReason('');
    setRejectReasonCode(DEFAULT_REJECTION_REASON_CODE);
    setRejectReasonTags([]);
    setRejectReasonTagOther('');
    setRejectReasonTagOtherItems([]);
    setShowRejectModal(true);
  };

  const closeRejectModal = useCallback(() => {
    if (actionLoading) return;
    setShowRejectModal(false);
    setRejectTarget(null);
    setRejectReason('');
    setRejectReasonCode(DEFAULT_REJECTION_REASON_CODE);
    setRejectReasonTags([]);
    setRejectReasonTagOther('');
    setRejectReasonTagOtherItems([]);
  }, [actionLoading]);

  const addRejectReasonOtherDetail = () => {
    const trimmed = rejectReasonTagOther.trim();
    if (!trimmed) return;

    if (trimmed.length < MIN_REJECTION_TAG_OTHER_LENGTH) {
      showWarningToast(`Please provide at least ${MIN_REJECTION_TAG_OTHER_LENGTH} characters for each "Other" detail.`);
      return;
    }

    const normalized = trimmed.toLowerCase();
    const hasDuplicate = rejectReasonTagOtherItems.some((item) => item.toLowerCase() === normalized);
    if (hasDuplicate) {
      showWarningToast('This "Other" detail is already added.');
      return;
    }

    if (rejectReasonTagOtherItems.length >= MAX_REJECTION_OTHER_DETAILS) {
      showWarningToast(`You can add up to ${MAX_REJECTION_OTHER_DETAILS} custom "Other" details.`);
      return;
    }

    setRejectReasonTagOtherItems((prev) => [...prev, trimmed]);
    setRejectReasonTagOther('');
  };

  const removeRejectReasonOtherDetail = (detailToRemove) => {
    setRejectReasonTagOtherItems((prev) => prev.filter((item) => item !== detailToRemove));
  };

  const toggleRejectTag = (tagCode) => {
    setRejectReasonTags((prev) => {
      if (prev.includes(tagCode)) {
        return prev.filter((tag) => tag !== tagCode);
      }

      if (prev.length >= MAX_REJECTION_TAGS) {
        showWarningToast(`You can select up to ${MAX_REJECTION_TAGS} rejection tags.`);
        return prev;
      }

      return [...prev, tagCode];
    });
  };

  useEffect(() => {
    if (approveDialog.open) return undefined;

    const activeModal = showRejectModal ? rejectModalRef.current : selectedOrg ? detailsModalRef.current : null;
    if (!activeModal) return undefined;

    previousFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFirstElement = () => {
      const focusableElements = getFocusableElements(activeModal);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
        return;
      }
      activeModal.focus();
    };

    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(focusFirstElement);
    } else {
      focusFirstElement();
    }

    const handleKeyDown = (event) => {
      if (!activeModal) return;

      if (event.key === 'Escape') {
        if (actionLoadingRef.current) return;

        if (showRejectModal) {
          setShowRejectModal(false);
          setRejectTarget(null);
          setRejectReason('');
          setRejectReasonCode(DEFAULT_REJECTION_REASON_CODE);
          setRejectReasonTags([]);
          return;
        }

        if (selectedOrg) {
          setSelectedOrg(null);
        }
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(activeModal);
      if (focusableElements.length === 0) {
        event.preventDefault();
        activeModal.focus();
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;
      const focusInsideModal = activeElement instanceof Node && activeModal.contains(activeElement);

      if (event.shiftKey) {
        if (!focusInsideModal || activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus();
        }
        return;
      }

      if (!focusInsideModal || activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocusedRef.current && typeof previousFocusedRef.current.focus === 'function') {
        previousFocusedRef.current.focus();
      }
    };
  }, [showRejectModal, selectedOrg, approveDialog.open]);

  useEffect(() => {
    const shouldLockBody = showRejectModal || Boolean(selectedOrg);
    if (!shouldLockBody) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showRejectModal, selectedOrg]);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const confirmReject = async () => {
    if (!rejectTarget || actionLoading) return;

    const trimmedReason = rejectReason.trim();

    if (!trimmedReason) {
      showWarningToast('Please provide a reason for rejection.');
      return;
    }

    if (trimmedReason.length < MIN_REJECTION_REASON_LENGTH) {
      showWarningToast(`Please provide at least ${MIN_REJECTION_REASON_LENGTH} characters for the rejection reason.`);
      return;
    }

    const otherTagSelected = rejectReasonTags.includes(OTHER_REJECTION_TAG);
    const trimmedReasonTagOther = rejectReasonTagOther.trim();

    if (
      otherTagSelected
      && trimmedReasonTagOther
      && trimmedReasonTagOther.length < MIN_REJECTION_TAG_OTHER_LENGTH
      && rejectReasonTagOtherItems.length === 0
    ) {
      showWarningToast(`Please provide at least ${MIN_REJECTION_TAG_OTHER_LENGTH} characters for each "Other" detail.`);
      return;
    }

    let nextOtherItems = [...rejectReasonTagOtherItems];
    if (otherTagSelected && trimmedReasonTagOther.length >= MIN_REJECTION_TAG_OTHER_LENGTH) {
      const exists = nextOtherItems.some((item) => item.toLowerCase() === trimmedReasonTagOther.toLowerCase());
      if (!exists) {
        if (nextOtherItems.length >= MAX_REJECTION_OTHER_DETAILS) {
          showWarningToast(`You can add up to ${MAX_REJECTION_OTHER_DETAILS} custom "Other" details.`);
          return;
        }
        nextOtherItems.push(trimmedReasonTagOther);
      }
    }

    if (otherTagSelected && nextOtherItems.length === 0) {
      showWarningToast('Please add at least one "Other" supporting detail (press Enter or click Add).');
      return;
    }

    try {
      setActionLoading(rejectTarget.id);
      const rejectPayload = {
        reason: trimmedReason,
        reasonCode: rejectReasonCode || DEFAULT_REJECTION_REASON_CODE,
        reasonTags: rejectReasonTags,
      };
      if (otherTagSelected) {
        rejectPayload.reasonTagOther = nextOtherItems.join('; ');
      }

      const result = await apiClient.admin.rejectOrganization(rejectTarget.id, rejectPayload);
      if (result.success) {
        // Remove from pending list
        setOrganizations(prev => prev.filter(o => o.id !== rejectTarget.id));
        if (selectedOrg?.id === rejectTarget.id) {
          setSelectedOrg(null);
        }
        setShowRejectModal(false);
        setRejectTarget(null);
        setRejectReason('');
        setRejectReasonCode(DEFAULT_REJECTION_REASON_CODE);
        setRejectReasonTags([]);
        setRejectReasonTagOther('');
        setRejectReasonTagOtherItems([]);
        showSuccessToast('Organization rejected successfully.');
        if (onApprovalChange) onApprovalChange();
      }
    } catch (error) {
      console.error('Failed to reject organization:', error);
      showErrorToast(error?.message || 'Failed to reject organization. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (org) => {
    try {
      const result = await apiClient.admin.getOrganization(org.id);
      if (result.success) {
        const nextRiskFlags = Array.isArray(result.verification?.riskFlags)
          ? result.verification.riskFlags
          : [];
        setSelectedOrg({
          ...org,
          ...result.organization,
          owner: result.owner || org.owner || null,
          stats: result.stats || null,
          members: result.members || [],
          verification: result.verification || null,
        });
        setExpandedSections({
          risk: nextRiskFlags.length > 0,
          checklist: false,
        });
      }
    } catch (error) {
      console.error('Failed to load organization details:', error);
      showErrorToast('Failed to load organization details.');
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

  const verification = selectedOrg?.verification || {};
  const verificationSummary = verification.summary || { pass: 0, warn: 0, fail: 0, info: 0, total: 0 };
  const recommendation = verification.recommendation || {
    level: 'caution',
    label: 'Needs manual review',
    reason: 'Review all evidence before approving the organization.',
  };
  const recommendationStyle = RECOMMENDATION_STYLES[recommendation.level] || RECOMMENDATION_STYLES.caution;
  const verificationChecks = Array.isArray(verification.checks) ? verification.checks : [];
  const riskFlags = Array.isArray(verification.riskFlags) ? verification.riskFlags : [];
  const ownerProfile = verification.ownerProfile || selectedOrg?.owner || {};
  const organizationProfile = verification.organizationProfile || {};
  const evidence = verification.evidence || {};
  const insights = evidence?.verificationInsights && typeof evidence.verificationInsights === 'object'
    ? evidence.verificationInsights
    : null;
  const countrySignals = Array.isArray(insights?.detectedCountries) ? insights.detectedCountries : [];
  const socialLinks = organizationProfile?.socialLinks || {};
  const hasRiskFlags = riskFlags.length > 0;
  const hasVerificationChecks = verificationChecks.length > 0;
  const checklistColumnClass = hasRiskFlags ? 'xl:col-span-8' : 'xl:col-span-12';

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
                    {org.reReviewRequestedAt && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-300">
                        <Icon name="RotateCcw" className="w-4 h-4" />
                        <span>Re-review requested {formatDate(org.reReviewRequestedAt)}</span>
                      </div>
                    )}
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
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showRejectModal && rejectTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 sm:p-6"
              onClick={closeRejectModal}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                ref={rejectModalRef}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Reject organization"
                tabIndex={-1}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-white/40 dark:border-slate-700/60 shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto"
              >
                <div className="sticky top-0 z-10 px-7 sm:px-8 py-5 border-b border-gray-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                        <Icon name="AlertTriangle" className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 leading-tight">
                          Reject Organization
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {rejectTarget.displayName || rejectTarget.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={closeRejectModal}
                      disabled={actionLoading}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
                      aria-label="Close reject modal"
                    >
                      <Icon name="X" className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="p-7 sm:p-8 space-y-5">
                  <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-gray-50/70 dark:bg-slate-900/50 p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-500">Organization</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                          {rejectTarget.displayName || rejectTarget.name}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-500">Industry</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 capitalize">
                          {rejectTarget.industry || 'Not specified'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-slate-500">Current Status</p>
                        <span className={`inline-flex mt-1 px-2.5 py-1 rounded-full text-xs font-semibold ${getOrganizationStatusBadgeClass(rejectTarget.status || 'PENDING')}`}>
                          {rejectTarget.status || 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>

                <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/40 p-4">
                  <label className="block text-base font-medium text-gray-700 dark:text-slate-300 mb-2.5">
                    Primary rejection category *
                  </label>
                  <div className="relative group">
                    <select
                      value={rejectReasonCode}
                      onChange={(e) => setRejectReasonCode(e.target.value)}
                      disabled={actionLoading}
                      className="w-full appearance-none px-4 pr-12 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    >
                      {REJECTION_REASON_PRESETS.map((preset) => (
                        <option key={preset.code} value={preset.code}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="ChevronDown"
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-slate-400 pointer-events-none transition-transform duration-200 group-focus-within:rotate-180"
                    />
                  </div>
                  <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">
                    {REJECTION_PRESET_MAP[rejectReasonCode]?.helper || REJECTION_PRESET_MAP[DEFAULT_REJECTION_REASON_CODE].helper}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/40 p-4">
                  <label className="block text-base font-medium text-gray-700 dark:text-slate-300 mb-2.5">
                    Supporting tags (optional)
                  </label>
                  <div className="flex flex-wrap gap-2.5">
                    {REJECTION_REASON_PRESETS.filter(
                      (preset) => preset.code !== rejectReasonCode || preset.code === OTHER_REJECTION_TAG,
                    ).map((preset) => {
                      const selected = rejectReasonTags.includes(preset.code);
                      return (
                        <button
                          key={preset.code}
                          type="button"
                          onClick={() => toggleRejectTag(preset.code)}
                          disabled={actionLoading}
                          className={`px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
                            selected
                              ? 'border-purple-500 bg-purple-100 text-purple-700 dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/60'
                          } disabled:opacity-50`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    {rejectReasonTagOtherItems.map((detail) => (
                      <button
                        key={detail}
                        type="button"
                        onClick={() => removeRejectReasonOtherDetail(detail)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border text-sm font-medium border-purple-500 bg-purple-100 text-purple-700 hover:bg-purple-200 dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-900/60 transition-colors disabled:opacity-50"
                        title={`Remove ${detail}`}
                        aria-label={`Remove ${detail}`}
                      >
                        <span className="max-w-[16rem] truncate">{detail}</span>
                        <Icon name="X" size={12} />
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">
                    {rejectReasonTags.length}/{MAX_REJECTION_TAGS} selected{rejectReasonTagOtherItems.length > 0 ? ` | ${rejectReasonTagOtherItems.length} custom` : ''}
                  </p>
                  {rejectReasonTags.includes(OTHER_REJECTION_TAG) && (
                    <div className="mt-3.5">
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Other supporting tag detail *
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={rejectReasonTagOther}
                          onChange={(event) => setRejectReasonTagOther(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addRejectReasonOtherDetail();
                            }
                          }}
                          placeholder='Type detail and press "Enter"'
                          maxLength={2000}
                          disabled={actionLoading}
                          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="default"
                          onClick={addRejectReasonOtherDetail}
                          disabled={actionLoading || rejectReasonTagOther.trim().length < MIN_REJECTION_TAG_OTHER_LENGTH}
                          className="rounded-xl"
                        >
                          Add
                        </Button>
                      </div>
                      <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-500">
                        {rejectReasonTagOther.trim().length}/{MIN_REJECTION_TAG_OTHER_LENGTH} minimum | {rejectReasonTagOtherItems.length}/{MAX_REJECTION_OTHER_DETAILS} added
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/40 p-4">
                  <label className="block text-base font-medium text-gray-700 dark:text-slate-300 mb-2.5">
                    Reason for Rejection *
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Provide a clear reason for rejection..."
                    rows={5}
                    maxLength={2000}
                    disabled={actionLoading}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-base text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-sm text-gray-500 dark:text-slate-500">
                      This message will be visible to the organization owner.
                    </p>
                    <p className="text-sm text-gray-500 dark:text-slate-500">
                      {rejectReason.trim().length}/{MIN_REJECTION_REASON_LENGTH} minimum
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={closeRejectModal}
                    disabled={actionLoading}
                    className="flex-1 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={confirmReject}
                    size="lg"
                    disabled={
                      actionLoading
                      || rejectReason.trim().length < MIN_REJECTION_REASON_LENGTH
                      || (
                        rejectReasonTags.includes(OTHER_REJECTION_TAG)
                        && (
                          rejectReasonTagOtherItems.length === 0
                          && rejectReasonTagOther.trim().length < MIN_REJECTION_TAG_OTHER_LENGTH
                        )
                      )
                    }
                    loading={actionLoading === rejectTarget.id}
                    className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                  >
                    {actionLoading === rejectTarget.id ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Details Modal */}
      {selectedOrg && !showRejectModal && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedOrg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-6 sm:p-8"
              style={{ overflow: 'hidden' }}
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setSelectedOrg(null)}
                aria-hidden="true"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                ref={detailsModalRef}
                role="dialog"
                aria-modal="true"
                aria-label="Organization details"
                tabIndex={-1}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[90rem] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 my-6 sm:my-8"
                style={{ maxHeight: 'calc(100vh - 6rem)' }}
              >
              <div className="overflow-y-auto scrollbar-hide" style={{ maxHeight: 'calc(100vh - 6rem)' }}>
                <div className="sticky top-0 z-10 px-7 sm:px-8 py-5 border-b border-gray-200/70 dark:border-slate-700/70 bg-white/95 dark:bg-slate-800/95 backdrop-blur">
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
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getOrganizationStatusBadgeClass(selectedOrg.status || 'PENDING')}`}>
                        {selectedOrg.status || 'PENDING'}
                      </span>
                      <button
                        onClick={() => setSelectedOrg(null)}
                        aria-label="Close organization details"
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Icon name="X" className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-7 sm:p-8">

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                    <div className="xl:col-span-12 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/60 p-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                            Verification Readiness
                          </p>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mt-1">
                            {recommendation.label || 'Needs manual review'}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
                            {recommendation.reason || 'Review all evidence before approving this organization.'}
                          </p>
                        </div>
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${recommendationStyle.bg} ${recommendationStyle.text}`}>
                          <Icon name={recommendationStyle.icon} className="w-4 h-4" />
                          {recommendation.level === 'ready' ? 'Low Risk' : recommendation.level === 'high_risk' ? 'High Risk' : 'Review Needed'}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <div className="rounded-lg bg-white dark:bg-slate-800/80 p-3 border border-emerald-200/60 dark:border-emerald-900/40">
                          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{verificationSummary.pass || 0}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">Pass</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-slate-800/80 p-3 border border-amber-200/60 dark:border-amber-900/40">
                          <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{verificationSummary.warn || 0}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">Warnings</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-slate-800/80 p-3 border border-red-200/60 dark:border-red-900/40">
                          <p className="text-xl font-bold text-red-600 dark:text-red-400">{verificationSummary.fail || 0}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">Failed</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-slate-800/80 p-3 border border-blue-200/60 dark:border-blue-900/40">
                          <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{verificationSummary.info || 0}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">Info</p>
                        </div>
                        <div className="rounded-lg bg-white dark:bg-slate-800/80 p-3 border border-gray-200 dark:border-slate-700">
                          <p className="text-xl font-bold text-gray-800 dark:text-slate-100">{verificationSummary.total || 0}</p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">Total Checks</p>
                        </div>
                      </div>
                    </div>

                    {hasRiskFlags && (
                      <div className="xl:col-span-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 p-4">
                        <button
                          type="button"
                          onClick={() => toggleSection('risk')}
                          aria-expanded={expandedSections.risk}
                          aria-controls="risk-flags-panel"
                          className="w-full flex items-center justify-between gap-2 rounded-md px-1 py-1 text-left hover:bg-red-100/60 dark:hover:bg-red-900/30 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon name="AlertOctagon" className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <h3 className="text-base font-semibold text-red-700 dark:text-red-300">Risk Flags</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                              {riskFlags.length}
                            </span>
                            <Icon
                              name="ChevronDown"
                              className={`w-4 h-4 text-red-600 dark:text-red-300 transition-transform ${expandedSections.risk ? 'rotate-180' : ''}`}
                            />
                          </div>
                        </button>
                        {!expandedSections.risk && (
                          <p className="text-xs text-red-600/90 dark:text-red-300/90 mt-2 whitespace-nowrap">
                            Expand to view risk flags.
                          </p>
                        )}
                        {expandedSections.risk && (
                          <div id="risk-flags-panel" className="space-y-2 mt-2">
                            {riskFlags.map((flag, index) => (
                              <p
                                key={`${flag}-${index}`}
                                className="text-sm text-red-700 dark:text-red-300 rounded-md bg-red-100/80 dark:bg-red-900/30 px-2.5 py-2"
                              >
                                {index + 1}. {flag}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`${checklistColumnClass} rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50/70 dark:bg-slate-900/60`}>
                      <button
                        type="button"
                        onClick={() => toggleSection('checklist')}
                        aria-expanded={expandedSections.checklist}
                        aria-controls="verification-checklist-panel"
                        className="w-full flex items-center justify-between gap-2 flex-wrap mb-1 rounded-md px-1 py-1 text-left hover:bg-gray-100/70 dark:hover:bg-slate-800/80 transition-colors"
                      >
                        <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
                          Verification Checklist
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                            Pass {verificationSummary.pass || 0}
                          </span>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                            Warn {verificationSummary.warn || 0}
                          </span>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                            Fail {verificationSummary.fail || 0}
                          </span>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-slate-300">
                            {verificationSummary.total || verificationChecks.length || 0} checks
                          </span>
                          <Icon
                            name="ChevronDown"
                            className={`w-4 h-4 text-gray-500 dark:text-slate-300 transition-transform ${expandedSections.checklist ? 'rotate-180' : ''}`}
                          />
                        </div>
                      </button>
                      {!expandedSections.checklist && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                          Expand to review detailed checks.
                        </p>
                      )}
                      {expandedSections.checklist && (
                        <div id="verification-checklist-panel" className="space-y-2 mt-3">
                          {!hasVerificationChecks && (
                            <div className="rounded-xl border border-gray-200 dark:border-slate-700 p-3">
                              <p className="text-sm text-gray-600 dark:text-slate-400">
                                Checklist data is unavailable for this organization.
                              </p>
                            </div>
                          )}
                          {verificationChecks.map((check) => {
                            const status = normalizeStatus(check.status);
                            const style = CHECK_STYLES[status];
                            return (
                              <div key={check.id} className={`rounded-lg border p-3 ${style.border} ${style.bg}`}>
                                <div className="flex items-start gap-3">
                                  <Icon name={style.icon} className={`w-5 h-5 mt-0.5 ${style.text}`} />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-base font-semibold text-gray-900 dark:text-slate-100">{check.label}</p>
                                      <span className={`text-[11px] font-semibold uppercase tracking-wide ${style.text}`}>
                                        {status}
                                      </span>
                                    </div>
                                    <p className="text-base text-gray-700 dark:text-slate-300 mt-1">{check.details}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="xl:col-span-6 rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50/70 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
                            Company Profile
                          </h3>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-slate-300">
                            Registration Data
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-row-dense sm:auto-rows-fr gap-3">
                          <DetailField
                            label="Legal Name"
                            value={organizationProfile.legalName || selectedOrg.name}
                            icon="Building2"
                            singleLine
                          />
                          <DetailField
                            label="Display Name"
                            value={organizationProfile.displayName || selectedOrg.displayName}
                            icon="BadgeInfo"
                            singleLine
                          />
                          <DetailField
                            label="Industry"
                            value={humanizeValue(organizationProfile.industry || selectedOrg.industry)}
                            icon="Briefcase"
                            singleLine
                          />
                          <DetailField
                            label="Company Size"
                            value={organizationProfile.companySize || selectedOrg.companySize}
                            icon="Users"
                            singleLine
                          />
                          <DetailField
                            label="Company Type"
                            value={humanizeValue(organizationProfile.companyType)}
                            icon="Building"
                            singleLine
                          />
                          <DetailField
                            label="Monthly Hiring Volume"
                            value={organizationProfile.hiringVolume || ownerProfile.hiringVolume}
                            icon="TrendingUp"
                            singleLine
                          />
                          <DetailField
                            label="Established Year"
                            value={organizationProfile.establishedYear}
                            icon="CalendarDays"
                            singleLine
                          />
                          <DetailField
                            label="Registration Number"
                            value={organizationProfile.registrationNumber}
                            icon="Fingerprint"
                            singleLine
                          />
                          <DetailField
                            label="Last Rejection Category"
                            value={humanizeValue(selectedOrg.rejectedReasonCode)}
                            icon="AlertOctagon"
                            singleLine
                          />
                          <DetailField
                            label="Last Rejection Tags"
                            value={Array.isArray(selectedOrg.rejectedReasonTags) && selectedOrg.rejectedReasonTags.length
                              ? selectedOrg.rejectedReasonTags.map((tag) => humanizeValue(tag)).join(', ')
                              : null}
                            icon="Tags"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label='Last "Other" Tag Detail'
                            value={selectedOrg.rejectedReasonTagOther}
                            icon="MessageSquareText"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Company Website"
                            value={organizationProfile.website}
                            href={normalizeUrl(organizationProfile.website)}
                            icon="Globe"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Company Location"
                            value={organizationProfile.location || ownerProfile.companyLocation}
                            icon="MapPin"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Physical Address"
                            value={organizationProfile.address}
                            icon="MapPinned"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Registered On"
                            value={formatDate(selectedOrg.createdAt)}
                            icon="Clock3"
                            fullWidth
                            singleLine
                          />
                        </div>

                        <div className="mt-3">
                          <DetailField
                            label="Company Description"
                            value={organizationProfile.description}
                            icon="FileText"
                          />
                        </div>
                      </div>

                      <div className="xl:col-span-6 rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50/70 dark:bg-slate-900/60">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
                            Owner and Contact
                          </h3>
                          <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-slate-300">
                            Account Data
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-flow-row-dense sm:auto-rows-fr gap-3">
                          <DetailField
                            label="Owner Name"
                            value={ownerProfile.fullName || selectedOrg.owner?.fullName}
                            icon="UserRound"
                            singleLine
                          />
                          <DetailField
                            label="Account Created"
                            value={formatDate(ownerProfile.accountCreatedAt)}
                            icon="CalendarClock"
                            singleLine
                          />
                          <DetailField
                            label="Re-review Requested"
                            value={formatDateTime(selectedOrg.reReviewRequestedAt)}
                            icon="RotateCcw"
                            singleLine
                          />
                          <DetailField
                            label="Owner Email"
                            value={ownerProfile.email || selectedOrg.owner?.email}
                            icon="Mail"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Company Email"
                            value={ownerProfile.companyEmail}
                            icon="MailCheck"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Company Phone Number"
                            value={ownerProfile.phoneNumber}
                            icon="Phone"
                            singleLine
                          />
                          <DetailField
                            label="Job Title"
                            value={ownerProfile.jobTitle}
                            icon="IdCard"
                            singleLine
                          />
                          <DetailField
                            label="Department"
                            value={humanizeValue(ownerProfile.department)}
                            icon="UsersRound"
                            singleLine
                          />
                          <DetailField
                            label="YouTube"
                            value={socialLinks.youtube}
                            href={normalizeUrl(socialLinks.youtube)}
                            icon="Youtube"
                            singleLine
                          />
                          <DetailField
                            label="LinkedIn"
                            value={socialLinks.linkedin}
                            href={normalizeUrl(socialLinks.linkedin)}
                            icon="Linkedin"
                            fullWidth
                            singleLine
                          />
                          <DetailField
                            label="Facebook"
                            value={socialLinks.facebook}
                            href={normalizeUrl(socialLinks.facebook)}
                            icon="Facebook"
                            fullWidth
                            singleLine
                          />
                        </div>

                        {selectedOrg.reReviewRequestNote && (
                          <div className="mt-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/20 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                              Re-review request note
                            </p>
                            <p className="mt-1 text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
                              {selectedOrg.reReviewRequestNote}
                            </p>
                          </div>
                        )}
                      </div>

                    <div className="xl:col-span-12 rounded-xl border border-gray-200 dark:border-slate-700 p-4 bg-gray-50/70 dark:bg-slate-900/60">
                      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-gray-700 dark:text-slate-300">
                          Evidence and Documents
                        </h3>
                        <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 dark:bg-slate-700/80 text-gray-600 dark:text-slate-300">
                          Auto checks
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DetailField
                          label="Company Logo"
                          value={evidence.companyLogoUrl ? 'Provided' : 'Not provided'}
                          icon="Image"
                          singleLine
                        />
                        <DetailField
                          label="Verification File"
                          value={evidence.verificationDocumentName}
                          icon="FileText"
                          singleLine
                        />
                        <DetailField
                          label="Document Hash"
                          value={evidence.verificationDocumentHash || 'Not available'}
                          icon="Fingerprint"
                          fullWidth
                          singleLine
                        />
                        <DetailField
                          label="Country Check"
                          value={summarizeCountryStatus(insights?.countryMatchStatus)}
                          icon="MapPin"
                          singleLine
                        />
                        <DetailField
                          label="Document Date"
                          value={formatDateTime(insights?.mostRecentDate)}
                          icon="CalendarClock"
                          singleLine
                        />
                        <DetailField
                          label="Detected Countries"
                          value={countrySignals.length ? countrySignals.join(', ') : 'None detected'}
                          icon="Globe"
                          fullWidth
                          singleLine
                        />
                      </div>
                      <div className="flex flex-wrap justify-center gap-2 pt-3">
                        {evidence.verificationDocumentUrl && (
                          <a
                            href={normalizeAssetUrl(evidence.verificationDocumentUrl)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center min-w-[220px] gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-blue-500 bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-blue-400 dark:bg-blue-500 dark:hover:bg-blue-400 dark:text-slate-900 dark:focus-visible:ring-offset-slate-900"
                          >
                            <Icon name="FileText" className="w-4 h-4" />
                            Open Verification Document
                          </a>
                        )}
                        {evidence.companyLogoUrl && (
                          <a
                            href={normalizeAssetUrl(evidence.companyLogoUrl)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center min-w-[220px] gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-violet-500 bg-violet-600 text-white shadow-sm hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-violet-400 dark:bg-violet-500 dark:hover:bg-violet-400 dark:text-slate-900 dark:focus-visible:ring-offset-slate-900"
                          >
                            <Icon name="Image" className="w-4 h-4" />
                            Open Company Logo
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="xl:col-span-12 flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                      <Button
                        onClick={() => {
                          handleApprove(selectedOrg);
                        }}
                        className="sm:flex-1 bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Icon name="CheckCircle" className="w-4 h-4 mr-2" />
                        Approve Organization
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleReject(selectedOrg);
                        }}
                        className="sm:flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
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

