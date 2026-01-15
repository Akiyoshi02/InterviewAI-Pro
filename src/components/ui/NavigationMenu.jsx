// components/ui/NavigationMenu.jsx - Collapsible navigation menu component
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { cn } from '../../utils/cn';

/**
 * NavigationMenu - A collapsible menu component for navigation items with submenus
 * Used in both Header (as dropdown) and UserContextNavigation (as accordion)
 */
export const NavigationMenu = ({
  items = [],
  isCollapsed = false,
  variant = 'accordion', // 'accordion' for sidebar, 'dropdown' for header
  onItemClick,
  activeItem,
  className = '',
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const menuRef = useRef(null);

  // Determine if a path is active
  const isActivePath = (path) => {
    if (!path) return false;
    if (activeItem) return activeItem.startsWith(path);
    return location.pathname.startsWith(path);
  };

  // Handle group toggle
  const handleGroupToggle = (groupKey, e) => {
    e?.stopPropagation();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Handle item click
  const handleItemClick = (item, e) => {
    e?.stopPropagation();
    if (item.path) {
      if (onItemClick) {
        onItemClick(item.path, e);
      } else {
        navigate(item.path);
      }
    }
  };

  // Handle group click (if group has a path, navigate; otherwise toggle)
  const handleGroupClick = (group, e) => {
    e?.stopPropagation();
    if (group.path) {
      handleItemClick(group, e);
    } else {
      handleGroupToggle(group.key, e);
    }
  };

  // Auto-expand groups that contain the active item
  useEffect(() => {
    if (variant === 'accordion') {
      const activePath = activeItem || location.pathname;
      const activeGroup = items.find((item) => {
        if (item.items && item.items.length > 0) {
          return item.items.some((subItem) => activePath.startsWith(subItem.path));
        }
        return false;
      });
      if (activeGroup && activeGroup.key) {
        setExpandedGroups((prev) => new Set([...prev, activeGroup.key]));
      }
    }
  }, [location.pathname, activeItem, variant, items]);

  // Handle click outside for dropdown variant
  useEffect(() => {
    if (variant === 'dropdown') {
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setExpandedGroups(new Set());
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [variant]);

  if (variant === 'dropdown') {
    // Dropdown variant for Header
    return (
      <nav ref={menuRef} className={cn('relative', className)}>
        <div className="flex items-center gap-1 xl:gap-2">
          {items.map((item, index) => {
            const hasSubmenu = item.items && item.items.length > 0;
            const isExpanded = expandedGroups.has(item.key);
            const isActive = isActivePath(item.path) || (hasSubmenu && item.items.some((subItem) => isActivePath(subItem.path)));
            const itemKey = item.key || item.path || item.label || `nav-item-${index}`;

            if (!hasSubmenu) {
              // Regular navigation item (no submenu)
              return (
                <button
                  key={itemKey}
                  onClick={(e) => handleItemClick(item, e)}
                  className={cn(
                    'flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full min-h-touch',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    name={item.icon}
                    size={16}
                    className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-gray-400')}
                  />
                  <span className="hidden xl:inline">{item.fullLabel || item.label}</span>
                  <span className="xl:hidden">{item.label}</span>
                </button>
              );
            }

            // Group with submenu (dropdown)
            return (
              <div key={itemKey} className="relative">
                <button
                  onClick={(e) => handleGroupClick(item, e)}
                  className={cn(
                    'flex items-center gap-1.5 xl:gap-2 text-xs xl:text-sm font-medium transition-all duration-200 px-2.5 xl:px-3 py-2 rounded-full min-h-touch',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60'
                  )}
                  aria-expanded={isExpanded}
                  aria-haspopup="true"
                >
                  <Icon
                    name={item.icon}
                    size={16}
                    className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-gray-400')}
                  />
                  <span className="hidden xl:inline">{item.fullLabel || item.label}</span>
                  <span className="xl:hidden">{item.label}</span>
                  <Icon
                    name="ChevronDown"
                    size={14}
                    className={cn(
                      'flex-shrink-0 transition-transform duration-200',
                      isActive ? 'text-white' : 'text-gray-400',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {/* Dropdown Menu */}
                {isExpanded && (
                  <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] xl:min-w-[200px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-gray-200/50 dark:border-slate-800 rounded-xl shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden">
                    <div className="py-1">
                      {item.items.map((subItem, subIndex) => {
                        const isSubActive = isActivePath(subItem.path);
                        const subItemKey = subItem.path || subItem.key || subItem.label || `sub-item-${index}-${subIndex}`;
                        return (
                          <button
                            key={subItemKey}
                            onClick={(e) => handleItemClick(subItem, e)}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 xl:px-4 py-2.5 xl:py-3 text-sm transition-all duration-200 min-h-touch',
                              isSubActive
                                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                            )}
                            aria-current={isSubActive ? 'page' : undefined}
                          >
                            <Icon
                              name={subItem.icon}
                              size={16}
                              className={cn('flex-shrink-0', isSubActive ? 'text-white' : 'text-gray-400 dark:text-slate-500')}
                            />
                            <span className="font-medium">{subItem.fullLabel || subItem.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    );
  }

  // Accordion variant for UserContextNavigation (sidebar)
  return (
    <nav className={cn('space-y-1.5', className)}>
      {items.map((item, index) => {
        const hasSubmenu = item.items && item.items.length > 0;
        const isExpanded = expandedGroups.has(item.key);
        const isActive = isActivePath(item.path) || (hasSubmenu && item.items.some((subItem) => isActivePath(subItem.path)));
        const itemKey = item.key || item.path || item.label || `nav-item-${index}`;

        if (!hasSubmenu) {
          // Regular navigation item (no submenu)
          return (
            <button
              key={itemKey}
              onClick={(e) => handleItemClick(item, e)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 xl:py-3 rounded-xl xl:rounded-2xl transition-all duration-200 group min-h-touch',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-800/70'
              )}
              title={isCollapsed ? item.label : ''}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                name={item.icon}
                size={20}
                className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500')}
              />
              {!isCollapsed && (
                <div className="flex-1 text-left min-w-0">
                  <div className="font-semibold text-sm xl:text-base truncate">{item.label}</div>
                  {item.description && (
                    <div className={cn('text-xs truncate', isActive ? 'text-white/80' : 'text-gray-400 dark:text-slate-500')}>
                      {item.description}
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        }

        // Group with submenu (accordion)
        return (
          <div key={itemKey} className="space-y-1">
            <button
              onClick={(e) => handleGroupClick(item, e)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 xl:py-3 rounded-xl xl:rounded-2xl transition-all duration-200 group min-h-touch',
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/70 dark:hover:bg-slate-800/70'
              )}
              title={isCollapsed ? item.label : ''}
              aria-expanded={isExpanded}
              aria-haspopup="true"
            >
              <Icon
                name={item.icon}
                size={20}
                className={cn('flex-shrink-0', isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500')}
              />
              {!isCollapsed && (
                <>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-sm xl:text-base truncate">{item.label}</div>
                    {item.description && (
                      <div className={cn('text-xs truncate', isActive ? 'text-white/80' : 'text-gray-400 dark:text-slate-500')}>
                        {item.description}
                      </div>
                    )}
                  </div>
                  <Icon
                    name="ChevronDown"
                    size={16}
                    className={cn(
                      'flex-shrink-0 transition-transform duration-200',
                      isActive ? 'text-white' : 'text-gray-400 dark:text-slate-500',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </>
              )}
            </button>

            {/* Submenu Items */}
            {!isCollapsed && isExpanded && (
              <div className="pl-4 pr-3 space-y-1">
                {item.items.map((subItem, subIndex) => {
                  const isSubActive = isActivePath(subItem.path);
                  const subItemKey = subItem.path || subItem.key || subItem.label || `sub-item-${index}-${subIndex}`;
                  return (
                    <button
                      key={subItemKey}
                      onClick={(e) => handleItemClick(subItem, e)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 xl:py-2.5 rounded-lg xl:rounded-xl transition-all duration-200 min-h-touch',
                        isSubActive
                          ? 'bg-blue-600/20 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-600/30 dark:border-blue-500/30'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-white/50 dark:hover:bg-slate-800/50'
                      )}
                      aria-current={isSubActive ? 'page' : undefined}
                    >
                      <Icon
                        name={subItem.icon}
                        size={18}
                        className={cn('flex-shrink-0', isSubActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500')}
                      />
                      <div className="flex-1 text-left min-w-0">
                        <div className={cn('font-medium text-sm xl:text-base truncate', isSubActive && 'font-semibold')}>
                          {subItem.label}
                        </div>
                        {subItem.description && (
                          <div className={cn('text-xs truncate', isSubActive ? 'text-blue-600/80 dark:text-blue-400/80' : 'text-gray-500 dark:text-slate-500')}>
                            {subItem.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
};

export default NavigationMenu;
