import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecommendedTopics from '../RecommendedTopics.jsx';

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

describe('RecommendedTopics', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('wires refresh, practice, and explore actions', () => {
    const onRefresh = vi.fn();
    const onStartPractice = vi.fn();

    render(
      <MemoryRouter>
        <RecommendedTopics
          recommendations={[
            {
              id: 'topic_1',
              title: 'Backend Foundations',
              description: 'Focus on API design and data modeling.',
              difficulty: 'Intermediate',
              estimatedTime: '30 min',
              category: 'Technical',
              priority: 'high',
              completionRate: 40,
              icon: 'Cpu',
              practiceRole: 'backend-developer',
              practiceDifficulty: 'advanced',
            },
          ]}
          onRefresh={onRefresh}
          onStartPractice={onStartPractice}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore All Practice Topics' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onStartPractice).toHaveBeenCalledWith({
      role: 'backend-developer',
      difficulty: 'advanced',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/learning-center');
  });
});

