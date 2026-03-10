export const OFFER_COMPENSATION_PERIOD_OPTIONS = [
  { value: 'YEARLY', label: 'Per year' },
  { value: 'MONTHLY', label: 'Per month' },
  { value: 'WEEKLY', label: 'Per week' },
  { value: 'DAILY', label: 'Per day' },
  { value: 'HOURLY', label: 'Per hour' },
];

export const buildInitialOfferDraft = (application = null) => ({
  title: application?.offer?.title || application?.job?.title || '',
  compensationAmount: application?.offer?.compensationAmount != null
    ? String(application.offer.compensationAmount)
    : String(application?.job?.salaryMax || application?.job?.salaryMin || ''),
  compensationCurrency: application?.offer?.compensationCurrency || application?.job?.salaryCurrency || 'LKR',
  compensationPeriod: application?.offer?.compensationPeriod || 'MONTHLY',
  startDate: application?.offer?.startDate
    ? String(application.offer.startDate).slice(0, 10)
    : '',
  expiresAt: application?.offer?.expiresAt
    ? String(application.offer.expiresAt).slice(0, 16)
    : '',
  note: application?.offer?.note || '',
});

export const validateOfferDraft = (draft = {}) => {
  if (!String(draft.title || '').trim()) return 'Offer title is required.';
  const compensationAmount = Number(draft.compensationAmount);
  if (!Number.isFinite(compensationAmount) || compensationAmount <= 0) {
    return 'Compensation amount must be greater than 0.';
  }
  if (!String(draft.compensationCurrency || '').trim()) return 'Currency is required.';
  if (!String(draft.startDate || '').trim()) return 'Start date is required.';
  if (!String(draft.expiresAt || '').trim()) return 'Offer expiry is required.';

  const startDate = new Date(draft.startDate);
  const expiresAt = new Date(draft.expiresAt);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(expiresAt.getTime())) {
    return 'Offer dates are invalid.';
  }
  if (expiresAt.getTime() <= Date.now()) {
    return 'Offer expiry must be in the future.';
  }
  if (startDate.getTime() > expiresAt.getTime()) {
    return 'Offer start date must be before the expiry.';
  }

  return '';
};

export const buildOfferPayloadFromDraft = (draft = {}) => ({
  title: String(draft.title || '').trim(),
  compensationAmount: Number(draft.compensationAmount),
  compensationCurrency: String(draft.compensationCurrency || '').trim().toUpperCase(),
  compensationPeriod: draft.compensationPeriod,
  startDate: new Date(draft.startDate).toISOString(),
  expiresAt: new Date(draft.expiresAt).toISOString(),
  note: String(draft.note || '').trim() || null,
});
