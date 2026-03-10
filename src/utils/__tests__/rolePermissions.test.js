import { describe, expect, it } from 'vitest';
import { filterNavByRole } from '../rolePermissions.js';

const sampleNav = [
  { label: 'Dashboard', path: '/company-dashboard' },
  {
    key: 'hiring',
    label: 'Hiring',
    items: [
      { label: 'Jobs', path: '/company-jobs', requiredPermission: 'ACCESS_JOBS_PAGE' },
      { label: 'Applications', path: '/company-applications', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    items: [
      { label: 'General Settings', path: '/company-settings' },
      { label: 'Privacy & Data', path: '/privacy-settings' },
      { label: 'Webhooks', path: '/company-webhooks', requiredPermission: 'MANAGE_ORGANIZATION' },
    ],
  },
];

describe('filterNavByRole', () => {
  it('fails closed when organization role is missing', () => {
    const filtered = filterNavByRole(sampleNav, null);

    expect(filtered).toEqual([
      { label: 'Dashboard', path: '/company-dashboard' },
      {
        key: 'settings',
        label: 'Settings',
        items: [
          { label: 'General Settings', path: '/company-settings' },
          { label: 'Privacy & Data', path: '/privacy-settings' },
        ],
      },
    ]);
  });

  it('keeps recruiter-safe items but removes admin-only settings children for recruiters', () => {
    const filtered = filterNavByRole(sampleNav, 'RECRUITER');

    expect(filtered).toEqual([
      { label: 'Dashboard', path: '/company-dashboard' },
      {
        key: 'hiring',
        label: 'Hiring',
        items: [
          { label: 'Jobs', path: '/company-jobs', requiredPermission: 'ACCESS_JOBS_PAGE' },
          { label: 'Applications', path: '/company-applications', requiredPermission: 'ACCESS_APPLICATIONS_PAGE' },
        ],
      },
      {
        key: 'settings',
        label: 'Settings',
        items: [
          { label: 'General Settings', path: '/company-settings' },
          { label: 'Privacy & Data', path: '/privacy-settings' },
        ],
      },
    ]);
  });
});
