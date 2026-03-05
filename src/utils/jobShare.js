const toCleanString = (value) => (value == null ? '' : String(value).trim());

const toAbsoluteAssetUrl = (value, apiBaseUrl) => {
  const raw = toCleanString(value);
  if (!raw) return '';
  if (
    raw.startsWith('http://')
    || raw.startsWith('https://')
    || raw.startsWith('blob:')
    || raw.startsWith('data:')
  ) {
    return raw;
  }
  const base = toCleanString(apiBaseUrl).replace(/\/$/, '');
  if (!base) return raw;
  return `${base}${raw.startsWith('/') ? raw : `/${raw}`}`;
};

const sanitizeBaseUrl = (value) => normalizeWhitespace(value).replace(/\/$/, '');

const joinPath = (baseUrl, path) => {
  const base = sanitizeBaseUrl(baseUrl);
  if (!base) return '';
  const normalizedPath = toCleanString(path);
  if (!normalizedPath) return base;
  return `${base}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

const normalizeWhitespace = (value) => toCleanString(value).replace(/\s+/g, ' ').trim();

const humanizeToken = (value) => {
  const cleaned = normalizeWhitespace(value).replaceAll('_', ' ').toLowerCase();
  if (!cleaned) return '';
  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase());
};

const stripWrappingQuotes = (value) => value.replace(/^["'`]+|["'`]+$/g, '');

const sanitizeListItem = (value) => {
  const normalizedValue = value && typeof value === 'object' && !Array.isArray(value)
    ? value.label
      || value.value
      || value.name
      || value.title
      || value.question
      || value.text
      || ''
    : value;

  let item = normalizeWhitespace(normalizedValue);
  if (!item) return '';
  item = item.replace(/^[\[\],;]+|[\[\],;]+$/g, '');
  item = stripWrappingQuotes(item);
  item = item.replace(/^[-*]\s*/, '');
  return normalizeWhitespace(item);
};

const parseJsonArrayString = (value) => {
  const cleaned = toCleanString(value);
  if (!cleaned.startsWith('[') || !cleaned.endsWith(']')) return null;
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const parseQuotedSegments = (value) => {
  const source = toCleanString(value);
  if (!source.includes('"')) return [];
  const matches = [...source.matchAll(/"([^"]+)"/g)]
    .map((match) => sanitizeListItem(match[1]))
    .filter(Boolean);
  return matches.length >= 2 ? matches : [];
};

const splitLooseListString = (value) => {
  const source = toCleanString(value);
  if (!source) return [];
  const quotedSegments = parseQuotedSegments(source);
  if (quotedSegments.length) return quotedSegments;

  const splitPattern = source.includes('\n')
    ? /\r?\n/
    : source.includes(';')
      ? /\s*;\s*/
      : source.includes('|')
        ? /\s*\|\s*/
        : null;

  if (!splitPattern) return [source];

  return source
    .split(splitPattern)
    .map((entry) => sanitizeListItem(entry))
    .filter(Boolean);
};

const toStringList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizeListItem(entry))
      .filter(Boolean);
  }

  const asString = toCleanString(value);
  const parsedJsonArray = parseJsonArrayString(asString);
  if (parsedJsonArray) {
    return parsedJsonArray
      .map((entry) => sanitizeListItem(entry))
      .filter(Boolean);
  }

  return splitLooseListString(asString)
    .map((entry) => sanitizeListItem(entry))
    .filter(Boolean);
};

