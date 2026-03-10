import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CompanyTemplatesPage from '../index.jsx';
import apiClient from '../../../services/apiClient.js';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseMaintenanceMode = vi.fn();
const mockHasPermission = vi.fn();

const LIBRARY_QUESTIONS = [
  {
    id: 'q1',
    prompt: 'Tell me about a tight deadline you handled.',
    type: 'BEHAVIORAL',
    difficulty: 'MEDIUM',
    competencies: ['communication'],
  },
  {
    id: 'q2',
    prompt: 'How would you design a retry strategy for APIs?',
    type: 'TECHNICAL',
    difficulty: 'MEDIUM',
    competencies: ['api-design'],
  },
  {
    id: 'q3',
    prompt: 'Explain a performance bottleneck you fixed.',
    type: 'TECHNICAL',
    difficulty: 'HARD',
    competencies: ['performance'],
  },
];

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

vi.mock('../../../hooks/useMaintenanceMode', () => ({
  useMaintenanceMode: () => mockUseMaintenanceMode(),
}));

vi.mock('../../../utils/rolePermissions', () => ({
  hasPermission: (...args) => mockHasPermission(...args),
}));

vi.mock('../../../services/apiClient.js', () => ({
  default: {
    templates: {
      list: vi.fn(),
      getStructuredCatalog: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../../../components/ui/Header.jsx', () => ({
  default: () => <div data-testid="header" />,
}));

vi.mock('../../../components/ui/UserContextNavigation.jsx', () => ({
  default: () => <div data-testid="user-context-navigation" />,
}));

vi.mock('../../../components/ui/MaintenanceBanner.jsx', () => ({
  default: () => <div data-testid="maintenance-banner" />,
}));

vi.mock('../../../components/AppIcon', () => ({
  default: ({ name }) => <span data-testid={`icon-${name || 'default'}`} />,
}));

vi.mock('../../../components/ui/LoadingState', () => ({
  default: ({ title }) => <div>{title}</div>,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick, type = 'button', disabled, loading }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {loading ? 'Loading' : children}
    </button>
  ),
}));

vi.mock('../../../components/ui/Input', () => ({
  default: ({ label, value, onChange, placeholder, type = 'text', className, min, max }) => (
    <label>
      {label}
      <input
        aria-label={label || placeholder || 'input'}
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        min={min}
        max={max}
      />
    </label>
  ),
}));

vi.mock('../../../components/ui/Select', () => ({
  default: ({ label, options = [], value, onChange, className }) => (
    <label>
      {label}
      <select
        aria-label={label || 'select'}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        className={className}
      >
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  ),
}));

