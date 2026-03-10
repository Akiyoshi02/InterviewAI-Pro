import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LiveChatUnavailableState from '../LiveChatUnavailableState.jsx';

describe('LiveChatUnavailableState', () => {
  it('shows support fallback channels', () => {
    render(<LiveChatUnavailableState />);

    expect(screen.getByText('Live chat is unavailable right now.')).not.toBeNull();
    expect(screen.getByText('akiyoshiyapa@gmail.com')).not.toBeNull();
    expect(screen.getByText('+94 71 121 4592')).not.toBeNull();
  });
});