const truncate = (value, maxLength = 400) => {
  const text = normalizeWhitespace(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const truncateRaw = (value, maxLength = 900) => {
  const text = toCleanString(value);
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
};

const buildWhatsappAttachmentCaption = (detailedText, maxLength = 880) => {
  const raw = toCleanString(detailedText);
  if (!raw) return '';

  // Remove verbose media link lines when media itself is attached.
  const withoutMediaSection = raw.replace(/\nProject Media(?:\n- .+)+/g, '');
  const compact = withoutMediaSection
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return truncateRaw(compact, maxLength);
};

const extractJobImageUrls = (job = {}, apiBaseUrl, maxImages = 3) => {
  const rawImages = Array.isArray(job?.advertImageUrls) && job.advertImageUrls.length > 0
    ? job.advertImageUrls
    : [job?.advertImageUrl];

  const uniqueUrls = [];
  rawImages
    .map((imageUrl) => toAbsoluteAssetUrl(imageUrl, apiBaseUrl))
    .filter(Boolean)
    .forEach((imageUrl) => {
      if (!uniqueUrls.includes(imageUrl)) {
        uniqueUrls.push(imageUrl);
      }
    });

  return uniqueUrls.slice(0, maxImages);
};

const extractJobVideoUrl = (job = {}, apiBaseUrl) =>
  toAbsoluteAssetUrl(job?.advertVideoUrl, apiBaseUrl);

const IMAGE_MIME_BY_EXTENSION = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const VIDEO_MIME_BY_EXTENSION = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
};

const MIME_BY_EXTENSION = {
  ...IMAGE_MIME_BY_EXTENSION,
  ...VIDEO_MIME_BY_EXTENSION,
};

const EXTENSION_BY_MIME = Object.entries(MIME_BY_EXTENSION).reduce((accumulator, [extension, mime]) => {
  if (!accumulator[mime]) accumulator[mime] = extension;
  return accumulator;
}, {});

const getPathFromUrl = (value) => {
  const raw = toCleanString(value);
  if (!raw) return '';
  try {
    return new URL(raw).pathname || '';
  } catch {
    return raw.split('?')[0].split('#')[0];
  }
};

const getFileExtension = (value) => {
  const raw = toCleanString(value).toLowerCase();
  const lastSegment = raw.split('/').pop() || '';
  if (!lastSegment.includes('.')) return '';
  return lastSegment.split('.').pop() || '';
};

const sanitizeFilename = (value, fallbackBaseName, extension = '') => {
  const fallbackName = `${fallbackBaseName || 'attachment'}${extension ? `.${extension}` : ''}`;
  const raw = decodeURIComponent(toCleanString(value) || fallbackName);
  const normalized = raw.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) return fallbackName;
  if (extension && !normalized.toLowerCase().endsWith(`.${extension.toLowerCase()}`)) {
    return `${normalized}.${extension}`;
  }
  return normalized;
};

const getMimeType = ({ blobType = '', sourceUrl = '' }) => {
  const normalizedBlobType = toCleanString(blobType).toLowerCase();
  if (normalizedBlobType) return normalizedBlobType;
  const extension = getFileExtension(getPathFromUrl(sourceUrl));
  return MIME_BY_EXTENSION[extension] || '';
};

const getExtensionFromMime = (mimeType = '') => {
  const normalized = toCleanString(mimeType).toLowerCase();
  return EXTENSION_BY_MIME[normalized] || '';
};

const fetchAssetAsFile = async (
  sourceUrl,
  {
    fetchImpl,
    fallbackBaseName = 'attachment',
    fallbackExtension = '',
    maxBytes = 10 * 1024 * 1024,
  } = {},
) => {
  const url = toCleanString(sourceUrl);
  if (!url || !fetchImpl || typeof File === 'undefined') return null;

  try {
    const response = await fetchImpl(url, { method: 'GET', credentials: 'omit' });
    if (!response?.ok) return null;

    const blob = await response.blob();
    if (!blob || typeof blob.size !== 'number' || blob.size <= 0) return null;
    if (maxBytes > 0 && blob.size > maxBytes) return null;

    const mimeType = getMimeType({ blobType: blob.type, sourceUrl: url });
    const sourcePath = getPathFromUrl(url);
    const sourceFilename = (sourcePath.split('/').pop() || '').trim();
    const extension = getFileExtension(sourceFilename)
      || getExtensionFromMime(mimeType)
      || fallbackExtension;
    const filename = sanitizeFilename(sourceFilename, fallbackBaseName, extension);

    return new File([blob], filename, {
      type: mimeType || undefined,
      lastModified: Date.now(),
    });
  } catch {
    return null;
  }
};

