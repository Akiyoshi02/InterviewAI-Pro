/**
 * Organization Role Permissions
 * 
 * Defines what features each organization role can access.
 * This is frontend UI control - backend still enforces all permissions.
 */

export const ORG_ROLES = {
  ADMIN: 'ADMIN',
  RECRUITER: 'RECRUITER',
  REVIEWER: 'REVIEWER',
};

/**
 * Feature permissions by role
 */
export const ROLE_PERMISSIONS = {
  // Job Management
  CREATE_JOBS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  EDIT_JOBS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  DELETE_JOBS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  VIEW_JOBS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  
  // Application Management
  VIEW_APPLICATIONS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  UPDATE_APPLICATION_STATUS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  
  // Candidate Management
  VIEW_CANDIDATES: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  MANAGE_CANDIDATES: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  START_CANDIDATE_REVIEW: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  
  // Interview Management
  SEND_INVITATIONS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  VIEW_INTERVIEWS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  
  // Template Management
  CREATE_TEMPLATES: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  EDIT_TEMPLATES: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  VIEW_TEMPLATES: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  
  // Reviews
  SUBMIT_REVIEWS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  VIEW_REVIEWS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  
  // Analytics
  VIEW_ANALYTICS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  EXPORT_REPORTS: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  
  // Organization Management
  MANAGE_ORGANIZATION: [ORG_ROLES.ADMIN],
  MANAGE_MEMBERS: [ORG_ROLES.ADMIN],
  VIEW_MEMBERS: [ORG_ROLES.ADMIN],
  
  // Navigation Access
  ACCESS_JOBS_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  ACCESS_TEMPLATES_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
  ACCESS_APPLICATIONS_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  ACCESS_INTERVIEWS_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  ACCESS_CANDIDATES_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER, ORG_ROLES.REVIEWER],
  ACCESS_ANALYTICS_PAGE: [ORG_ROLES.ADMIN, ORG_ROLES.RECRUITER],
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User's organization role (ADMIN, RECRUITER, REVIEWER)
 * @param {string} permission - Permission key from ROLE_PERMISSIONS
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  if (!role || !permission) return false;
  
  const normalizedRole = role.toUpperCase();
  const allowedRoles = ROLE_PERMISSIONS[permission];
  
  if (!allowedRoles) return false;
  
  return allowedRoles.includes(normalizedRole);
};

/**
 * Check if user has any of the specified permissions
 * @param {string} role - User's organization role
 * @param {string[]} permissions - Array of permission keys
 * @returns {boolean}
 */
export const hasAnyPermission = (role, permissions) => {
  if (!role || !Array.isArray(permissions)) return false;
  return permissions.some(permission => hasPermission(role, permission));
};

/**
 * Check if user has all of the specified permissions
 * @param {string} role - User's organization role
 * @param {string[]} permissions - Array of permission keys
 * @returns {boolean}
 */
export const hasAllPermissions = (role, permissions) => {
  if (!role || !Array.isArray(permissions)) return false;
  return permissions.every(permission => hasPermission(role, permission));
};

/**
 * Get user-friendly role display name
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleDisplayName = (role) => {
  const roleNames = {
    ADMIN: 'Administrator',
    RECRUITER: 'Recruiter',
    REVIEWER: 'Reviewer',
  };
  return roleNames[role?.toUpperCase()] || role || 'Member';
};

/**
 * Get role description
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleDescription = (role) => {
  const descriptions = {
    ADMIN: 'Full access to all features including organization management',
    RECRUITER: 'Manage jobs, applications, candidates, interviews, and scheduling',
    REVIEWER: 'Review interviews and view candidate information (read-only access)',
  };
  return descriptions[role?.toUpperCase()] || '';
};

/**
 * Get role badge color classes
 * @param {string} role - Role key
 * @returns {string}
 */
export const getRoleBadgeColor = (role) => {
  const colors = {
    ADMIN: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
    RECRUITER: 'bg-gradient-to-r from-blue-600 to-purple-600 text-white',
    REVIEWER: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white',
  };
  return colors[role?.toUpperCase()] || 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300';
};

/**
 * Filter navigation items based on role permissions
 * Supports both flat items and nested items (groups with submenus)
 * @param {Array} navItems - Navigation items array
 * @param {string} role - User's organization role
 * @returns {Array}
 */
export const filterNavByRole = (navItems, role) => {
  if (!Array.isArray(navItems)) return [];

  const normalizedRole = typeof role === 'string' ? role.toUpperCase() : '';
  
  return navItems
    .map(item => {
      // If item has nested items (submenu), filter those too
      if (item.items && Array.isArray(item.items)) {
        const filteredSubItems = filterNavByRole(item.items, normalizedRole);
        // If group has no requiredPermission, check if any subitem is visible
        if (!item.requiredPermission) {
          // Only include group if it has visible subitems
          return filteredSubItems.length > 0 ? { ...item, items: filteredSubItems } : null;
        }
        // If group has requiredPermission, check it first
        if (hasPermission(normalizedRole, item.requiredPermission)) {
          return { ...item, items: filteredSubItems };
        }
        return null;
      }
      
      // Regular item (no submenu)
      if (item.requiredPermission) {
        return hasPermission(normalizedRole, item.requiredPermission) ? item : null;
      }
      // If no permission specified, show by default
      return item;
    })
    .filter(item => item !== null); // Remove filtered out items
};

