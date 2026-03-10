import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Header from '../Header.jsx';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

vi.mock('../../AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../../BrandMark', () => ({
  default: () => <div>InterviewAI Pro</div>,
}));

vi.mock('../Button', () => ({
  default: ({ children, onClick, iconName, iconPosition, fullWidth, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../RoleBadge', () => ({
  default: ({ role }) => <div>{role}</div>,
}));

vi.mock('../NotificationCenter', () => ({
  default: () => <div>Notifications</div>,
}));

vi.mock('../NavigationMenu', () => ({
  default: ({ items = [] }) => (
    <div>
      {items.map((item) => (
        <div key={item.key || item.label}>
          <div>{item.label}</div>
          {Array.isArray(item.items) && item.items.map((subItem) => (
            <div key={subItem.path || subItem.label}>{subItem.label}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

describe('Header role navigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseLocation.mockReturnValue({
      pathname: '/company-dashboard',
      search: '',
      hash: '',
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const openMenu = () => {
    fireEvent.click(screen.getByLabelText('Open menu'));
  };

  it('hides admin-only company destinations for reviewers', () => {
    render(
      <Header
        userType="company"
        isAuthenticated
        onLogout={vi.fn()}
        organizationRole="REVIEWER"
      />,
    );

    openMenu();

    expect(screen.queryByText('Billing')).toBeNull();
    expect(screen.queryByText('Public Profile')).toBeNull();
    expect(screen.queryByText('Webhooks')).toBeNull();
    expect(screen.getByText('General Settings')).toBeTruthy();
    expect(screen.getByText('Privacy & Data')).toBeTruthy();
  });

  it('shows recruiter destinations but keeps admin-only items hidden for recruiters', () => {
    render(
      <Header
        userType="company"
        isAuthenticated
        onLogout={vi.fn()}
        organizationRole="RECRUITER"
      />,
    );

    openMenu();

    expect(screen.getByText('Applications')).toBeTruthy();
    expect(screen.queryByText('Invitations')).toBeNull();
    expect(screen.queryByText('Billing')).toBeNull();
    expect(screen.queryByText('Public Profile')).toBeNull();
    expect(screen.queryByText('Webhooks')).toBeNull();
  });

  it('shows the full company admin destination set for admins', () => {
    render(
      <Header
        userType="company"
        isAuthenticated
        onLogout={vi.fn()}
        organizationRole="ADMIN"
      />,
    );

    openMenu();

    expect(screen.getByText('Applications')).toBeTruthy();
    expect(screen.queryByText('Invitations')).toBeNull();
    expect(screen.getByText('Billing')).toBeTruthy();
    expect(screen.getByText('Public Profile')).toBeTruthy();
    expect(screen.getByText('Webhooks')).toBeTruthy();
  });

  it('keeps the admin mobile menu aligned with the shared admin navigation model', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/system-admin-dashboard',
      search: '',
      hash: '',
    });

    render(
      <Header
        userType="admin"
        isAuthenticated
        onLogout={vi.fn()}
      />,
    );

    openMenu();

    expect(screen.getByText('Question Catalog')).toBeTruthy();
    expect(screen.getByText('Live Chat')).toBeTruthy();
    expect(screen.getByText('Pending Approvals')).toBeTruthy();
  });
});
