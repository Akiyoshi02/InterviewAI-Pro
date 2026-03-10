export const formatOfferCompensation = (offer) => {
  if (!offer?.compensationAmount || !offer?.compensationCurrency) return null;
  try {
    const formattedAmount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: offer.compensationCurrency,
      maximumFractionDigits: 0,
    }).format(offer.compensationAmount);
    const period = {
      YEARLY: 'per year',
      MONTHLY: 'per month',
      WEEKLY: 'per week',
      DAILY: 'per day',
      HOURLY: 'per hour',
    }[String(offer.compensationPeriod || '').toUpperCase()] || '';
    return [formattedAmount, period].filter(Boolean).join(' ');
  } catch {
    return `${offer.compensationCurrency} ${offer.compensationAmount}`;
  }
};

export const isOfferExpired = (offer) => {
  if (!offer?.expiresAt) return false;
  const expiry = new Date(offer.expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() <= Date.now();
};

export const isOfferAccepted = (application) =>
  String(application?.offer?.status || '').toUpperCase() === 'ACCEPTED';

export const canAccessHiredHandoff = (application) =>
  String(application?.status || '').toUpperCase() === 'HIRED' && isOfferAccepted(application);

export const canAccessApplicationOnboarding = (application) =>
  String(application?.status || '').toUpperCase() === 'HIRED'
  && Array.isArray(application?.onboarding?.tasks)
  && application.onboarding.tasks.length > 0;

export const OFFER_HISTORY_EVENT_LABELS = {
  SENT: 'Offer shared',
  UPDATED: 'Offer updated',
  RESENT: 'Offer email resent',
  ACCEPTED: 'Offer accepted',
  DECLINED: 'Offer declined',
};

export const formatOfferHistoryEventLabel = (eventType) => {
  const normalized = String(eventType || '').trim().toUpperCase();
  return OFFER_HISTORY_EVENT_LABELS[normalized] || 'Offer updated';
};
