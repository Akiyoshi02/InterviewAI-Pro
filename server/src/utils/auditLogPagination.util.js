const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  return 0;
};

export const normalizeAuditPageLimit = (value, fallback = 100, max = 500) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
};

export const encodeAuditCursor = (log) => {
  const createdAt = log?.createdAt;
  if (!createdAt) return null;
  const payload = {
    createdAt: String(createdAt),
    id: log?.id ? String(log.id) : null,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

export const decodeAuditCursor = (cursor) => {
  if (!cursor) return null;
  const raw = String(cursor).trim();
  if (!raw) return null;

  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.createdAt || typeof parsed.createdAt !== 'string') return null;
    return {
      createdAt: parsed.createdAt,
      id: parsed.id ? String(parsed.id) : null,
    };
  } catch (_error) {
    return null;
  }
};

export const sortAuditLogsByCreatedAtDesc = (logs = []) =>
  logs
    .filter(Boolean)
    .sort((a, b) => {
      const createdAtDiff = toMillis(b?.createdAt) - toMillis(a?.createdAt);
      if (createdAtDiff !== 0) return createdAtDiff;
      return String(b?.id || '').localeCompare(String(a?.id || ''));
    });

export const sliceAuditLogsPage = (logs = [], limit = 100) => {
  const safeLimit = normalizeAuditPageLimit(limit, 100, 500);
  const hasMore = logs.length > safeLimit;
  const items = logs.slice(0, safeLimit);
  const nextCursor = hasMore && items.length > 0
    ? encodeAuditCursor(items[items.length - 1])
    : null;
  return {
    items,
    hasMore,
    nextCursor,
  };
};
