import React from 'react';
import { getRoleBadgeColor, getRoleDisplayName, getRoleDescription } from '../../utils/rolePermissions';

const RoleBadge = ({ role, showDescription = false, className = '' }) => {
  if (!role) return null;

  const displayName = getRoleDisplayName(role);
  const badgeColor = getRoleBadgeColor(role);
  const description = getRoleDescription(role);

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <span 
        className={`px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${badgeColor}`}
        title={description}
      >
        {displayName}
      </span>
      {showDescription && description && (
        <span className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          {description}
        </span>
      )}
    </div>
  );
};

export default RoleBadge;

