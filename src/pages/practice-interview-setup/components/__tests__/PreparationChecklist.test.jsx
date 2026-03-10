import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';
import PreparationChecklist from '../PreparationChecklist.jsx';

expect.extend(matchers);

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name }) => <span>{name}</span>,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, onClick, loading, iconName, iconPosition, ...props }) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/Checkbox', () => ({
  Checkbox: ({ checked, onChange, ...props }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      {...props}
    />
  ),
}));

describe('PreparationChecklist', () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it('allows interview start once required environment checks are complete even before device tests run', async () => {
    const onChecklistComplete = vi.fn();

    render(<PreparationChecklist onChecklistComplete={onChecklistComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /enable all/i }));
    expect(screen.getByText(/ready to start interview!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/device tests are recommended before you begin/i),
    ).toBeInTheDocument();

    expect(onChecklistComplete).toHaveBeenLastCalledWith(true);
  });

  it('keeps the checklist complete when device tests fail and shows reduced-media guidance', async () => {
    const onChecklistComplete = vi.fn();

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('No media devices available')),
      },
    });

    render(<PreparationChecklist onChecklistComplete={onChecklistComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /enable all/i }));
    fireEvent.click(screen.getByRole('button', { name: /test camera/i }));
    fireEvent.click(screen.getByRole('button', { name: /test mic/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/some devices are unavailable, but the session can continue with reduced media features/i),
      ).toBeInTheDocument();
    });

    expect(onChecklistComplete).toHaveBeenLastCalledWith(true);
  });
});
