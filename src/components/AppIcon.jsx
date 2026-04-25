import React from 'react';
import * as LucideIcons from 'lucide-react';
import { HelpCircle } from 'lucide-react';
import BrandBrainIcon from './BrandBrainIcon';

const CUSTOM_ICONS = {
    BrandBrain: BrandBrainIcon,
};

const ICON_ALIASES = {
    Sparkle: 'BrandBrain',
    Sparkles: 'BrandBrain',
    Star: 'BrandBrain',
    StarHalf: 'BrandBrain',
    StarOff: 'BrandBrain',
    Stars: 'BrandBrain',
};

function Icon({
    name,
    size = 24,
    color = "currentColor",
    className = "",
    strokeWidth = 2,
    ...props
}) {
    const resolvedName = ICON_ALIASES?.[name] || name;
    const CustomIconComponent = CUSTOM_ICONS?.[resolvedName];

    if (CustomIconComponent) {
        return <CustomIconComponent
            size={size}
            color={color}
            strokeWidth={strokeWidth}
            className={className}
            {...props}
        />;
    }

    const IconComponent = LucideIcons?.[resolvedName];

    if (!IconComponent) {
        return <HelpCircle size={size} color="gray" strokeWidth={strokeWidth} className={className} {...props} />;
    }

    return <IconComponent
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        className={className}
        {...props}
    />;
}
export default Icon;
