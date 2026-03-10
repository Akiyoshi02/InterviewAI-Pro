import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import InterviewPrepLibraryPage from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('framer-motion', () => {
  const MotionTag = ({
    children,
    variants,
    initial,
    animate,
    exit,
    transition,
    whileInView,
    whileHover,
    whileTap,
    viewport,
    ...props
  }) => <div {...props}>{children}</div>;

  return {
    motion: new Proxy({}, { get: () => MotionTag }),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>UserContextNavigation</div>,
}));

vi.mock('../../../components/ui/MaintenanceBanner', () => ({
  default: () => <div>MaintenanceBanner</div>,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className, onClick, disabled, type = 'button' }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <InterviewPrepLibraryPage />
    </MemoryRouter>,
  );

describe('InterviewPrepLibraryPage mobile filter controls', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('keeps the question filter chevrons in dedicated right-side slots', () => {
    renderPage();

    const heading = screen.getByText('Interview Prep Library');
    const headerGroup = heading.closest('div')?.parentElement;
    expect(headerGroup).not.toBeNull();
    expect(within(headerGroup).getByTestId('icon-BookOpen')).toBeTruthy();
    expect(headerGroup.firstElementChild.className).toContain('from-blue-600');
    expect(headerGroup.firstElementChild.className).toContain('to-purple-600');

    const categorySelect = screen.getByDisplayValue('All');
    const difficultySelect = screen.getByDisplayValue('All levels');

    expect(categorySelect.className).toContain('appearance-none');
    expect(categorySelect.className).toContain('pr-10');
    expect(difficultySelect.className).toContain('appearance-none');
    expect(difficultySelect.className).toContain('pr-10');

    const categoryWrapper = categorySelect.parentElement;
    const difficultyWrapper = difficultySelect.parentElement;
    expect(categoryWrapper).not.toBeNull();
    expect(difficultyWrapper).not.toBeNull();
    expect(categoryWrapper.className).toContain('relative');
    expect(difficultyWrapper.className).toContain('relative');

    const chevrons = [
      within(categoryWrapper).getByTestId('icon-ChevronDown'),
      within(difficultyWrapper).getByTestId('icon-ChevronDown'),
    ];
    chevrons.forEach((chevron) => {
      expect(chevron.className).toContain('absolute');
      expect(chevron.className).toContain('right-3');
      expect(chevron.className).toContain('top-1/2');
      expect(chevron.className).toContain('pointer-events-none');
    });
  });
});
