const DEFAULT_DEV_ORIGINS = [
  'http://localhost:4028',
  'http://127.0.0.1:4028',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return null;
  const trimmed = origin.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const parseConfiguredOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

const expandLoopbackAliases = (origin) => {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return [];

  const aliases = new Set([normalized]);
  const url = new URL(normalized);

  if (url.hostname === 'localhost') {
    url.hostname = '127.0.0.1';
    aliases.add(url.origin);
  } else if (url.hostname === '127.0.0.1') {
    url.hostname = 'localhost';
    aliases.add(url.origin);
  }

  return Array.from(aliases);
};

export const getAllowedCorsOrigins = () => {
  const configuredOrigins = [
    ...parseConfiguredOrigins(process.env.FRONTEND_URL),
    ...parseConfiguredOrigins(process.env.CORS_ORIGIN),
  ];

  return Array.from(
    new Set(
      [...DEFAULT_DEV_ORIGINS, ...configuredOrigins].flatMap((origin) =>
        expandLoopbackAliases(origin),
      ),
    ),
  );
};

export const isAllowedCorsOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  return getAllowedCorsOrigins().includes(normalizedOrigin);
};
