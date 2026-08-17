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
  //
  // Owner *and* admin, because that is what the product actually enforces:
  // `firestore.rules` lets an org admin read an invoice, `/api/invoices`
  // authorises `['owner', 'admin']`, and the analytics tab has always shown the
  // «Рахунок» section to both. This entry said `owner` alone and was never
  // called by anything — the screen rolled its own check — so the matrix
  // documented a restriction the product did not have. Rules are authoritative;
  // the matrix follows them.
  'manage:finance': ['owner', 'admin'], // Рахунки, ставки, чужі табелі

  // Issues
  'create:issue': ['owner', 'admin', 'member'],
  'edit:issue': ['owner', 'admin', 'member'],
  'delete:issue': ['owner', 'admin'],   // Member не може видаляти завдання

  // Comments
  'create:comment': ['owner', 'admin', 'member'],
  'edit:comment': ['owner', 'admin', 'member'], // Only on own comments
};

/**
 * Checks if the given role is authorized to perform the action.
 * @param {string} role - The user's role in the organization (owner, admin, member)
 * @param {string} action - The action to check permission for
 * @returns {boolean} True if allowed, false otherwise
 */
export function can(role, action) {
  if (role === 'owner') return true; // Owner has full access
  if (!role) return false;
  return PERMISSIONS[action]?.includes(role) || false;
}
