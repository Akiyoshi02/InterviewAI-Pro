import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import MaintenanceBanner from '../../components/ui/MaintenanceBanner';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import LoadingState from '../../components/ui/LoadingState';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useMaintenanceMode } from '../../hooks/useMaintenanceMode';
import apiClient from '../../services/apiClient.js';
import CompanyDirectoryProfilePreview from '../../components/company/CompanyDirectoryProfilePreview';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_BASE_URL = API_URL.replace(/\/$/, '');
const FIREBASE_STORAGE_BUCKET = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';

const normalizeUploadsPath = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.startsWith('uploads/')) return `/${trimmed}`;

  if (lower.startsWith('company-logos/') || lower.startsWith('company-covers/')) {
    return `/uploads/${trimmed}`;
  }

  return '';
};

const buildAssetSources = (value) => {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return [trimmed];
  }

  const uploadsPath = normalizeUploadsPath(trimmed);
  if (uploadsPath) {
    const sources = [];
    if (API_BASE_URL) sources.push(`${API_BASE_URL}${uploadsPath}`);
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (origin && origin !== API_BASE_URL) {
        sources.push(`${origin}${uploadsPath}`);
      }
    }
    return sources;
  }

  if (trimmed.startsWith('gs://')) {
    const match = trimmed.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (match) {
      const [, bucket, objectPath] = match;
      return [
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media`,
      ];
    }
  }

  if (FIREBASE_STORAGE_BUCKET && !trimmed.startsWith('/')) {
    return [
      `https://firebasestorage.googleapis.com/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodeURIComponent(trimmed)}?alt=media`,
    ];
  }

  return [`${API_BASE_URL}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`];
};

const getAuthToken = async () => {
  try {
    const { authHelpers } = await import('../../config/firebase.js');
    return await authHelpers.getAccessToken();
  } catch {
    return null;
  }
};

const isHexColor = (value) => /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(String(value || '').trim());
const formatFileSize = (bytes = 0) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
const FACEBOOK_COVER = {
  width: 820,
  height: 312,
};
const FACEBOOK_COVER_ASPECT = FACEBOOK_COVER.width / FACEBOOK_COVER.height;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CROP_CONFIG = {
  cover: {
    title: 'Crop Cover Image',
    aspect: FACEBOOK_COVER_ASPECT,
    targetWidth: FACEBOOK_COVER.width,
    targetHeight: FACEBOOK_COVER.height,
  },
};

const WORK_MODEL_OPTIONS = [
  { value: '', label: 'Select work model' },
  { value: 'REMOTE', label: 'Remote' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'ONSITE', label: 'Onsite' },
  { value: 'FLEXIBLE', label: 'Flexible' },
];

const formatIndustryLabel = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    !normalized ||
    normalized === 'technology' ||
    normalized === 'technology & software' ||
    normalized === 'tech' ||
    normalized === 'it' ||
    normalized === 'information technology' ||
    normalized.includes('software')
  ) {
    return 'Technology & Software';
  }

  return value;
};

const PRIORITY_PROFILE_FIELDS = [
  { key: 'tagline', label: 'Tagline' },
  { key: 'location', label: 'Location' },
  { key: 'workModel', label: 'Work model' },
  { key: 'hiringTimeline', label: 'Hiring timeline' },
  { key: 'responseTime', label: 'Response time' },
  { key: 'hiringProcess', label: 'Hiring process' },
  { key: 'about', label: 'About' },
  { key: 'benefits', label: 'Benefits & perks' },
];

const loadImage = (fileOrBlobUrl) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load image for cropping.'));
  image.src = fileOrBlobUrl;
});

const canvasToFile = (canvas, fileName, type, quality = 0.92) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => {
    if (!blob) {
      reject(new Error('Failed to generate cropped image.'));
      return;
    }
    resolve(new File([blob], fileName, { type: blob.type || type, lastModified: Date.now() }));
  }, type, quality);
});

