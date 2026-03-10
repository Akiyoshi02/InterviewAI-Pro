import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SocialLogin from '../SocialLogin.jsx';

vi.mock('../../../../components/ui/Button', () => ({
  default: ({ children, onClick, disabled, type = 'button' }) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

describe('SocialLogin', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders only supported social sign-in actions', () => {
    render(<SocialLogin onSocialLogin={vi.fn()} isLoading={false} />);

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeTruthy();
    expect(screen.queryByText(/Continue with LinkedIn/i)).toBeNull();
  });
});