export const prepareJobShareAttachments = async (
  job = {},
  {
    apiBaseUrl = '',
    maxImages = 1,
    includeVideo = true,
    maxImageBytes = 8 * 1024 * 1024,
    maxVideoBytes = 24 * 1024 * 1024,
    fetchImpl,
  } = {},
) => {
  const fetcher = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!fetcher || typeof File === 'undefined') {
    return {
      files: [],
      attachedImageCount: 0,
      attachedVideo: false,
    };
  }

  const imageUrls = extractJobImageUrls(job, apiBaseUrl, maxImages);
  const videoUrl = includeVideo ? extractJobVideoUrl(job, apiBaseUrl) : '';
  const files = [];
  let attachedImageCount = 0;
  let attachedVideo = false;

  for (let index = 0; index < imageUrls.length; index += 1) {
    const imageUrl = imageUrls[index];
    const imageFile = await fetchAssetAsFile(imageUrl, {
      fetchImpl: fetcher,
      fallbackBaseName: `job_image_${index + 1}`,
      fallbackExtension: 'png',
      maxBytes: maxImageBytes,
    });
    if (imageFile) {
      files.push(imageFile);
      attachedImageCount += 1;
    }
  }

  if (videoUrl) {
    const videoFile = await fetchAssetAsFile(videoUrl, {
      fetchImpl: fetcher,
      fallbackBaseName: 'job_video',
      fallbackExtension: 'mp4',
      maxBytes: maxVideoBytes,
    });
    if (videoFile) {
      files.push(videoFile);
      attachedVideo = true;
    }
  }

  return {
    files,
    attachedImageCount,
    attachedVideo,
  };
};

const createRoleSnapshotLine = (job = {}) => {
  const segments = [
    normalizeWhitespace(job?.department),
    humanizeToken(job?.employmentType),
    humanizeToken(job?.experienceLevel),
    normalizeWhitespace(job?.location),
  ].filter(Boolean);
  return segments.join(' | ');
};

const appendSection = (lines, heading, entries = []) => {
  const normalizedEntries = (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean);

  if (!normalizedEntries.length) return;
  lines.push('', heading);
  normalizedEntries.forEach((entry) => lines.push(`- ${entry}`));
};

export const buildJobShareCardUrl = (
  jobId,
  {
    apiBaseUrl = '',
    version = '',
  } = {},
) => {
  const normalizedJobId = toCleanString(jobId);
  if (!normalizedJobId) return '';
  const baseUrl = sanitizeBaseUrl(apiBaseUrl);
  if (!baseUrl) return '';
  const url = joinPath(baseUrl, `/api/public/jobs/${encodeURIComponent(normalizedJobId)}/share`);
  const versionToken = toCleanString(version);
  if (!versionToken) return url;
  return `${url}?v=${encodeURIComponent(versionToken)}`;
};

