import React from "react";
import { cn } from "../../utils/cn";
import Icon from "../AppIcon";

const Input = React.forwardRef(({
    className,
    type = "text",
    label,
    description,
    error,
    required = false,
    id,
    iconName,
    ...props
}, ref) => {
    // Generate unique ID if not provided
    const inputId = id || `input-${Math.random()?.toString(36)?.substr(2, 9)}`;

    // Base input classes with improved mobile styling
    const baseInputClasses = "flex h-11 sm:h-12 w-full rounded-xl border border-input bg-background px-3 sm:px-4 py-2.5 text-base sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px]";

    // Checkbox-specific styles
    if (type === "checkbox") {
        return (
            <input
                type="checkbox"
                className={cn(
                    "h-5 w-5 sm:h-4 sm:w-4 rounded-full border border-input bg-background appearance-none shrink-0 cursor-pointer transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    "checked:border-primary checked:bg-primary checked:bg-center checked:bg-no-repeat checked:bg-[length:65%_65%]",
                    "checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%223%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%3E%3Cpath%20d=%22M4%2010l4%204%208-8%22/%3E%3C/svg%3E')]",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                id={inputId}
                {...props}
            />
        );
    }

    // Radio button-specific styles
    if (type === "radio") {
        return (
            <input
                type="radio"
                className={cn(
                    "h-5 w-5 sm:h-4 sm:w-4 rounded-full border border-input bg-background text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-colors",
                    className
                )}
                ref={ref}
                id={inputId}
                {...props}
            />
        );
    }

    // For regular inputs with wrapper structure
    return (
        <div className="space-y-1.5 sm:space-y-2">
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

            {type === "time" ? (
                <div className="relative">
                    <input
                        type={type}
                        className={cn(
                            baseInputClasses,
                            "time-input appearance-none pr-10",
                            error && "border-destructive focus-visible:ring-destructive",
                            className
                        )}
                        ref={ref}
                        id={inputId}
                        {...props}
                    />
                    <Icon
                        name="Clock3"
                        size={18}
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-slate-400"
                    />
                </div>
            ) : (
                <input
                    type={type}
                    className={cn(
                        baseInputClasses,
                        error && "border-destructive focus-visible:ring-destructive",
                        className
                    )}
                    ref={ref}
                    id={inputId}
                    {...props}
                />
            )}

            {description && !error && (
                <p className="text-xs sm:text-sm text-muted-foreground">
                    {description}
                </p>
            )}

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
});

Input.displayName = "Input";

export default Input;
