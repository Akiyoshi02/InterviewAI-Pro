import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Select from '../Select.jsx';

describe('Select mobile value layout', () => {
  it('keeps long selected values shrinkable inside the trigger button', () => {
    render(
      <Select
        label="Institution Name"
        options={[
          {
            value: 'sliit',
            label: 'Sri Lanka Institute of Information Technology (SLIIT)',
          },
        ]}
        value="sliit"
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole('button');
    const wrapper = trigger.parentElement?.parentElement;
    const triggerContainer = trigger.parentElement;
    const [valueSlot, iconGroup] = Array.from(trigger.children);

    expect(wrapper).not.toBeNull();
    expect(wrapper.className).toContain('min-w-0');
    expect(triggerContainer).not.toBeNull();
    expect(triggerContainer.className).toContain('min-w-0');
    expect(trigger.className).toContain('gap-2');
    expect(trigger.className).toContain('overflow-hidden');
    expect(valueSlot.className).toContain('min-w-0');
    expect(valueSlot.className).toContain('flex-1');
    expect(valueSlot.className).toContain('truncate');
    expect(valueSlot.className).toContain('text-left');
    expect(iconGroup.className).toContain('shrink-0');
  });
});
