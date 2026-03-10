import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ContactPage from '../index.jsx';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: () => ({ children, variants, initial, animate, exit, transition, whileHover, whileInView, viewport, ...props }) => <div {...props}>{children}</div>,
  }),
}));

vi.mock('../../../components/layout/PublicHeader', () => ({
  default: () => <div>Public Header</div>,
}));

vi.mock('../../../components/layout/PublicFooter', () => ({
  default: () => <div>Public Footer</div>,
}));

const sendMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    contact: {
      send: (...args) => sendMock(...args),
    },
  },
}));

describe('ContactPage', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('shows a support fallback message when the contact inbox is unavailable', async () => {
    sendMock.mockRejectedValue({
      error: 'Contact inbox is not configured.',
    });

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText('Enter your name'), { target: { value: 'Akiyoshi' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'akiyoshiyapa@gmail.com' } });
    fireEvent.change(screen.getByPlaceholderText('What can we help you with?'), { target: { value: 'Need help' } });
    fireEvent.change(screen.getByPlaceholderText('Tell us more about your question or issue...'), { target: { value: 'Please help me with setup.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }));

    await waitFor(() => {
      expect(screen.getByText(/The contact form is unavailable right now\./i)).not.toBeNull();
    });

    expect(screen.getAllByText(/akiyoshiyapa@gmail\.com/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+94 71 121 4592/i).length).toBeGreaterThan(0);
  });
});