const getCroppedImageFile = async ({
  file,
  zoom,
  offsetX,
  offsetY,
  targetWidth,
  targetHeight,
  preferType,
}) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable.');

    const baseScale = Math.max(targetWidth / image.width, targetHeight / image.height);
    const scaledWidth = image.width * baseScale * zoom;
    const scaledHeight = image.height * baseScale * zoom;
    const maxShiftX = Math.max(0, (scaledWidth - targetWidth) / 2);
    const maxShiftY = Math.max(0, (scaledHeight - targetHeight) / 2);

    const drawX = (targetWidth - scaledWidth) / 2 + (clamp(offsetX, -100, 100) / 100) * maxShiftX;
    const drawY = (targetHeight - scaledHeight) / 2 + (clamp(offsetY, -100, 100) / 100) * maxShiftY;

    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

    const originalName = file.name?.replace(/\.[^.]+$/, '') || 'image';
    const outputType = preferType || file.type || 'image/png';
    const extension = outputType === 'image/jpeg'
      ? 'jpg'
      : outputType === 'image/webp'
        ? 'webp'
        : 'png';

    return await canvasToFile(canvas, `${originalName}-cropped.${extension}`, outputType);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const ImageCropModal = ({
  open,
  title,
  file,
  aspect,
  onCancel,
  onUseOriginal,
  onApply,
  isApplying,
}) => {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  const frameRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  }, [open, file]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!open || !file) return null;

  const startDrag = (event) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offsetX,
      baseY: offsetY,
      width: rect.width,
      height: rect.height,
    };
  };

  const handleDrag = (event) => {
    if (!dragRef.current) return;
    const { startX, startY, baseX, baseY, width, height } = dragRef.current;
    const deltaX = ((event.clientX - startX) / Math.max(width, 1)) * 100;
    const deltaY = ((event.clientY - startY) / Math.max(height, 1)) * 100;
    setOffsetX(clamp(baseX + deltaX * 2, -100, 100));
    setOffsetY(clamp(baseY + deltaY * 2, -100, 100));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-white/20 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label="Close crop modal"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div
            ref={frameRef}
            className="relative overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-slate-950 cursor-move touch-none select-none"
            style={{ aspectRatio: `${aspect}` }}
            onPointerDown={startDrag}
            onPointerMove={handleDrag}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
          >
            <img
              src={previewUrl}
              alt="Crop preview"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                transform: `translate(${offsetX}%, ${offsetY}%) scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            />
            <div className="absolute inset-0 border-2 border-white/70 pointer-events-none" />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-gray-700 dark:text-slate-300">
              Zoom ({zoom.toFixed(2)}x)
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-xs text-gray-700 dark:text-slate-300">
              Horizontal
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetX}
                onChange={(event) => setOffsetX(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-xs text-gray-700 dark:text-slate-300">
              Vertical
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={offsetY}
                onChange={(event) => setOffsetY(Number(event.target.value))}
                className="mt-1 w-full"
              />
            </label>
          </div>

          <div className="flex flex-wrap justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setZoom(1);
                setOffsetX(0);
                setOffsetY(0);
              }}
            >
              Reset
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onUseOriginal} disabled={isApplying}>
                Use Original
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApply({ zoom, offsetX, offsetY })}
                disabled={isApplying}
              >
                {isApplying ? 'Applying...' : 'Apply Crop'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EMPTY_FORM = {
  tagline: '',
  about: '',
  mission: '',
  culture: '',
  website: '',
  location: '',
  workModel: '',
  hiringProcess: '',
  hiringTimeline: '',
  responseTime: '',
  coverUrl: '',
  coverColor: '#3b82f6',
  benefits: '',
  techStack: '',
  socialLinks: { linkedin: '', twitter: '', github: '' },
  profilePublic: true,
};

const CompanyPublicProfileEditorPage = () => {
  const { user, logout, setAuthenticatedUser, status } = useAuth();
  const { maintenanceMode } = useMaintenanceMode();
  const navigate = useNavigate();
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showInlinePreview, setShowInlinePreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUploadState, setLogoUploadState] = useState({ type: '', text: '' });
  const [isSavingLogo, setIsSavingLogo] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverUploadState, setCoverUploadState] = useState({ type: '', text: '' });
  const [isSavingCover, setIsSavingCover] = useState(false);
  const [cropModal, setCropModal] = useState({ open: false, target: null, file: null });
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [logoSourceFailed, setLogoSourceFailed] = useState(false);
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const isAdmin = user?.organizationContext?.membership?.role === 'ADMIN';

  const logoUrl =
    user?.companyLogoUrl
    || user?.organizationContext?.organization?.branding?.logoUrl
    || user?.organizationContext?.organization?.logo
    || '';

  const logoSources = useMemo(() => buildAssetSources(logoUrl), [logoUrl]);
  const selectedLogoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : ''),
    [logoFile]
  );
  const fallbackLogoSource = logoSourceFailed ? '' : (logoSources[logoSourceIndex] || '');
  const resolvedLogoSrc = selectedLogoPreview || fallbackLogoSource;

  const coverSources = useMemo(() => buildAssetSources(form.coverUrl), [form.coverUrl]);
  const selectedCoverPreview = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : ''),
    [coverFile]
  );
  const resolvedCoverSrc = selectedCoverPreview || coverSources[0] || '';
  const coverBackgroundColor = isHexColor(form.coverColor) ? form.coverColor : '#3b82f6';
  const missingPriorityFields = useMemo(
    () => PRIORITY_PROFILE_FIELDS
      .filter(({ key }) => String(form[key] || '').trim().length === 0)
      .map(({ label }) => label),
    [form]
  );
  const completedPriorityFieldCount = PRIORITY_PROFILE_FIELDS.length - missingPriorityFields.length;
  const profileCompletionPercent = Math.round(
    (completedPriorityFieldCount / Math.max(PRIORITY_PROFILE_FIELDS.length, 1)) * 100
  );
  const liveBenefits = useMemo(
    () => form.benefits.split(',').map((value) => value.trim()).filter(Boolean),
    [form.benefits]
  );
  const liveTechStack = useMemo(
    () => form.techStack.split(',').map((value) => value.trim()).filter(Boolean),
    [form.techStack]
  );
  const previewCompany = useMemo(() => {
    const org = user?.organizationContext?.organization || {};

    return {
      ...(profileSnapshot || {}),
      name: org.name || profileSnapshot?.name || user?.companyName || 'Your company',
      displayName:
        org.displayName
        || org.name
        || profileSnapshot?.displayName
        || profileSnapshot?.name
        || user?.companyName
        || 'Your company',
      industry: formatIndustryLabel(org.industry || profileSnapshot?.industry || 'Technology & Software'),
      companySize: org.companySize || profileSnapshot?.companySize || '',
      website: form.website || '',
      location: form.location || '',
      tagline: form.tagline || '',
      about: form.about || '',
      mission: form.mission || '',
      culture: form.culture || '',
      workModel: form.workModel || '',
      hiringProcess: form.hiringProcess || '',
      hiringTimeline: form.hiringTimeline || '',
      responseTime: form.responseTime || '',
      benefits: liveBenefits,
      techStack: liveTechStack,
      socialLinks: form.socialLinks || {},
      logoUrl: resolvedLogoSrc || profileSnapshot?.logoUrl || '',
      coverUrl: resolvedCoverSrc || form.coverUrl || profileSnapshot?.coverUrl || '',
      coverColor: coverBackgroundColor,
      memberSince: profileSnapshot?.memberSince || org.createdAt || profileSnapshot?.createdAt || null,
      openJobsCount: Number.isFinite(Number(profileSnapshot?.openJobsCount))
        ? Number(profileSnapshot.openJobsCount)
        : (Array.isArray(profileSnapshot?.openJobs) ? profileSnapshot.openJobs.length : 0),
      openJobs: Array.isArray(profileSnapshot?.openJobs) ? profileSnapshot.openJobs : [],
    };
  }, [
    user,
    profileSnapshot,
    form,
    liveBenefits,
    liveTechStack,
    resolvedLogoSrc,
    resolvedCoverSrc,
    coverBackgroundColor,
  ]);

  useEffect(() => () => {
    if (selectedLogoPreview) {
      URL.revokeObjectURL(selectedLogoPreview);
    }
    if (selectedCoverPreview) {
      URL.revokeObjectURL(selectedCoverPreview);
    }
  }, [selectedLogoPreview, selectedCoverPreview]);

  useEffect(() => {
    setLogoSourceIndex(0);
    setLogoSourceFailed(false);
  }, [logoSources]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const authToken = await getAuthToken();
        if (!authToken) {
          setMsg({ type: 'error', text: 'Missing session token. Please sign in again.' });
          return;
        }

        const res = await fetch(`${API_URL}/api/companies/me/profile`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
        const data = await res.json();

        if (data.success && data.company) {
          const c = data.company;
          setProfileSnapshot(c);
          setForm({
            tagline: c.tagline || '',
            about: c.about || '',
            mission: c.mission || '',
            culture: c.culture || '',
            website: c.website || '',
            location: c.location || '',
            workModel: c.workModel || '',
            hiringProcess: c.hiringProcess || '',
            hiringTimeline: c.hiringTimeline || '',
            responseTime: c.responseTime || '',
            coverUrl: c.coverUrl || '',
            coverColor: c.coverColor || '#3b82f6',
            benefits: (c.benefits || []).join(', '),
            techStack: (c.techStack || []).join(', '),
            socialLinks: {
              linkedin: c.socialLinks?.linkedin || '',
              twitter: c.socialLinks?.twitter || '',
              github: c.socialLinks?.github || '',
            },
            profilePublic: c.profilePublic !== false,
          });
        }
      } catch {
        // ignore load failure; form remains editable
      } finally {
        setLoading(false);
      }
    };

    if (isAdmin) {
      load();
    }
  }, [isAdmin]);

  const handleLogoError = () => {
    if (selectedLogoPreview) return;
    if (logoSourceIndex < logoSources.length - 1) {
      setLogoSourceIndex((prev) => prev + 1);
      return;
    }
    setLogoSourceFailed(true);
  };

  const openCropModal = (target, file) => {
    setCropModal({ open: true, target, file });
  };

  const closeCropModal = () => {
    setCropModal({ open: false, target: null, file: null });
    setIsApplyingCrop(false);
  };

  const handleApplyCrop = async ({ zoom, offsetX, offsetY }) => {
    if (!cropModal.file || !cropModal.target) return;
    setIsApplyingCrop(true);
    try {
      if (cropModal.target !== 'cover') throw new Error('Unsupported crop target.');
      const config = CROP_CONFIG.cover;
      const preferType = cropModal.file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

      const croppedFile = await getCroppedImageFile({
        file: cropModal.file,
        zoom,
        offsetX,
        offsetY,
        targetWidth: config.targetWidth,
        targetHeight: config.targetHeight,
        preferType,
      });

      setCoverFile(croppedFile);
      setCoverUploadState({ type: '', text: '' });

      closeCropModal();
    } catch (error) {
      setCoverUploadState({ type: 'error', text: error?.message || 'Failed to crop cover image.' });
      setIsApplyingCrop(false);
    }
  };

  const handleUseOriginalImage = () => {
    if (!cropModal.file || !cropModal.target) return;
    setCoverFile(cropModal.file);
    setCoverUploadState({ type: '', text: '' });
    closeCropModal();
  };

  const handleLogoPick = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    const maxBytes = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setLogoUploadState({ type: 'error', text: 'Logo must be JPG, PNG, WEBP, or SVG.' });
      event.target.value = '';
      return;
    }

    if (file.size > maxBytes) {
      setLogoUploadState({ type: 'error', text: 'Logo must be 5 MB or less.' });
      event.target.value = '';
      return;
    }

    setLogoFile(file);
    setLogoUploadState({ type: '', text: '' });
  };

  const handleSaveLogo = async ({ showStatus = true } = {}) => {
    if (!logoFile) return true;
    setIsSavingLogo(true);
    if (showStatus) {
      setLogoUploadState({ type: '', text: '' });
    }
    let success = false;

    try {
      const response = await apiClient.auth.updateCompanyLogo(logoFile);
      if (!response?.success || !response?.user) {
        throw new Error('Failed to update company logo.');
      }
      setAuthenticatedUser(response.user);
      setLogoFile(null);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
      if (showStatus) {
        setLogoUploadState({ type: 'success', text: 'Company logo updated.' });
      }
      success = true;
    } catch (error) {
      setLogoUploadState({
        type: 'error',
        text: error?.message || 'Failed to update company logo.',
      });
    } finally {
      setIsSavingLogo(false);
    }

    return success;
  };

  const handleCoverPick = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes = 8 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      setCoverUploadState({ type: 'error', text: 'Cover must be JPG, PNG, or WEBP.' });
      event.target.value = '';
      return;
    }

    if (file.size > maxBytes) {
      setCoverUploadState({ type: 'error', text: 'Cover must be 8 MB or less.' });
      event.target.value = '';
      return;
    }

    openCropModal('cover', file);
    setCoverUploadState({ type: '', text: '' });
  };

  const handleSaveCover = async ({ showStatus = true } = {}) => {
    if (!coverFile) {
      return { success: true, coverUrl: form.coverUrl || '' };
    }
    setIsSavingCover(true);
    if (showStatus) {
      setCoverUploadState({ type: '', text: '' });
    }
    let uploadedCoverUrl = '';
    let success = false;

    try {
      const response = await apiClient.auth.updateCompanyCover(coverFile);
      if (!response?.success || !response?.coverUrl) {
        throw new Error('Failed to update company cover image.');
      }

      uploadedCoverUrl = response.coverUrl;
      setForm((prev) => ({ ...prev, coverUrl: uploadedCoverUrl }));
      setCoverFile(null);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
      if (showStatus) {
        setCoverUploadState({ type: 'success', text: 'Cover image updated.' });
      }
      success = true;
    } catch (error) {
      setCoverUploadState({
        type: 'error',
        text: error?.message || 'Failed to update company cover image.',
      });
    } finally {
      setIsSavingCover(false);
    }

    return { success, coverUrl: uploadedCoverUrl || form.coverUrl || '' };
  };

  const handleClearCoverImage = () => {
    setForm((prev) => ({ ...prev, coverUrl: '' }));
    setCoverFile(null);
    setCoverUploadState({ type: '', text: '' });
    if (coverInputRef.current) {
      coverInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const shouldUploadLogo = Boolean(logoFile);
      const shouldUploadCover = Boolean(coverFile);

      const logoSaved = await handleSaveLogo({ showStatus: false });
      if (!logoSaved) {
        throw new Error('Failed to update company logo.');
      }

      const coverResult = await handleSaveCover({ showStatus: false });
      if (!coverResult.success) {
        throw new Error('Failed to update company cover image.');
      }

      const nextCoverUrl = coverResult.coverUrl || form.coverUrl || '';
      const authToken = await getAuthToken();
      if (!authToken) {
        throw new Error('Missing session token. Please sign in again.');
      }
      const res = await fetch(`${API_URL}/api/companies/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          about: form.about,
          mission: form.mission,
          culture: form.culture,
          workModel: form.workModel,
          hiringProcess: form.hiringProcess,
          hiringTimeline: form.hiringTimeline,
          responseTime: form.responseTime,
          coverUrl: nextCoverUrl,
          coverColor: form.coverColor,
          socialLinks: form.socialLinks,
          profilePublic: form.profilePublic,
          benefits: form.benefits.split(',').map((s) => s.trim()).filter(Boolean),
          techStack: form.techStack.split(',').map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.company) {
          setProfileSnapshot(data.company);
          setForm((prev) => ({
            ...prev,
            tagline: data.company.tagline || '',
            website: data.company.website || '',
            location: data.company.location || '',
            coverUrl: data.company.coverUrl || nextCoverUrl || prev.coverUrl || '',
            coverColor: data.company.coverColor || prev.coverColor || '#3b82f6',
          }));
        }
        if (shouldUploadLogo) {
          setLogoUploadState({ type: 'success', text: 'Company logo updated.' });
        }
        if (shouldUploadCover) {
          setCoverUploadState({ type: 'success', text: 'Cover image updated.' });
        }
        setMsg({ type: 'success', text: 'Profile saved successfully!' });
      } else {
        setMsg({ type: 'error', text: data.error || 'Save failed.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err?.message || 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const isSavingAny = saving || isSavingLogo || isSavingCover || isApplyingCrop;

  if (status === 'loading' || !user) {
    return (
      <LoadingState
        title="Loading profile editor"
        message="Preparing your public company profile."
        variant="fullscreen"
        tone="primary"
      />
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Admin access required.</p>
      </div>
    );
  }

  if (loading) return <LoadingState title="Loading profile" variant="fullscreen" tone="primary" />;

  return (
    <div className="dashboard-shell">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-24 right-0 h-60 w-60 sm:h-80 sm:w-80 bg-gradient-to-br from-blue-400/30 to-purple-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[300px] w-[300px] sm:h-[420px] sm:w-[420px] bg-gradient-to-tr from-indigo-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-50 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(147,51,234,0.12),transparent_40%)]" />
      </div>
      <Header userType="company" isAuthenticated onLogout={async () => { await logout(); navigate('/login'); }} />
      {maintenanceMode && <MaintenanceBanner />}
      <div className="h-14 xs:h-16" />
      <div className="relative z-10 flex flex-col lg:flex-row">
        <UserContextNavigation
          userType="company"
          isCollapsed={isNavCollapsed}
          onToggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
        />
        <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${isNavCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'}`}>
          <div className="container-responsive py-6 xs:py-8 sm:py-10 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between flex-wrap gap-3 mb-1"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <Icon name="Building2" size={22} color="white" />
                </div>
                <div>
                  <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                    Public Company Profile
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Design how your company appears to candidates in the directory.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                iconName={showInlinePreview ? 'EyeOff' : 'Eye'}
                onClick={() => setShowInlinePreview((previous) => !previous)}
              >
                {showInlinePreview ? 'Edit' : 'Preview'}
              </Button>
            </motion.div>

            {showInlinePreview ? (
              <section className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <Icon name="Eye" size={16} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Candidate View Preview</h2>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      This is the same profile layout candidates see in Companies Directory.
                    </p>
                  </div>
                </div>
                <CompanyDirectoryProfilePreview
                  company={previewCompany}
                />
              </section>
            ) : (
              <>

            <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-lg p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <Icon name="Palette" size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Branding</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                    Company logo and cover image for your public page.
                  </p>
                </div>
              </div>

              <div
                className="relative overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-slate-900"
                style={{
                  background: coverBackgroundColor,
                  aspectRatio: `${FACEBOOK_COVER.width} / ${FACEBOOK_COVER.height}`,
                }}
              >
                {resolvedCoverSrc && (
                  <img
                    src={resolvedCoverSrc}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                )}
                <div
                  className={`absolute inset-0 ${
                    resolvedCoverSrc ? 'bg-gradient-to-b from-transparent via-black/5 to-black/35' : 'bg-transparent'
                  }`}
                />
                <div className="absolute left-4 sm:left-6 bottom-4 flex items-end gap-3">
                  <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden flex items-center justify-center">
                    {resolvedLogoSrc ? (
                      <img
                        src={resolvedLogoSrc}
                        alt="Company logo preview"
                        className="w-full h-full object-contain p-1.5"
                        onError={handleLogoError}
                      />
                    ) : (
                      <Icon name="Building2" size={30} className="text-gray-400" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm font-semibold text-white drop-shadow-sm">Live preview</p>
                    <p className="text-xs text-slate-200">How candidates will see your brand header</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-300">Company logo</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      iconName="Upload"
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      Choose file
                    </Button>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">JPG, PNG, WEBP, SVG. Max 5 MB.</p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoPick}
                  />
                  {logoFile && (
                    <div className="rounded-lg border border-blue-200/70 dark:border-blue-700/50 bg-blue-50/70 dark:bg-blue-900/10 p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Logo selected</p>
                      <p className="text-xs text-blue-700/90 dark:text-blue-300/90">
                        {logoFile.name} - {formatFileSize(logoFile.size)}
                      </p>
                    </div>
                  )}
                  {logoUploadState.text && (
                    <p className={`text-xs ${logoUploadState.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                      {logoUploadState.text}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-4 space-y-3">
                  <p className="text-xs font-medium text-gray-700 dark:text-slate-300">Cover image</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      iconName="Upload"
                      className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      onClick={() => coverInputRef.current?.click()}
                    >
                      Choose file
                    </Button>
                    {(form.coverUrl || coverFile) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearCoverImage}
                      >
                        Use Color Only
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    JPG, PNG, WEBP. Max 8 MB. Recommended: {FACEBOOK_COVER.width} x {FACEBOOK_COVER.height}px.
                  </p>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleCoverPick}
                  />
                  {coverFile && (
                    <div className="rounded-lg border border-blue-200/70 dark:border-blue-700/50 bg-blue-50/70 dark:bg-blue-900/10 p-3 space-y-1">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Cover selected</p>
                      <p className="text-xs text-blue-700/90 dark:text-blue-300/90">
                        {coverFile.name} - {formatFileSize(coverFile.size)}
                      </p>
                      <p className="text-xs text-blue-700/90 dark:text-blue-300/90">
                        Review preview and click <strong>Save all changes</strong>.
                      </p>
                    </div>
                  )}
                  {coverUploadState.text && (
                    <p className={`text-xs ${coverUploadState.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                      {coverUploadState.text}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-gray-700 dark:text-slate-300 whitespace-nowrap">
                    Fallback color
                  </label>
                  <input
                    type="color"
                    value={coverBackgroundColor}
                    onChange={(event) => setForm((prev) => ({ ...prev, coverColor: event.target.value }))}
                    className="h-9 w-14 rounded border border-gray-300 dark:border-slate-600 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.coverColor || '#3b82f6'}
                    onChange={(event) => setForm((prev) => ({ ...prev, coverColor: event.target.value }))}
                    placeholder="#3b82f6"
                    className="w-28 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-[11px] text-gray-500 dark:text-slate-400">
                  Used when no cover image is uploaded.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/85 dark:bg-slate-800/85 shadow-lg p-5 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <Icon name="Settings2" size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Profile content</h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                    Configure candidate-facing details and workflow preferences.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200/70 dark:border-blue-700/40 bg-blue-50/70 dark:bg-blue-900/10 p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                      Candidate readiness ({completedPriorityFieldCount}/{PRIORITY_PROFILE_FIELDS.length})
                    </p>
                    <div className="h-2 rounded-full bg-white/80 dark:bg-slate-900/60 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                        style={{ width: `${profileCompletionPercent}%` }}
                      />
                    </div>
                    {missingPriorityFields.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-blue-800/90 dark:text-blue-200/90">
                          Fill these first so candidates can evaluate your company quickly:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {missingPriorityFields.map((fieldLabel) => (
                            <span
                              key={fieldLabel}
                              className="inline-flex items-center rounded-full border border-blue-200/70 dark:border-blue-700/60 bg-white/80 dark:bg-slate-900/40 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-300"
                            >
                              {fieldLabel}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Great - your key candidate-facing profile details are complete.
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={form.profilePublic}
                      onChange={(e) => setForm((p) => ({ ...p, profilePublic: e.target.checked }))}
                      className="h-4 w-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800 dark:text-slate-200">Make profile public</span>
                      <p className="text-xs text-gray-500 dark:text-slate-400">Show this profile in the companies directory.</p>
                    </div>
                  </label>

                  <div className="rounded-xl border border-blue-200/70 dark:border-blue-700/40 bg-blue-50/70 dark:bg-blue-900/10 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
                          Company basics (managed in Settings)
                        </p>
                        <p className="text-xs text-blue-700/90 dark:text-blue-300/90 mt-1">
                          Name, tagline, website, and location are shared across Settings and Public Profile.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        iconName="Settings"
                        onClick={() => navigate('/company-settings')}
                      >
                        Open Settings
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-blue-900 dark:text-blue-100">
                      <p><span className="font-semibold">Name:</span> {previewCompany.displayName || previewCompany.name || 'Not set'}</p>
                      <p><span className="font-semibold">Industry:</span> {previewCompany.industry || 'Not set'}</p>
                      <p><span className="font-semibold">Tagline:</span> {form.tagline || 'Not set'}</p>
                      <p><span className="font-semibold">Website:</span> {form.website || 'Not set'}</p>
                      <p className="sm:col-span-2"><span className="font-semibold">Location:</span> {form.location || 'Not set'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Work Model</label>
                      <select
                        value={form.workModel}
                        onChange={(e) => setForm((p) => ({ ...p, workModel: e.target.value }))}
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {WORK_MODEL_OPTIONS.map((option) => (
                          <option key={option.value || 'empty'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Response Time</label>
                      <input
                        type="text"
                        value={form.responseTime}
                        maxLength={200}
                        onChange={(e) => setForm((p) => ({ ...p, responseTime: e.target.value }))}
                        placeholder="e.g. We usually reply within 3 days"
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Hiring Timeline</label>
                      <input
                        type="text"
                        value={form.hiringTimeline}
                        maxLength={200}
                        onChange={(e) => setForm((p) => ({ ...p, hiringTimeline: e.target.value }))}
                        placeholder="e.g. Usually 2-3 weeks"
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { key: 'about', label: 'About', rows: 5, placeholder: 'Tell candidates about your company...' },
                    { key: 'mission', label: 'Mission', rows: 3, placeholder: 'What drives your company?' },
                    { key: 'culture', label: 'Culture', rows: 3, placeholder: 'Describe your working culture...' },
                  ].map(({ key, label, rows, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-slate-300">{label}</label>
                      <textarea
                        value={form[key]}
                        rows={rows}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  ))}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Hiring Process</label>
                    <textarea
                      value={form.hiringProcess}
                      rows={3}
                      maxLength={1500}
                      onChange={(e) => setForm((p) => ({ ...p, hiringProcess: e.target.value }))}
                      placeholder="e.g. CV screening -> technical interview -> final culture interview."
                      className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {[
                    { key: 'benefits', label: 'Benefits & Perks (comma-separated)', placeholder: 'Remote work, Health insurance, Stock options' },
                    { key: 'techStack', label: 'Tech Stack (comma-separated)', placeholder: 'React, Node.js, PostgreSQL' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-gray-700 dark:text-slate-300">{label}</label>
                      <input
                        type="text"
                        value={form[key]}
                        onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Social Links</label>
                    {['linkedin', 'twitter', 'github'].map((platform) => (
                      <div key={platform} className="flex items-center gap-2">
                        <Icon
                          name={platform === 'linkedin' ? 'Linkedin' : platform === 'twitter' ? 'Twitter' : 'Github'}
                          size={16}
                          className="text-gray-400 shrink-0"
                        />
                        <input
                          type="url"
                          value={form.socialLinks[platform]}
                          onChange={(e) => setForm((p) => ({ ...p, socialLinks: { ...p.socialLinks, [platform]: e.target.value } }))}
                          placeholder={`https://${platform}.com/...`}
                          className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-col items-center gap-2">
                <div className="min-h-[20px] text-center">
                  {msg ? (
                    <p className={`text-sm ${msg.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>{msg.text}</p>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-slate-400">Save to publish your latest profile updates.</p>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={isSavingAny}
                  iconName="Save"
                  className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  {isSavingAny ? 'Saving...' : 'Save all changes'}
                </Button>
              </div>
            </section>
              </>
            )}
          </div>
        </main>
      </div>
      <ImageCropModal
        open={cropModal.open}
        file={cropModal.file}
        title={CROP_CONFIG.cover.title}
        aspect={CROP_CONFIG.cover.aspect}
        onCancel={closeCropModal}
        onUseOriginal={handleUseOriginalImage}
        onApply={handleApplyCrop}
        isApplying={isApplyingCrop}
      />
    </div>
  );
};

export default CompanyPublicProfileEditorPage;
