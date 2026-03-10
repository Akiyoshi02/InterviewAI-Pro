import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyTeamMembersPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockListMembers = vi.fn();
const mockListInvitations = vi.fn();
const mockUseRealtimePathFeed = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    section: ({ children, initial, whileInView, viewport, variants, ...props }) => <section {...props}>{children}</section>,
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>User Context Navigation</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className = '', variant, size, iconName, loading, ...props }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/ui/Input', () => ({
  default: ({ className = '', ...props }) => <input className={className} {...props} />,
}));

vi.mock('../../../components/ui/Select', () => ({
  default: ({ className = '', options = [], value, onChange, loading, ...props }) => (
    <select className={className} value={value} onChange={(event) => onChange?.(event.target.value)} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/UnifiedFilterPanel', () => ({
  default: ({ title, description, headerActions, children }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {headerActions}
      {children}
    </section>
  ),
  FILTER_GRID_CLASS: 'filter-grid',
  FILTER_SUBPANEL_CLASS: 'filter-subpanel',
  UnifiedFilterSelect: ({ label, options = [], value, onChange }) => (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  UnifiedFilterToggleButton: ({ label, onClick }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
  UnifiedSearchField: ({ label, ...props }) => (
    <label>
      <span>{label}</span>
      <input {...props} />
    </label>
  ),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    organizations: {
      listMembers: (...args) => mockListMembers(...args),
    },
    teamInvitations: {
      list: (...args) => mockListInvitations(...args),
    },
  },
}));

vi.mock('../../../hooks/useRealtimePathFeed', () => ({
  useRealtimePathFeed: (...args) => mockUseRealtimePathFeed(...args),
}));

vi.mock('../../../utils/rolePermissions', () => ({
  hasPermission: (...args) => mockHasPermission(...args),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <CompanyTeamMembersPage />
    </MemoryRouter>,
  );

describe('CompanyTeamMembersPage mobile header layout', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockListMembers.mockReset();
    mockListInvitations.mockReset();
    mockUseRealtimePathFeed.mockReset();
    mockHasPermission.mockReset();

    mockUseAuth.mockReturnValue({
      status: 'authenticated',
      logout: vi.fn(),
      organizationRole: 'ADMIN',
      organization: {
        id: 'org-1',
      },
      user: {
        accountType: 'COMPANY',
      },
    });
    mockListMembers.mockResolvedValue({
      success: true,
      members: [],
    });
    mockListInvitations.mockResolvedValue({
      success: true,
      invitations: [],
    });
    mockHasPermission.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the standardized team members header icon layout', () => {
    renderPage();

    const heading = screen.getByRole('heading', { level: 1, name: 'Team Members' });
    const textGroup = heading.closest('div');
    const headerContent = textGroup?.parentElement;
    const headerRow = headerContent?.parentElement;
    const iconWrapper = within(headerRow).getByTestId('icon-Users2').parentElement;
    const refreshButton = within(headerRow).getByRole('button', { name: /refresh/i });
    const subtitle = screen.getByText("Manage your organization's team members and invitations");

    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(iconWrapper).not.toBeNull();
    expect(iconWrapper.className).toContain('shrink-0');
    expect(iconWrapper.className).toContain('p-3');
    expect(subtitle.className).toContain('mt-1');
    expect(refreshButton.className).toContain('self-start');
  });

  it('stacks pending invitation cards on mobile and keeps long emails within the card', async () => {
    mockListInvitations.mockResolvedValue({
      success: true,
      invitations: [
        {
          id: 'invite-1',
          email: 'pa+reviewer.visual.20260306@gmail.com',
          role: 'REVIEWER',
          status: 'PENDING',
          invitedAt: '2026-03-06T10:00:00.000Z',
        },
      ],
    });

    const { findByText } = renderPage();

    const emailText = await findByText('pa+reviewer.visual.20260306@gmail.com');
    const card = emailText.closest('div.rounded-xl');
    const metaText = screen.getByText('Role: REVIEWER - Status: PENDING');
    const actionsRow = within(card).getAllByRole('button')[0]?.parentElement || null;

    expect(card).not.toBeNull();
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('sm:flex-row');
    expect(emailText.className).toContain('break-all');
    expect(emailText.className).toContain('leading-snug');
    expect(metaText.className).toContain('break-words');
    expect(actionsRow).not.toBeNull();
    expect(actionsRow.className).toContain('self-end');
    expect(actionsRow.className).toContain('sm:self-auto');
    expect(actionsRow.className).toContain('sm:flex-shrink-0');
  });

  it('stacks member cards on mobile and keeps the role selector within the card', async () => {
    mockListMembers.mockResolvedValue({
      success: true,
      members: [
        {
          userId: 'member-1',
          role: 'RECRUITER',
          createdAt: '2026-03-06T10:00:00.000Z',
          user: {
            fullName: 'Recruiter Test User',
            email: 'akiyoshiyapa+recruiter.role@gmail.com',
            photoURL: '',
          },
        },
      ],
    });

    const { findByText } = renderPage();

    const nameText = await findByText('Recruiter Test User');
    const emailText = screen.getByText('akiyoshiyapa+recruiter.role@gmail.com');
    const card = nameText.closest('div.rounded-xl');
    const textGroup = nameText.parentElement;
    const roleSelect = within(card).getByRole('combobox');
    const actionsRow = roleSelect.parentElement;
    const removeButton = within(card).getAllByRole('button').find((button) => button.className.includes('text-rose-500')) || null;

    expect(card).not.toBeNull();
    expect(card.className).toContain('flex-col');
    expect(card.className).toContain('sm:flex-row');
    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(emailText.className).toContain('break-all');
    expect(actionsRow).not.toBeNull();
    expect(actionsRow.className).toContain('w-full');
    expect(actionsRow.className).toContain('sm:w-auto');
    expect(roleSelect.value).toBe('RECRUITER');
    expect(roleSelect.className).toContain('w-full');
    expect(roleSelect.className).toContain('sm:w-32');
    expect(removeButton).not.toBeNull();
    expect(removeButton.className).toContain('shrink-0');
  });
});
