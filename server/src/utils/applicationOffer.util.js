import crypto from 'crypto';

const OFFER_STATUS_VALUES = Object.freeze(['PENDING', 'ACCEPTED', 'DECLINED']);
const OFFER_COMPENSATION_PERIOD_VALUES = Object.freeze(['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY']);
const OFFER_HISTORY_EVENT_VALUES = Object.freeze(['SENT', 'UPDATED', 'RESENT', 'ACCEPTED', 'DECLINED']);
const MAX_OFFER_HISTORY_ENTRIES = 25;

const normalizeString = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeIsoDate = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizePositiveNumber = (value, fallback = null) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const APPLICATION_OFFER_STATUSES = OFFER_STATUS_VALUES;
export const APPLICATION_OFFER_COMPENSATION_PERIODS = OFFER_COMPENSATION_PERIOD_VALUES;
export const APPLICATION_OFFER_HISTORY_EVENTS = OFFER_HISTORY_EVENT_VALUES;

export const normalizeApplicationOfferStatus = (value, fallback = 'PENDING') => {
  const normalized = normalizeString(value)?.toUpperCase() || null;
  if (normalized && OFFER_STATUS_VALUES.includes(normalized)) return normalized;
  return OFFER_STATUS_VALUES.includes(fallback) ? fallback : 'PENDING';
};

export const normalizeApplicationOfferCompensationPeriod = (value, fallback = 'YEARLY') => {
  const normalized = normalizeString(value)?.toUpperCase() || null;
  if (normalized && OFFER_COMPENSATION_PERIOD_VALUES.includes(normalized)) return normalized;
  return OFFER_COMPENSATION_PERIOD_VALUES.includes(fallback) ? fallback : 'YEARLY';
};

export const sanitizeApplicationOffer = (offer) => {
  if (!offer || typeof offer !== 'object') return null;

  const compensationAmount = normalizePositiveNumber(offer.compensationAmount);
  const title = normalizeString(offer.title);
  const compensationCurrency = normalizeString(offer.compensationCurrency)?.toUpperCase() || null;

  if (!title || !compensationAmount || !compensationCurrency) {
    return null;
  }

  return {
    title,
    compensationAmount,
    compensationCurrency,
    compensationPeriod: normalizeApplicationOfferCompensationPeriod(offer.compensationPeriod),
    startDate: normalizeIsoDate(offer.startDate),
    expiresAt: normalizeIsoDate(offer.expiresAt),
    note: normalizeString(offer.note),
    status: normalizeApplicationOfferStatus(offer.status),
    createdAt: normalizeIsoDate(offer.createdAt),
    createdBy: normalizeString(offer.createdBy),
    updatedAt: normalizeIsoDate(offer.updatedAt),
    updatedBy: normalizeString(offer.updatedBy),
    sentAt: normalizeIsoDate(offer.sentAt),
    respondedAt: normalizeIsoDate(offer.respondedAt),
    acceptedAt: normalizeIsoDate(offer.acceptedAt),
    declinedAt: normalizeIsoDate(offer.declinedAt),
    declineReason: normalizeString(offer.declineReason),
  };
};

export const sanitizeApplicationOfferHistory = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const snapshot = sanitizeApplicationOffer(entry.offer || entry.snapshot || null);
      if (!snapshot) return null;

      const eventType = normalizeString(entry.eventType)?.toUpperCase() || null;
      return {
        id: normalizeString(entry.id) || `offer-history-${crypto.randomUUID()}`,
        eventType: OFFER_HISTORY_EVENT_VALUES.includes(eventType) ? eventType : 'UPDATED',
        actorId: normalizeString(entry.actorId),
        actorName: normalizeString(entry.actorName),
        note: normalizeString(entry.note),
        createdAt: normalizeIsoDate(entry.createdAt),
        offer: snapshot,
      };
    })
    .filter(Boolean)
    .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())
    .slice(0, MAX_OFFER_HISTORY_ENTRIES);
};

export const buildApplicationOfferPayload = (input = {}, { existing = null, actorId = null } = {}) => {
  const currentTime = new Date().toISOString();
  const previous = sanitizeApplicationOffer(existing);
  return sanitizeApplicationOffer({
    title: input.title,
    compensationAmount: input.compensationAmount,
    compensationCurrency: input.compensationCurrency,
    compensationPeriod: input.compensationPeriod,
    startDate: input.startDate,
    expiresAt: input.expiresAt,
    note: input.note,
    status: 'PENDING',
    createdAt: previous?.createdAt || currentTime,
    createdBy: previous?.createdBy || actorId,
    updatedAt: currentTime,
    updatedBy: actorId,
    sentAt: currentTime,
    respondedAt: null,
    acceptedAt: null,
    declinedAt: null,
    declineReason: null,
  });
};

export const buildAcceptedApplicationOffer = (existing = {}, { actorId = null } = {}) =>
  sanitizeApplicationOffer({
    ...existing,
    status: 'ACCEPTED',
    respondedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    declinedAt: null,
    declineReason: null,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });

export const buildDeclinedApplicationOffer = (existing = {}, { actorId = null, declineReason = null } = {}) =>
  sanitizeApplicationOffer({
    ...existing,
    status: 'DECLINED',
    respondedAt: new Date().toISOString(),
    acceptedAt: null,
    declinedAt: new Date().toISOString(),
    declineReason,
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });

export const buildResentApplicationOffer = (existing = {}, { actorId = null } = {}) =>
  sanitizeApplicationOffer({
    ...existing,
    status: 'PENDING',
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });

export const buildApplicationOfferHistoryEntry = (
  offer,
  {
    eventType = 'UPDATED',
    actorId = null,
    actorName = null,
    note = null,
    createdAt = new Date().toISOString(),
  } = {},
) => {
  const snapshot = sanitizeApplicationOffer(offer);
  if (!snapshot) return null;

  const normalizedEventType = normalizeString(eventType)?.toUpperCase() || 'UPDATED';
  return {
    id: crypto.randomUUID(),
    eventType: OFFER_HISTORY_EVENT_VALUES.includes(normalizedEventType) ? normalizedEventType : 'UPDATED',
    actorId: normalizeString(actorId),
    actorName: normalizeString(actorName),
    note: normalizeString(note),
    createdAt: normalizeIsoDate(createdAt) || new Date().toISOString(),
    offer: snapshot,
  };
};

export const appendApplicationOfferHistory = (existingHistory = [], entry = null) => {
  const normalizedHistory = sanitizeApplicationOfferHistory(existingHistory);
  if (!entry) return normalizedHistory;
  return sanitizeApplicationOfferHistory([entry, ...normalizedHistory]).slice(0, MAX_OFFER_HISTORY_ENTRIES);
};
