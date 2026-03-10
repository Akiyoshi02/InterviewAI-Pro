import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import CandidateNotesTimeline from '../CandidateNotesTimeline.jsx';

vi.mock('framer-motion', () => {
  const MotionDiv = ({ children, ...props }) => <div {...props}>{children}</div>;
  return {
    motion: {
      div: MotionDiv,
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../AppIcon', () => ({
  default: ({ name }) => <span>{name || 'Icon'}</span>,
}));

vi.mock('../Button', () => ({
  default: ({
    children,
    className,
    onClick,
    disabled,
    type = 'button',
    iconName: _iconName,
    ...props
  }) => (
    <button type={type} className={className} onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

describe('CandidateNotesTimeline mobile layout', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('stacks the note composer controls on mobile while keeping the desktop row layout', () => {
    render(
      <CandidateNotesTimeline
        applicationId="application-1"
        candidateName="Akiyoshi Hikaru Yapa"
        applicationStatus="SCREENING"
      />
    );

    const title = screen.getByRole('heading', { name: /activity timeline/i });
    const composer = screen.getByTestId('candidate-notes-composer-row');
    const typeWrapper = screen.getByTestId('candidate-note-type-wrapper');
    const noteInput = screen.getByPlaceholderText('Add a note... (Ctrl+Enter to save)');
    const addButton = screen.getByRole('button', { name: /add note/i });

    expect(title.className).toContain('flex-wrap');
    expect(composer.className).toContain('flex-col');
    expect(composer.className).toContain('sm:flex-row');
    expect(typeWrapper.className).toContain('w-full');
    expect(typeWrapper.className).toContain('sm:w-32');
    expect(noteInput.className).toContain('w-full');
    expect(noteInput.className).toContain('sm:flex-1');
    expect(addButton.className).toContain('w-full');
    expect(addButton.className).toContain('sm:w-auto');
  });
});
