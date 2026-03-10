import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import UserContextNavigation from '../UserContextNavigation.jsx';

const mockUseAuth = vi.fn();
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

vi.mock('../AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../Button', () => ({
  default: ({ children, onClick, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../NavigationMenu', () => ({
  default: ({ items = [] }) => (
    <div>
      {items.map((item) => (
        <div key={item.key || item.label}>
          <div>{item.label}</div>
          {item.description && <div>{item.description}</div>}
          {Array.isArray(item.items) && item.items.map((subItem) => (
            <div key={subItem.path || subItem.label}>
              <div>{subItem.label}</div>
              {subItem.description && <div>{subItem.description}</div>}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../../../pages/candidate-dashboard/components/AIChatAssistant', () => ({
  default: () => null,
}));

vi.mock('../../../pages/company-dashboard/components/AIChatAssistant', () => ({
  default: () => null,
}));

const buildUser = (role) => ({
  id: `${role.toLowerCase()}-1`,
  fullName: role === 'REVIEWER' ? 'Riley Reviewer' : 'Rex Recruiter',
  email: role === 'REVIEWER' ? 'reviewer@example.com' : 'recruiter@example.com',
  accountType: 'COMPANY',
  organizationContext: {
    membership: { role },
  },
});

const buildCandidateUser = () => ({
  id: 'candidate-1',
  fullName: 'Casey Candidate',
  email: 'candidate@example.com',
  accountType: 'CANDIDATE',
});

describe('UserContextNavigation role experience', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseLocation.mockReturnValue({ pathname: '/company-dashboard', hash: '' });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows reviewer-specific hiring descriptions and assigned reviews entry', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('REVIEWER') });

    render(<UserContextNavigation userType="company" />);

    expect(screen.getByText('Assigned Reviews')).toBeTruthy();
    expect(screen.getByText('Your assigned interview feedback queue')).toBeTruthy();
    expect(screen.getByText('Assigned application, candidate, and interview context')).toBeTruthy();
    expect(screen.getByText('Review assigned applications and interview context')).toBeTruthy();
    expect(screen.getByText('Review assigned candidate profiles and resumes')).toBeTruthy();
    expect(screen.getByText('Review interview evidence, recordings, and scorecards')).toBeTruthy();
    expect(screen.getByText('Profile and review preferences')).toBeTruthy();
    expect(screen.queryByText('Invitations')).toBeNull();
    expect(screen.queryByText('Manage candidate invitation outreach')).toBeNull();
  });

  it('opens the mobile hiring submenu as a dedicated menu for reviewers', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('REVIEWER') });

    render(<UserContextNavigation userType="company" />);

    expect(screen.queryByRole('menu', { name: 'Hiring submenu' })).toBeNull();

    const hiringButton = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-haspopup') === 'menu');

    expect(hiringButton).toBeTruthy();

    fireEvent.click(hiringButton);

    const submenu = screen.getByRole('menu', { name: 'Hiring submenu' });
    expect(within(submenu).getByText('Applications')).toBeTruthy();
    expect(within(submenu).getByText('Candidates')).toBeTruthy();
    expect(within(submenu).getByText('Interviews')).toBeTruthy();
  });

  it('keeps recruiter-oriented hiring descriptions for recruiters', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('RECRUITER') });

    render(<UserContextNavigation userType="company" />);

    expect(screen.queryByText('Assigned Reviews')).toBeNull();
    expect(screen.getByText('Submissions, candidate context, and interview reviews')).toBeTruthy();
    expect(screen.getByText('Candidate submissions and status context')).toBeTruthy();
    expect(screen.getByText('Candidate profiles and pipeline context')).toBeTruthy();
    expect(screen.getByText('Interview schedule, recordings, and reviews')).toBeTruthy();
    expect(screen.queryByText('Invitations')).toBeNull();
    expect(screen.queryByText('Manage candidate invitation outreach')).toBeNull();
    expect(screen.getByText('Profile and workspace settings')).toBeTruthy();
  });

  it('keeps candidate Profile as the only settings entry in mobile navigation', () => {
    mockUseAuth.mockReturnValue({ user: buildCandidateUser() });
    mockUseLocation.mockReturnValue({ pathname: '/candidate-dashboard', hash: '' });

    render(<UserContextNavigation userType="candidate" />);

    const moreButton = screen.getByRole('button', { name: 'More navigation' });
    fireEvent.click(moreButton);

    const overflowMenu = screen.getByRole('menu', { name: 'More navigation' });
    expect(within(overflowMenu).queryByRole('menuitem', { name: 'Settings' })).toBeNull();
    expect(moreButton.getAttribute('aria-current')).toBeNull();
  });

  it('keeps company admin overflow focused on non-profile destinations', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('ADMIN') });
    mockUseLocation.mockReturnValue({ pathname: '/company-dashboard', hash: '' });

    render(<UserContextNavigation userType="company" />);

    const moreButton = screen.getByRole('button', { name: 'More navigation' });
    fireEvent.click(moreButton);

    const overflowMenu = screen.getByRole('menu', { name: 'More navigation' });
    expect(within(overflowMenu).getByRole('menuitem', { name: 'Billing' })).toBeTruthy();
    expect(within(overflowMenu).queryByRole('menuitem', { name: 'Settings' })).toBeNull();
    expect(moreButton.getAttribute('aria-current')).toBeNull();
  });

  it('removes the duplicate More tab for recruiters on mobile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('RECRUITER') });
    mockUseLocation.mockReturnValue({ pathname: '/company-dashboard', hash: '' });

    render(<UserContextNavigation userType="company" />);

    expect(screen.queryByRole('button', { name: 'More navigation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy();
  });

  it('removes the duplicate More tab for reviewers on mobile', () => {
    mockUseAuth.mockReturnValue({ user: buildUser('REVIEWER') });
    mockUseLocation.mockReturnValue({ pathname: '/company-dashboard', hash: '' });

    render(<UserContextNavigation userType="company" />);

    expect(screen.queryByRole('button', { name: 'More navigation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy();
  });

  it('exposes overflow admin sections from the mobile bottom navigation', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        fullName: 'Ada Admin',
        email: 'admin@example.com',
        accountType: 'ADMIN',
      },
    });
    mockUseLocation.mockReturnValue({
      pathname: '/system-admin-dashboard/research-tools',
      hash: '',
    });

    render(<UserContextNavigation userType="admin" />);

    expect(screen.getByRole('button', { name: 'More navigation' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More navigation' }));

    const overflowMenu = screen.getByRole('menu', { name: 'More navigation' });
    expect(overflowMenu.className).toContain('left-1/2');
    expect(overflowMenu.className).toContain('-translate-x-1/2');
    expect(within(overflowMenu).queryByText(/^More$/)).toBeNull();
    expect(within(overflowMenu).getByText('Governance')).toBeTruthy();
    expect(within(overflowMenu).getByText('Data & AI')).toBeTruthy();
    expect(within(overflowMenu).getAllByText('Live Chat')).toHaveLength(2);
    expect(within(overflowMenu).getByText('Templates')).toBeTruthy();
    expect(within(overflowMenu).getByText('Audit Logs')).toBeTruthy();
    expect(within(overflowMenu).getByText('Question Catalog')).toBeTruthy();
  });

  it('keeps only the profile tab active on admin settings routes', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        fullName: 'Ada Admin',
        email: 'admin@example.com',
        accountType: 'ADMIN',
      },
    });
    mockUseLocation.mockReturnValue({
      pathname: '/system-admin-dashboard/settings',
      hash: '',
    });

    render(<UserContextNavigation userType="admin" />);

    expect(screen.getByRole('button', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'More navigation' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the current overflow admin item when the active route lives under More', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        fullName: 'Ada Admin',
        email: 'admin@example.com',
        accountType: 'ADMIN',
      },
    });
    mockUseLocation.mockReturnValue({
      pathname: '/system-admin-dashboard/live-chat',
      hash: '',
    });

    render(<UserContextNavigation userType="admin" />);

    const moreButton = screen.getByRole('button', { name: 'More navigation' });
    expect(moreButton.getAttribute('aria-current')).toBe('page');

    fireEvent.click(moreButton);

    const overflowMenu = screen.getByRole('menu', { name: 'More navigation' });
    expect(within(overflowMenu).getByRole('menuitem', { name: 'Live Chat' }).getAttribute('aria-current')).toBe('page');
  });

  it('does not highlight More when the menu is open on a primary admin route', () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: 'admin-1',
        fullName: 'Ada Admin',
        email: 'admin@example.com',
        accountType: 'ADMIN',
      },
    });
    mockUseLocation.mockReturnValue({
      pathname: '/system-admin-dashboard/users',
      hash: '',
    });

    render(<UserContextNavigation userType="admin" />);

    const moreButton = screen.getByRole('button', { name: 'More navigation' });
    fireEvent.click(moreButton);

    expect(moreButton.getAttribute('aria-current')).toBeNull();
    expect(moreButton.className).not.toContain('text-blue-600');
    expect(moreButton.querySelector('svg')?.getAttribute('class') || '').not.toContain('text-blue-600');
  });
});
