// components/ui/Select.jsx - Shadcn style Select
import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";
import { cn } from "../../utils/cn";
import Button from "./Button";
import Input from "./Input";

const Select = React.forwardRef(({
    className,
    options = [],
    value,
    defaultValue,
    placeholder = "Select an option",
    multiple = false,
    disabled = false,
    required = false,
    label,
    description,
    error,
    searchable = false,
    clearable = false,
    loading = false,
    id,
    name,
    onChange,
    onOpenChange,
    ...props
}, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const selectRef = useRef(null);
    const buttonRef = useRef(null);

    // Merge refs for the button
    useEffect(() => {
        if (typeof ref === 'function') {
            ref(buttonRef.current);
        } else if (ref) {
            ref.current = buttonRef.current;
        }
    }, [ref]);

    // Generate unique ID if not provided
    const selectId = id || `select-${Math.random()?.toString(36)?.substr(2, 9)}`;

    // Handle click outside and Escape key to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (selectRef.current && !selectRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm("");
                onOpenChange?.(false);
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setSearchTerm("");
                onOpenChange?.(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onOpenChange]);

    // Filter options based on search
    const filteredOptions = searchable && searchTerm
        ? options?.filter(option =>
            option?.label?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
            (option?.value && option?.value?.toString()?.toLowerCase()?.includes(searchTerm?.toLowerCase()))
        )
        : options;

    // Get selected option(s) for display
    const getSelectedDisplay = () => {
        if (!value) return placeholder;

        if (multiple) {
            const selectedOptions = options?.filter(opt => value?.includes(opt?.value));
            if (selectedOptions?.length === 0) return placeholder;
            if (selectedOptions?.length === 1) return selectedOptions?.[0]?.label;
            return `${selectedOptions?.length} items selected`;
        }

        const selectedOption = options?.find(opt => opt?.value === value);
        return selectedOption ? selectedOption?.label : placeholder;
    };

    const handleToggle = () => {
        if (!disabled) {
            const newIsOpen = !isOpen;
            setIsOpen(newIsOpen);
            onOpenChange?.(newIsOpen);
            if (!newIsOpen) {
                setSearchTerm("");
            }
        }
    };

    const handleOptionSelect = (option) => {
        if (multiple) {
            const newValue = value || [];
            const updatedValue = newValue?.includes(option?.value)
                ? newValue?.filter(v => v !== option?.value)
                : [...newValue, option?.value];
            onChange?.(updatedValue);
        } else {
            onChange?.(option?.value);
            setIsOpen(false);
            onOpenChange?.(false);
        }
    };

    const handleClear = (e) => {
        e?.stopPropagation();
        onChange?.(multiple ? [] : '');
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e?.target?.value);
    };

    const isSelected = (optionValue) => {
        if (multiple) {
            return value?.includes(optionValue) || false;
        }
        return value === optionValue;
    };

    const hasValue = multiple ? value?.length > 0 : value !== undefined && value !== '';

    return (
        <div ref={selectRef} className={cn("space-y-1.5 sm:space-y-2", className)}>
            {label && (
                <label
                    htmlFor={selectId}
                    className={cn(
                        "text-sm sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 block",
                        error ? "text-destructive" : "text-foreground"
                    )}
                >
                    {label}
                    {required && <span className="text-destructive ml-1">*</span>}
                </label>
            )}
            <div className="relative">
                <button
                    ref={buttonRef}
                    id={selectId}
                    type="button"
                    className={cn(
                        "flex h-11 sm:h-12 min-h-[44px] w-full items-center justify-between rounded-xl border border-input bg-background dark:bg-slate-900 text-foreground dark:text-slate-100 px-3 sm:px-4 py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation transition-colors",
                        error && "border-destructive focus:ring-destructive",
                        !hasValue && "text-muted-foreground dark:text-slate-400"
                    )}
                    onClick={handleToggle}
                    disabled={disabled}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    {...props}
                >
                    <span className="truncate">{getSelectedDisplay()}</span>

                    <div className="flex items-center gap-1.5">
                        {loading && (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}

                        {clearable && hasValue && !loading && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 sm:h-4 sm:w-4"
                                onClick={handleClear}
                            >
                                <X className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                            </Button>
                        )}

                        <ChevronDown className={cn("h-5 w-5 sm:h-4 sm:w-4 transition-transform", isOpen && "rotate-180")} />
                    </div>
                </button>

                {/* Hidden native select for form submission */}
                <select
                    name={name}
                    value={value || ''}
                    onChange={() => { }} // Controlled by our custom logic
                    className="sr-only"
                    tabIndex={-1}
                    multiple={multiple}
                    required={required}
                >
                    <option value="">Select...</option>
                    {options?.map(option => (
                        <option key={option?.value} value={option?.value}>
                            {option?.label}
                        </option>
                    ))}
                </select>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute z-[100] w-full mt-1 bg-white dark:bg-slate-900 text-black dark:text-slate-100 border border-border dark:border-slate-700 rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 overflow-hidden">
                        {searchable && (
                            <div className="p-2.5 sm:p-2 border-b border-gray-200 dark:border-slate-700">
                                <div className="relative">
                                    <Search className="absolute left-2.5 sm:left-2 top-3 sm:top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search options..."
                                        value={searchTerm}
                                        onChange={handleSearchChange}
                                        className="pl-9 sm:pl-8"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="py-1 max-h-60 overflow-auto overscroll-contain">
                            {filteredOptions?.length === 0 ? (
                                <div className="px-4 sm:px-3 py-3 sm:py-2 text-sm text-muted-foreground dark:text-slate-400">
                                    {searchTerm ? 'No options found' : 'No options available'}
                                </div>
                            ) : (
                                filteredOptions?.map((option) => (
                                    <div
                                        key={option?.value}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-lg mx-1 px-3 sm:px-3 py-3 sm:py-2 text-base sm:text-sm outline-none transition-colors min-h-[44px] sm:min-h-0 touch-manipulation",
                                            isSelected(option?.value) 
                                                ? "bg-blue-600 dark:bg-blue-700 text-white" 
                                                : "hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 text-gray-900 dark:text-slate-100",
                                            option?.disabled && "pointer-events-none opacity-50"
                                        )}
                                        onClick={() => !option?.disabled && handleOptionSelect(option)}
                                    >
                                        <span className="flex-1">{option?.label}</span>
                                        {multiple && isSelected(option?.value) && (
                                            <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                                        )}
                                        {option?.description && (
                                            <span className={cn(
                                                "text-xs ml-2",
                                                isSelected(option?.value) 
                                                    ? "text-white/80" 
                                                    : "text-muted-foreground dark:text-slate-400"
                                            )}>
                                                {option?.description}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            {description && !error && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-1">
                    {description}
                </p>
            )}
            {error && (
                <p className="text-xs sm:text-sm text-destructive mt-1.5 sm:mt-1">
                    {error}
                </p>
            )}
        </div>
    );
});

Select.displayName = "Select";

export default Select;