describe('CompanyTemplatesPage', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseAuth.mockReset();
    mockUseMaintenanceMode.mockReset();
    mockHasPermission.mockReset();

    apiClient.templates.list.mockReset();
    apiClient.templates.getStructuredCatalog.mockReset();
    apiClient.templates.create.mockReset();
    apiClient.templates.update.mockReset();
    apiClient.templates.delete.mockReset();

    mockUseAuth.mockReturnValue({
      user: {
        id: 'company-user-1',
        accountType: 'COMPANY',
        organizationContext: {
          membership: { role: 'ADMIN' },
        },
      },
      logout: vi.fn(),
    });
    mockUseMaintenanceMode.mockReturnValue({ maintenanceMode: false });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <CompanyTemplatesPage />
      </MemoryRouter>,
    );

  it('shows permission gate when user lacks template management access', async () => {
    mockHasPermission.mockReturnValue(false);

    apiClient.templates.list.mockResolvedValue({ templates: [] });
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });

    renderPage();

    expect(await screen.findByText('You need hiring permissions to manage structured templates.')).toBeTruthy();
    expect(screen.queryByText('Structured Templates')).toBeNull();
  });

  it('keeps question selection exclusive between core and random pools', async () => {
    mockHasPermission.mockReturnValue(true);

    apiClient.templates.list.mockResolvedValue({
      templates: [
        {
          id: 'tpl-1',
          name: 'Structured Backend',
          jobRole: 'Backend Engineer',
          experienceLevel: 'MID',
          duration: 45,
          interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
          structuredQuestionSet: {
            coreQuestionIds: ['q1'],
            randomPoolIds: ['q2'],
          },
        },
      ],
    });
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [{ id: 'catalog-1', name: 'Catalog Template' }],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });

    renderPage();

    await screen.findByText('Structured Templates');
    await screen.findByText('Core Questions (1)');
    await screen.findByText('Random Pool (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle q1 as random' }));

    await waitFor(() => {
      expect(screen.getByText('Core Questions (0)')).toBeTruthy();
      expect(screen.getByText('Random Pool (2)')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Toggle q1 as core' }));

    await waitFor(() => {
      expect(screen.getByText('Core Questions (1)')).toBeTruthy();
      expect(screen.getByText('Random Pool (1)')).toBeTruthy();
    });
  });

  it('keeps the page header above the content section and removes the old summary strip', async () => {
    mockHasPermission.mockReturnValue(true);

    apiClient.templates.list.mockResolvedValue({ templates: [] });
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [{ id: 'catalog-1', name: 'Catalog Template' }],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });

    renderPage();

    await screen.findByText('Structured Templates');

    const header = screen.getByTestId('structured-templates-header');
    const actions = screen.getByTestId('structured-templates-actions');

    expect(header.className).toContain('mb-6');
    expect(header.className).toContain('flex');
    expect(header.className).toContain('sm:flex-row');
    expect(header.className).toContain('sm:items-center');
    expect(header.className).toContain('sm:justify-between');
    expect(actions.previousElementSibling).toBe(header);
    expect(actions.className).toContain('grid-cols-1');
    expect(actions.className).toContain('sm:grid-cols-3');
    expect(screen.queryByText('Catalog Templates')).toBeNull();
  });

  it('submits structured create payload with selected core questions', async () => {
    mockHasPermission.mockReturnValue(true);

    apiClient.templates.list.mockResolvedValue({ templates: [] });
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [{ id: 'catalog-1', name: 'Catalog Template' }],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });
    apiClient.templates.create.mockResolvedValue({
      template: {
        id: 'tpl-new',
        name: 'Structured SWE',
        jobRole: 'Software Engineer',
        experienceLevel: 'MID',
        duration: 30,
        interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
        structuredQuestionSet: {
          coreQuestionIds: ['q1'],
          randomPoolIds: [],
        },
      },
    });

    renderPage();
    await screen.findByText('Structured Templates');

    fireEvent.change(screen.getByLabelText('Template Name'), { target: { value: 'Structured SWE' } });
    fireEvent.change(screen.getByLabelText('Job Role'), { target: { value: 'Software Engineer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Toggle q1 as core' }));
    fireEvent.click(screen.getAllByRole('button', { name: /save template/i })[0]);

    await waitFor(() => {
      expect(apiClient.templates.create).toHaveBeenCalledTimes(1);
    });

    expect(apiClient.templates.update).not.toHaveBeenCalled();
    expect(apiClient.templates.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Structured SWE',
        jobRole: 'Software Engineer',
        interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
        structuredQuestionSet: expect.objectContaining({
          enabled: true,
          mode: 'HIRING',
          interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
          coreQuestionIds: ['q1'],
          randomPoolIds: [],
        }),
      }),
    );
  });

  it('submits structured update payload for an existing template', async () => {
    mockHasPermission.mockReturnValue(true);

    apiClient.templates.list.mockResolvedValue({
      templates: [
        {
          id: 'tpl-1',
          name: 'Structured Backend',
          jobRole: 'Backend Engineer',
          experienceLevel: 'MID',
          duration: 45,
          interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
          structuredQuestionSet: {
            coreQuestionIds: ['q1'],
            randomPoolIds: ['q2'],
          },
        },
      ],
    });
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [{ id: 'catalog-1', name: 'Catalog Template' }],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });
    apiClient.templates.update.mockResolvedValue({
      template: {
        id: 'tpl-1',
        name: 'Structured Backend Updated',
        jobRole: 'Backend Engineer',
        experienceLevel: 'MID',
        duration: 45,
        interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
        structuredQuestionSet: {
          coreQuestionIds: ['q1'],
          randomPoolIds: ['q2'],
        },
      },
    });

    renderPage();
    await screen.findByText('Structured Templates');

    fireEvent.change(screen.getByLabelText('Template Name'), { target: { value: 'Structured Backend Updated' } });
    fireEvent.click(screen.getAllByRole('button', { name: /save template/i })[0]);

    await waitFor(() => {
      expect(apiClient.templates.update).toHaveBeenCalledTimes(1);
    });

    expect(apiClient.templates.create).not.toHaveBeenCalled();
    expect(apiClient.templates.update).toHaveBeenCalledWith(
      'tpl-1',
      expect.objectContaining({
        name: 'Structured Backend Updated',
        jobRole: 'Backend Engineer',
        structuredQuestionSet: expect.objectContaining({
          coreQuestionIds: ['q1'],
          randomPoolIds: ['q2'],
        }),
      }),
    );
  });

  it('deletes selected template after confirmation', async () => {
    mockHasPermission.mockReturnValue(true);

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const template = {
      id: 'tpl-1',
      name: 'Structured Backend',
      jobRole: 'Backend Engineer',
      experienceLevel: 'MID',
      duration: 45,
      interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
      structuredQuestionSet: {
        coreQuestionIds: ['q1'],
        randomPoolIds: ['q2'],
      },
    };
    let currentTemplates = [template];

    apiClient.templates.list.mockImplementation(async () => ({ templates: currentTemplates }));
    apiClient.templates.getStructuredCatalog.mockResolvedValue({
      catalog: {
        templates: [{ id: 'catalog-1', name: 'Catalog Template' }],
        library: { questions: LIBRARY_QUESTIONS },
      },
    });
    apiClient.templates.delete.mockImplementation(async () => {
      currentTemplates = [];
      return { success: true };
    });

    renderPage();
    await screen.findByText('Structured Templates');
    expect(screen.getByText('Structured Backend')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(apiClient.templates.delete).toHaveBeenCalledTimes(1);
      expect(apiClient.templates.delete).toHaveBeenCalledWith('tpl-1');
    });

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText('Structured Backend')).toBeNull();
    });

    confirmSpy.mockRestore();
  });
});
