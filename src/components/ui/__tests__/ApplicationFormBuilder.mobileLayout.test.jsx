import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import ApplicationFormBuilder from '../ApplicationFormBuilder.jsx';

vi.mock('framer-motion', () => {
  const createMotionComponent = (tag) => ({ children, ...props }) => React.createElement(tag, props, children);
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag) => createMotionComponent(tag),
      },
    ),
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

vi.mock('../../AppIcon', () => ({
  default: ({ name, className }) => <span data-testid={`icon-${name || 'unknown'}`} className={className} />,
}));

vi.mock('../Button', () => ({
  default: ({ children, className = '', iconName, ...props }) => (
    <button className={className} {...props}>
      {iconName ? <span data-testid={`button-icon-${iconName}`} /> : null}
      {children}
    </button>
  ),
}));

describe('ApplicationFormBuilder mobile layout', () => {
  it('lets long field labels wrap and stacks field actions for mobile rows', () => {
    render(
      <ApplicationFormBuilder
        fields={[
          {
            id: 'field-1',
            label: 'LinkedIn or Portfolio URL',
            type: 'url',
            required: false,
            options: [],
            placeholder: '',
          },
        ]}
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /custom application form/i }));

    const label = screen.getByText('LinkedIn or Portfolio URL');
    const labelBlock = label.parentElement;
    const contentRow = labelBlock?.parentElement;
    const actionButtons = Array.from(contentRow?.querySelectorAll('button') || []);
    const headerToggle = screen.getByRole('button', { name: /custom application form/i });
    const headerTitleGroup = screen.getByText('Custom Application Form').parentElement;

    expect(headerTitleGroup).not.toBeNull();
    expect(headerTitleGroup.className).toContain('min-w-0');
    expect(headerTitleGroup.className).toContain('flex-wrap');
    expect(contentRow).not.toBeNull();
    expect(contentRow.className).toContain('flex-col');
    expect(contentRow.className).toContain('sm:flex-row');
    expect(label.className).toContain('break-words');
    expect(label.className).toContain('sm:truncate');
    expect(actionButtons).toHaveLength(2);
    expect(actionButtons[0].className).toContain('p-2');
    expect(actionButtons[0].className).toContain('sm:p-1.5');
    expect(actionButtons[1].className).toContain('p-2');
    expect(actionButtons[1].className).toContain('sm:p-1.5');
    expect(headerToggle.className).toContain('items-start');
    expect(headerToggle.className).toContain('sm:items-center');
  });
});
