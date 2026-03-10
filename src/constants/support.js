export const DEFAULT_SUPPORT_EMAIL = 'akiyoshiyapa@gmail.com';
export const SUPPORT_PHONE_DISPLAY = '+94 71 121 4592';
export const SUPPORT_PHONE_HREF = 'tel:+94711214592';

export const getSupportContactEmail = () => (
  import.meta.env.VITE_SUPPORT_EMAIL
  || import.meta.env.VITE_SMTP_USER
  || import.meta.env.VITE_FROM_EMAIL
  || DEFAULT_SUPPORT_EMAIL
).trim();

export const getSupportMailtoHref = () => `mailto:${getSupportContactEmail()}`;