export const buildJobSharePackage = (
  job = {},
  {
    jobUrl = '',
    shareUrl = '',
    organizationName = '',
    apiBaseUrl = '',
    maxDescriptionLength = 520,
    maxSkills = 8,
    maxRequirements = 5,
    maxResponsibilities = 4,
    maxWhatsappSkills = 5,
    maxWhatsappRequirements = 3,
  } = {},
) => {
  const title = normalizeWhitespace(job?.title) || 'Job Opportunity';
  const company = normalizeWhitespace(organizationName)
    || normalizeWhitespace(job?.organization?.name)
    || 'Company';
  const roleSnapshot = createRoleSnapshotLine(job);
  const compensation = normalizeWhitespace(job?.compensationRange || job?.salaryRange || '');
  const description = truncate(job?.description, maxDescriptionLength);
  const skills = toStringList(job?.skills).slice(0, maxSkills);
  const requirements = toStringList(job?.requirements).slice(0, maxRequirements);
  const responsibilities = toStringList(job?.responsibilities).slice(0, maxResponsibilities);
  const imageUrls = extractJobImageUrls(job, apiBaseUrl);
  const videoUrl = extractJobVideoUrl(job, apiBaseUrl);
  const cleanJobUrl = toCleanString(jobUrl);
  const cleanShareUrl = toCleanString(shareUrl);
  const primaryShareUrl = cleanShareUrl || cleanJobUrl;
  const mediaLines = [
    ...imageUrls.map((url, index) => `Image ${index + 1}: ${url}`),
    ...(videoUrl ? [`Video: ${videoUrl}`] : []),
  ];
  const mediaSummarySegments = [];
  if (imageUrls.length) mediaSummarySegments.push(`${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''}`);
  if (videoUrl) mediaSummarySegments.push('1 video');
  const mediaSummary = mediaSummarySegments.length ? `Media attached: ${mediaSummarySegments.join(' + ')}.` : '';

  const baseLines = [
    `${title}`,
    `${company}`,
  ];

  if (roleSnapshot) baseLines.push(`Role: ${roleSnapshot}`);
  if (compensation) baseLines.push(`Compensation: ${compensation}`);
  if (description) {
    baseLines.push('', 'Overview', description);
  }
  appendSection(baseLines, 'Key Skills', skills);
  appendSection(baseLines, 'Requirements', requirements);
  appendSection(baseLines, 'Responsibilities', responsibilities);
  appendSection(baseLines, 'Project Media', mediaLines);

  const detailedLines = [...baseLines];
  if (primaryShareUrl) {
    detailedLines.push('', 'View Job', primaryShareUrl);
  }
  if (cleanJobUrl && cleanJobUrl !== primaryShareUrl) {
    detailedLines.push('', 'Apply Directly', cleanJobUrl);
  }
  const detailedText = detailedLines.join('\n').trim();

  const summaryText = `Hiring: ${title} at ${company}${roleSnapshot ? ` (${roleSnapshot})` : ''}`;
  const nativeShareLines = [
    `${title} | ${company}`,
    ...(roleSnapshot ? [roleSnapshot] : []),
    ...(compensation ? [`Compensation: ${compensation}`] : []),
    ...(description ? ['', description] : []),
    ...(skills.length ? ['', `Top Skills: ${skills.slice(0, maxWhatsappSkills).join(', ')}`] : []),
    ...(mediaSummary ? ['', mediaSummary] : []),
  ];
  const nativeShareText = nativeShareLines.join('\n').trim();

  const whatsappLines = [
    `*${title}*`,
    `_${company}_`,
  ];
  if (roleSnapshot) whatsappLines.push(`Role: ${roleSnapshot}`);
  if (compensation) whatsappLines.push(`Compensation: ${compensation}`);
  if (description) {
    whatsappLines.push('', '*Overview*', description);
  }
  if (skills.length) {
    whatsappLines.push('', `Top Skills: ${skills.slice(0, maxWhatsappSkills).join(', ')}`);
  }
  if (requirements.length) {
    appendSection(
      whatsappLines,
      '*Key Requirements*',
      requirements.slice(0, maxWhatsappRequirements),
    );
  }
  if (mediaSummary) {
    whatsappLines.push('', mediaSummary);
  }
  if (primaryShareUrl) {
    whatsappLines.push('', '*View Job & Apply*', primaryShareUrl);
  }
  const whatsappText = whatsappLines.join('\n').trim();

  const whatsappCaptionText = buildWhatsappAttachmentCaption(detailedText, 880);

  return {
    title,
    company,
    jobUrl: cleanJobUrl,
    shareUrl: cleanShareUrl,
    primaryShareUrl,
    summaryText,
    detailedText,
    nativeShareText,
    whatsappText,
    whatsappCaptionText,
    media: {
      imageUrls,
      videoUrl,
    },
    hasMedia: imageUrls.length > 0 || Boolean(videoUrl),
  };
};
