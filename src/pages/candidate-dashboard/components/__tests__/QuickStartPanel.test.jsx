import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import QuickStartPanel from '../QuickStartPanel.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../../components/ui/Button.jsx', () => ({
  default: ({ children, onClick, disabled, type = 'button' }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/AppIcon.jsx', () => ({
  default: () => <span data-testid="mock-icon" />,
}));

vi.mock('../../../../components/ui/Select.jsx', () => ({
  default: ({ label, options = [], value = '', onChange }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

describe('QuickStartPanel', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const completeQuickStartForm = () => {
    fireEvent.change(screen.getByLabelText('Job Role'), {
      target: { value: 'software-engineer' },
    });
    fireEvent.change(screen.getByLabelText('Difficulty Level'), {
      target: { value: 'advanced' },
    });
  };

  it('calls onStartPractice with selected role and difficulty', () => {
    const onStartPractice = vi.fn();

    render(<QuickStartPanel onStartPractice={onStartPractice} />);
    completeQuickStartForm();

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice Interview' }));

    expect(onStartPractice).toHaveBeenCalledTimes(1);
    expect(onStartPractice).toHaveBeenCalledWith({
      role: 'software-engineer',
      difficulty: 'advanced',
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to navigating to setup with selected params when no callback is passed', () => {
    render(<QuickStartPanel />);
    completeQuickStartForm();

    fireEvent.click(screen.getByRole('button', { name: 'Start Practice Interview' }));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      '/practice-interview-setup?role=software-engineer&difficulty=advanced',
    );
  });
});
