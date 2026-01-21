import React, { useLayoutEffect } from 'react';
import { cn } from '../../utils/cn';
import LoadingIndicator from './LoadingIndicator';
import { decrementLoadingScreen, incrementLoadingScreen } from '../../utils/loadingScreenState';

const VARIANT_SIZES = {
  fullscreen: 'xl',
  card: 'lg',
  section: 'lg',
  inline: 'sm',
  compact: 'sm',
};

const LoadingState = ({
  title = 'Loading',
  message = 'Preparing your experience...',
  variant = 'fullscreen',
  tone = 'primary',
  size,
  align = 'center',
  showProgress = true,
  badge,
  className = '',
}) => {
  const isInline = variant === 'inline' || variant === 'compact';
  const isFullscreen = variant === 'fullscreen';
  const indicatorSize = size || VARIANT_SIZES[variant] || 'md';
  const alignmentClasses = align === 'left'
    ? 'items-start text-left'
    : 'items-center text-center';

  useLayoutEffect(() => {
    if (!isFullscreen) {
      return;
    }

    incrementLoadingScreen();
    return () => {
      decrementLoadingScreen();
    };
  }, [isFullscreen]);

  if (isInline) {
    return (
      <div
        className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <LoadingIndicator size={indicatorSize} tone={tone} />
        <span>{title}</span>
      </div>
    );
  }

  const content = (
    <div className={cn('flex flex-col gap-3', alignmentClasses)}>
      {badge && (
        <span className="text-[10px] uppercase tracking-[0.35em] text-primary/70 dark:text-blue-300">
          {badge}
        </span>
      )}
      <LoadingIndicator size={indicatorSize} tone={tone} />
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">
          Loading
        </p>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">
          {title}
        </h2>
        {message && (
          <p className="text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </div>
      {showProgress && (
        <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-muted/70">
          <span className="loading-bar" />
        </div>
      )}
    </div>
  );

  if (variant === 'card' || variant === 'section') {
    return (
      <div
        className={cn('card-base p-4 sm:p-6 flex items-center justify-center', className)}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center px-4 py-10 overflow-hidden',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 right-0 h-56 w-56 sm:h-72 sm:w-72 bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-[-10%] h-[260px] w-[260px] sm:h-[360px] sm:w-[360px] bg-gradient-to-tr from-sky-300/25 via-blue-200/20 to-transparent blur-[120px]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.12),transparent_45%),radial-gradient(circle_at_85%_0%,rgba(14,165,233,0.12),transparent_40%)]" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="card-base p-6 sm:p-8">
          {content}
        </div>
      </div>
    </div>
  );
};

export default LoadingState;
