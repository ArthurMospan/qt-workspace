import { localizeBuiltInWorkflowItems } from './workflowDefaults.mjs';

export const WORKFLOW_SETTINGS_SECTIONS = Object.freeze([
  'statuses',
  'types',
  'priorities',
  'labels',
  'positions',
]);

// Settings keeps the workflow sections in separate React state values for the
// editors. Always resolve one complete payload before applying those setters:
// a missing/legacy field must come from this organization's defaults, never
// from whichever organization happened to be open previously.
export function hydrateWorkflowSettings(storedWorkflow, defaults) {
  const stored = storedWorkflow && typeof storedWorkflow === 'object'
    ? storedWorkflow
    : {};

  return Object.fromEntries(WORKFLOW_SETTINGS_SECTIONS.map(section => {
    const source = Array.isArray(stored[section])
      ? stored[section]
      : defaults?.[section];
    const items = Array.isArray(source) ? source : [];
    const localized = localizeBuiltInWorkflowItems(section, items);

    // Give each organization its own in-memory objects as well as arrays.
    return [section, localized.map(item => ({ ...item }))];
  }));
}
