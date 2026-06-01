// src/lib/utils/can.js
// Role-Based Access Control (RBAC) permissions matrix

export const PERMISSIONS = {
  // Projects
  'create:project': ['owner', 'admin'],
  'delete:project': ['owner', 'admin'],
  'edit:project_settings': ['owner', 'admin'],

  // Board Configuration
  'edit:board_columns': ['owner', 'admin'],

  // Sprints
  'manage:sprints': ['owner', 'admin'], // Створення/старт/завершення спринтів

  // Team
  'manage:team': ['owner', 'admin'],    // Запрошення/видалення учасників

  // Finance
  'manage:finance': ['owner'],          // Доступ до рейт-карток та інвойсів

  // Issues
  'create:issue': ['owner', 'admin', 'member'],
  'edit:issue': ['owner', 'admin', 'member'],
  'delete:issue': ['owner', 'admin'],   // Member не може видаляти завдання

  // Comments (clients can comment on issues they're invited to view)
  'create:comment': ['owner', 'admin', 'member', 'client'],
  'edit:comment': ['owner', 'admin', 'member', 'client'], // Only on own comments
};

/**
 * Checks if the given role is authorized to perform the action.
 * @param {string} role - The user's role in the organization (owner, admin, member, client)
 * @param {string} action - The action to check permission for
 * @returns {boolean} True if allowed, false otherwise
 */
export function can(role, action) {
  if (role === 'owner') return true; // Owner has full access
  if (!role) {
    // If role hasn't loaded yet, allow basic member actions so UI is not completely broken
    const memberActions = ['create:issue', 'edit:issue', 'create:project'];
    return memberActions.includes(action);
  }
  return PERMISSIONS[action]?.includes(role) || false;
}
