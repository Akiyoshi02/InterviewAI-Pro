import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

const countries = [
  {
    code: '+94',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    placeholder: '77 123 4567',
    format: (value) => {
      const digits = value.replace(/\D/g, '');
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 9)}`;
    },
    validate: (value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length === 9;
    },
  },
];

const PhoneInput = ({
  label,
  value = '',
  onChange,
  error,
  disabled = false,
  required = false,
  className = '',
  description,
}) => {
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  // Generate unique ID
  const inputId = `phone-input-${Math.random()?.toString(36)?.substr(2, 9)}`;

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !(menuRef.current && menuRef.current.contains(event.target))
      ) {
        setIsDropdownOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen || !triggerRef.current || typeof window === 'undefined') return undefined;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const padding = 8;
      const width = Math.min(rect.width, window.innerWidth - (padding * 2));
      const left = Math.min(
        Math.max(padding, rect.left),
        window.innerWidth - padding - width,
      );
      const top = Math.max(padding, rect.bottom + 6);
      setDropdownPosition({ top, left, width });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isDropdownOpen]);

  // Parse incoming value (e.g., "+94771234567" or "771234567")
  useEffect(() => {
    if (value) {
      const cleanValue = value.replace(/\s/g, '');
      const country = countries.find(c => cleanValue.startsWith(c.code));

      if (country) {
        setSelectedCountry(country);
        const numberPart = cleanValue.slice(country.code.length);
        setPhoneNumber(country.format(numberPart));
      } else {
        setPhoneNumber(countries[0].format(cleanValue));
      }
    } else {
      setPhoneNumber('');
    }
  }, [value]);

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    const formatted = selectedCountry.format(input);
    setPhoneNumber(formatted);

    // Send back the full number with country code
    const fullNumber = `${selectedCountry.code}${formatted.replace(/\s/g, '')}`;
    onChange?.(fullNumber);
  };

  const isValid = phoneNumber ? selectedCountry.validate(phoneNumber) : !required;

  // Base input classes matching Input component
  const baseInputClasses = "flex h-11 sm:h-12 w-full rounded-xl border border-input bg-background px-3 sm:px-4 py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px]";

  return (
    <div className={cn("space-y-1.5 sm:space-y-2", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            "text-sm sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            error ? "text-destructive" : "text-foreground"
          )}
        >
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}

      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          {/* Country Code Selector */}
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            disabled={disabled}
            className={cn(
              "h-11 sm:h-12 min-h-[44px] px-3 sm:px-4 flex items-center gap-2 border border-r-0 rounded-l-xl bg-background ring-offset-background transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
              error ? "border-destructive" : "border-input"
            )}
          >
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-base sm:text-sm font-medium text-foreground">
              {selectedCountry.code}
            </span>
            <svg
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                isDropdownOpen && "rotate-180"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {isDropdownOpen && typeof document !== 'undefined' && createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 2147483000,
              }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsDropdownOpen(false);
                }
              }}
            >
              <div
                ref={menuRef}
                style={{
                  position: 'absolute',
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                }}
                className="isolate !bg-white dark:!bg-slate-900 text-black dark:text-slate-100 border border-border dark:border-slate-700 rounded-xl shadow-lg ring-1 ring-black/10 overflow-hidden"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="py-1 !bg-white dark:!bg-slate-900">
                  {countries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setIsDropdownOpen(false);
                        setPhoneNumber('');
                        onChange?.('');
                      }}
                      className="relative flex cursor-pointer select-none items-center rounded-lg mx-1 w-full px-3 sm:px-3 py-1.5 sm:py-1 text-base sm:text-sm outline-none transition-colors min-h-[36px] sm:min-h-0 touch-manipulation hover:bg-gray-100 dark:hover:bg-slate-800 active:bg-gray-200 dark:active:bg-slate-700 text-gray-900 dark:text-slate-100"
                    >
                      <span className="text-lg mr-3">{country.flag}</span>
                      <span className="flex-1 text-left">
                        {country.name} ({country.code})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )}

          {/* Phone Number Input */}
          <input
            type="tel"
            id={inputId}
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder={selectedCountry.placeholder}
            disabled={disabled}
            className={cn(
              baseInputClasses,
              "rounded-l-none border-l-0",
              error && "border-destructive focus-visible:ring-destructive"
            )}
          />
        </div>

        {/* Validation Icon */}
        {phoneNumber && !error && (
          <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            {isValid ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Description Text */}
      {description && !error && (
        <p className="text-xs sm:text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-xs sm:text-sm text-destructive flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default PhoneInput;
