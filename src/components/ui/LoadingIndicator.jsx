import React, { useId } from 'react';
import { cn } from '../../utils/cn';

const SIZE_MAP = {
  xs: 14,
  sm: 18,
  md: 28,
  lg: 40,
  xl: 56,
  '2xl': 72,
};

const LoadingIndicator = ({
  size = 'md',
  tone = 'primary',
  className = '',
  style,
}) => {
  const uid = useId();
  const gradientId = `loader-gradient-${uid}`;
  const glowId = `loader-glow-${uid}`;
  const coreId = `loader-core-${uid}`;
  const resolvedSize = typeof size === 'number' ? size : (SIZE_MAP[size] || SIZE_MAP.md);
  const isCurrentTone = tone === 'current';

  const toneStyle = isCurrentTone ? {
    '--loader-accent': 'currentColor',
    '--loader-accent-strong': 'currentColor',
    '--loader-highlight': 'currentColor',
    '--loader-track': 'color-mix(in srgb, currentColor 20%, transparent)',
    '--loader-core': 'color-mix(in srgb, currentColor 25%, transparent)',
    '--loader-core-soft': 'color-mix(in srgb, currentColor 12%, transparent)',
    '--loader-core-shadow': 'color-mix(in srgb, currentColor 35%, transparent)',
  } : {};

  return (
    <span
      className={cn('loading-indicator', className)}
      data-tone={isCurrentTone ? undefined : tone}
      style={{
        '--loader-size': `${resolvedSize}px`,
        ...toneStyle,
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="loading-indicator__svg" role="presentation">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--loader-accent-strong)" />
            <stop offset="52%" stopColor="var(--loader-accent)" />
            <stop offset="100%" stopColor="var(--loader-highlight)" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--loader-highlight)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--loader-highlight)" stopOpacity="0.35" />
          </radialGradient>
          <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--loader-core)" stopOpacity="0.95" />
            <stop offset="70%" stopColor="var(--loader-core)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--loader-core-soft)" stopOpacity="0.1" />
          </radialGradient>
        </defs>
        <circle className="loading-indicator__track" cx="60" cy="60" r="46" />
        <g className="loading-indicator__spin">
          <circle
            className="loading-indicator__arc"
            cx="60"
            cy="60"
            r="46"
            stroke={`url(#${gradientId})`}
            strokeDasharray="210 90"
          />
          <circle className="loading-indicator__dot" cx="60" cy="14" r="6" fill={`url(#${glowId})`} />
        </g>
        <circle className="loading-indicator__core" cx="60" cy="60" r="18" fill={`url(#${coreId})`} />
      </svg>
    </span>
  );
};

export default LoadingIndicator;
