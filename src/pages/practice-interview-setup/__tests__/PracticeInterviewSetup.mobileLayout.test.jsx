import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PracticeInterviewSetup from '../index.jsx';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseToast = vi.fn();

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
  };
});

vi.mock('../../../contexts/AuthContext.jsx', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../../../components/ui/Toast', () => ({
  useToast: () => mockUseToast(),
}));

vi.mock('../../../components/ui/Header', () => ({
  default: () => <div>Header</div>,
}));

vi.mock('../../../components/ui/UserContextNavigation', () => ({
  default: () => <div>UserContextNavigation</div>,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, className, onClick, disabled, type = 'button' }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'unknown'}`} />,
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    interviews: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../components/JobRoleSelector.jsx', () => ({
  default: () => <div>JobRoleSelector</div>,
}));

vi.mock('../components/ExperienceLevelSelector.jsx', () => ({
  default: () => <div>ExperienceLevelSelector</div>,
}));

vi.mock('../components/IndustrySelector.jsx', () => ({
  default: () => <div>IndustrySelector</div>,
}));

vi.mock('../components/InterviewTypeSelector.jsx', () => ({
  default: () => <div>InterviewTypeSelector</div>,
}));

vi.mock('../components/SessionDurationSelector.jsx', () => ({
  default: () => <div>SessionDurationSelector</div>,
}));

vi.mock('../components/AdvancedSettings.jsx', () => ({
  default: () => <div>AdvancedSettings</div>,
}));

vi.mock('../components/AIInterviewerPreview.jsx', () => ({
  default: () => <div>AIInterviewerPreview</div>,
}));

vi.mock('../components/PreparationChecklist.jsx', () => ({
  default: () => <div>PreparationChecklist</div>,
}));

vi.mock('../components/TemplateSelector.jsx', () => ({
  default: () => <div>TemplateSelector</div>,
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <PracticeInterviewSetup />
    </MemoryRouter>,
  );

describe('PracticeInterviewSetup mobile quick-start card', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseToast.mockReset();
    localStorage.clear();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
      logout: vi.fn(),
    });

    mockUseToast.mockReturnValue({
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks the template quick-start card cleanly for mobile layouts', () => {
    renderPage();

    const title = screen.getByText('Start from a template');
    const description = screen.getByText('Use a pre-built configuration for common roles');
    const browseButton = screen.getByRole('button', { name: 'Browse Templates' });

    const quickStartCard = title.closest('div')?.parentElement;
    expect(quickStartCard).not.toBeNull();
    expect(quickStartCard.className).toContain('flex-col');
    expect(quickStartCard.className).toContain('sm:flex-row');
    expect(quickStartCard.className).toContain('gap-3');

    const copyColumn = title.parentElement;
    expect(copyColumn).not.toBeNull();
    expect(copyColumn.className).toContain('min-w-0');
    expect(description.className).toContain('leading-relaxed');
    expect(browseButton.className).toContain('w-full');
    expect(browseButton.className).toContain('sm:w-auto');
    expect(browseButton.className).toContain('justify-center');
  });
});
