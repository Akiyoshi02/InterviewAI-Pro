import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Input from '../Input.jsx';

vi.mock('../../AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

describe('Input time field layout', () => {
  it('renders time inputs with a right-aligned clock icon and reserved padding', () => {
    render(<Input label="Business start" type="time" value="09:00" onChange={() => {}} />);

    const timeInput = screen.getByLabelText('Business start');
    const wrapper = timeInput.parentElement;
    const clockIcon = within(wrapper).getByTestId('icon-Clock3');

    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toContain('relative');
    expect(timeInput.className).toContain('time-input');
    expect(timeInput.className).toContain('appearance-none');
    expect(timeInput.className).toContain('pr-10');
    expect(clockIcon.className).toContain('absolute');
    expect(clockIcon.className).toContain('right-3');
    expect(clockIcon.className).toContain('pointer-events-none');
  });
});
