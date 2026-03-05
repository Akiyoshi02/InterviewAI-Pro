import React from 'react';
import Icon from '../AppIcon';
import Button from './Button';
import Select from './Select';
import { cn } from '../../utils/cn';

export const FILTER_PANEL_CLASS =
  'rounded-2xl border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-slate-900/70 p-4 sm:p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] dark:shadow-[0_14px_34px_rgba(2,6,23,0.4)] backdrop-blur-sm space-y-4';

export const FILTER_LABEL_CLASS =
  'text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400';

export const FILTER_CONTROL_CLASS =
  'h-11 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/80 focus:border-transparent';

export const FILTER_SEARCH_INPUT_CLASS = `${FILTER_CONTROL_CLASS} pl-10`;

export const FILTER_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3';
export const FILTER_DATE_GRID_CLASS = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
export const FILTER_SUBPANEL_CLASS =
  'rounded-xl border border-slate-200/70 dark:border-slate-700/60 bg-slate-50/70 dark:bg-slate-900/50 p-3 sm:p-4 space-y-3';

const ActiveFilterBadge = ({ activeCount = 0 }) => {
  const hasActive = activeCount > 0;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        hasActive
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300'
          : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400',
      )}
    >
      {hasActive ? `${activeCount} active` : 'No active filters'}
    </span>
  );
};

export const UnifiedFilterPanel = ({
  title = 'Filters',
  description,
  activeCount = 0,
  onClear,
  clearLabel = 'Clear Filters',
  headerActions,
  stackHeader = false,
  className,
  children,
}) => (
  <div className={cn(FILTER_PANEL_CLASS, className)}>
    <div
      className={cn(
        'flex flex-col gap-3',
        !stackHeader && 'lg:flex-row lg:items-start lg:justify-between',
      )}
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <ActiveFilterBadge activeCount={activeCount} />
        </div>
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-400">{description}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {headerActions}
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          disabled={activeCount === 0}
          className="rounded-xl shrink-0"
        >
          <Icon name="X" className="w-3.5 h-3.5 mr-1.5" />
          {clearLabel}
        </Button>
      </div>
    </div>
    {children}
  </div>
);

export const UnifiedFilterField = ({ label, className, children }) => (
  <label className={cn('space-y-1.5', className)}>
    {label && <span className={FILTER_LABEL_CLASS}>{label}</span>}
    {children}
  </label>
);

export const UnifiedSearchField = ({
  label,
  iconName = 'Search',
  className,
  inputClassName,
  ...inputProps
}) => (
  <UnifiedFilterField label={label} className={className}>
    <div className="relative">
      <Icon
        name={iconName}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
      />
      <input {...inputProps} className={cn(FILTER_SEARCH_INPUT_CLASS, inputClassName)} />
    </div>
  </UnifiedFilterField>
);

export const UnifiedTextInput = React.forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(FILTER_CONTROL_CLASS, className)} {...props} />
));

UnifiedTextInput.displayName = 'UnifiedTextInput';

export const UnifiedFilterSelect = ({ label, className, ...selectProps }) => (
  <UnifiedFilterField label={label} className={className}>
    <Select {...selectProps} className="w-full" />
  </UnifiedFilterField>
);

export const UnifiedFilterToggleButton = ({
  active = false,
  onClick,
  label = 'Advanced Filters',
  className,
}) => (
  <Button
    variant={active ? 'default' : 'outline'}
    size="sm"
    onClick={onClick}
    className={cn('rounded-xl', className)}
  >
    <Icon name="SlidersHorizontal" className="w-4 h-4 mr-2" />
    {label}
  </Button>
);

export default UnifiedFilterPanel;
