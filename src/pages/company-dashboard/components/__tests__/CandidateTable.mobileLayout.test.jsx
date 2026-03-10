import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import CandidateTable from '../CandidateTable.jsx';

vi.mock('../../../../components/AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../../../../components/AppImage', () => ({
  default: ({ src, alt, className }) => <img src={src} alt={alt} className={className} />,
}));

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, className = '', variant, size, iconName, iconPosition, loading, ...props }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('../../../../components/ui/UnifiedFilterPanel', () => ({
  default: ({ children }) => <div>{children}</div>,
  FILTER_GRID_CLASS: 'filter-grid',
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
  UnifiedSearchField: ({ label, ...props }) => (
    <label>
      <span>{label}</span>
      <input {...props} />
    </label>
  ),
}));

describe('CandidateTable mobile card layout', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:export');
    global.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('stacks the mobile card header and uses a responsive action grid for long interview cards', () => {
    const onViewRecording = vi.fn();
    const onViewAnalysis = vi.fn();
    const interview = {
      id: 'int-1',
      candidateId: 'candidate-1',
      candidate: {
        id: 'candidate-1',
        fullName: 'Akiyoshi Hikaru Yapa',
        email: 'akiyoshi@example.com',
        photoURL: 'https://example.com/avatar.png',
      },
      jobRole: 'Account Test - DevOps Engineer 1772688268883',
      status: 'SCHEDULED',
      scheduledFor: '2026-03-09T09:00:00.000Z',
      overallScore: null,
    };

    const { container } = render(
      <CandidateTable
        interviews={[interview]}
        onViewRecording={onViewRecording}
        onViewAnalysis={onViewAnalysis}
        canExport={false}
        canUpdateStatus={false}
      />,
    );

    const mobileCards = container.querySelector('.lg\\:hidden');
    const mobileCard = within(mobileCards).getByText('Akiyoshi Hikaru Yapa').closest('div[class*="backdrop-blur"]');
    const headerRow = within(mobileCard).getByText('Akiyoshi Hikaru Yapa').closest('div.min-w-0')?.parentElement?.parentElement;
    const textGroup = within(mobileCard).getByText('Akiyoshi Hikaru Yapa').closest('div');
    const positionText = within(mobileCard).getByText('Account Test - DevOps Engineer 1772688268883');
    const actionGrid = within(mobileCard).getByRole('button', { name: 'Recording' }).parentElement;
    const recordingButton = within(mobileCard).getByRole('button', { name: 'Recording' });
    const analysisButton = within(mobileCard).getByRole('button', { name: 'Analysis' });

    expect(mobileCard).not.toBeNull();
    expect(headerRow).not.toBeNull();
    expect(headerRow.className).toContain('flex-col');
    expect(headerRow.className).toContain('sm:flex-row');
    expect(textGroup).not.toBeNull();
    expect(textGroup.className).toContain('min-w-0');
    expect(positionText.className).toContain('break-words');
    expect(positionText.className).toContain('leading-snug');
    expect(actionGrid).not.toBeNull();
    expect(actionGrid.className).toContain('grid-cols-1');
    expect(actionGrid.className).toContain('xs:grid-cols-2');
    expect(recordingButton.className).toContain('w-full');
    expect(recordingButton.className).toContain('justify-center');
    expect(analysisButton.className).toContain('w-full');
    expect(analysisButton.className).toContain('justify-center');
  });
});
