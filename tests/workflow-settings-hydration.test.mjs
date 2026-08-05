import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  hydrateWorkflowSettings,
  WORKFLOW_SETTINGS_SECTIONS,
} from '../src/lib/utils/workflowSettingsHydration.mjs';

const defaults = {
  statuses: [{ id: 'backlog', label: 'Backlog' }],
  types: [{ id: 'task', label: 'Task' }],
  priorities: [{ id: 'medium', label: 'Medium' }],
  labels: [{ id: 'bug', label: 'Bug' }],
  positions: [{ id: 'dev', label: 'Developer', hourlyRate: 30 }],
};

test('missing workflow replaces every section from the previous organization with defaults', () => {
  const organizationA = {
    statuses: [{ id: 'custom-status', label: 'A status' }],
    types: [{ id: 'custom-type', label: 'A type' }],
    priorities: [{ id: 'custom-priority', label: 'A priority' }],
    labels: [{ id: 'custom-label', label: 'A label' }],
    positions: [{ id: 'custom-position', label: 'A position' }],
  };

  const organizationB = {
    ...organizationA,
    ...hydrateWorkflowSettings(null, defaults),
  };

  assert.deepEqual(Object.keys(organizationB), WORKFLOW_SETTINGS_SECTIONS);
  // Statuses come back with their category resolved: the editor must never show
  // an empty category control, and the loaded payload is the autosave baseline,
  // so resolving it here is also what keeps opening Settings from writing.
  assert.deepEqual(
    organizationB.statuses,
    [{ id: 'backlog', label: 'Беклог', category: 'backlog', isDone: false }],
  );
  assert.deepEqual(
    organizationB.types,
    [{ id: 'task', label: 'Задача' }],
  );
  assert.deepEqual(
    organizationB.priorities,
    [{ id: 'medium', label: 'Середній' }],
  );
  assert.deepEqual(
    organizationB.labels,
    [{ id: 'bug', label: 'Баг' }],
  );
  assert.deepEqual(
    organizationB.positions,
    [{ id: 'dev', label: 'Розробник', hourlyRate: 30 }],
  );
});

test('partial legacy workflow fills all missing sections without replacing stored custom values', () => {
  const hydrated = hydrateWorkflowSettings({
    statuses: [{ id: 'review', label: 'Review' }],
    labels: [],
  }, defaults);

  // A custom id is never guessed at by name; as the only column it is where new
  // work lands. tests/status-categories.test.mjs covers the derivation itself.
  assert.deepEqual(
    hydrated.statuses,
    [{ id: 'review', label: 'Review', category: 'backlog', isDone: false }],
  );
  assert.deepEqual(hydrated.labels, []);
  assert.equal(hydrated.types[0].id, 'task');
  assert.equal(hydrated.priorities[0].id, 'medium');
  assert.equal(hydrated.positions[0].id, 'dev');
  assert.notStrictEqual(hydrated.types, defaults.types);
  assert.notStrictEqual(hydrated.types[0], defaults.types[0]);
});

test('settings workflow load is generation-guarded and applies one complete payload', async () => {
  const settings = await readFile(
    new URL('../src/app/(app)/settings/page.js', import.meta.url),
    'utf8',
  );

  assert.match(settings, /const wfLoadGeneration = useRef\(0\)/);
  assert.match(settings, /const isCurrentWorkflowLoad = \(\) =>/);
  assert.match(
    settings,
    /const wfSnap = await getDoc[\s\S]{0,240}if \(!isCurrentWorkflowLoad\(\)\) return;[\s\S]{0,180}applyHydratedWorkflow/,
  );
  assert.match(
    settings,
    /queueMicrotask\(\(\) => \{[\s\S]{0,160}applyHydratedWorkflow\(null\);[\s\S]{0,100}setWfLoading\(Boolean\(organizationId\)\)/,
  );
  assert.doesNotMatch(
    settings,
    /if \(d\.statuses !== undefined\)[\s\S]{0,400}setPositions/,
  );
  assert.match(
    settings,
    /const mutationOrganizationId = activeOrgId;[\s\S]{0,1400}wfOrgId\.current !== mutationOrganizationId/,
  );
  assert.match(
    settings,
    /const resetOrganizationId = activeOrgId;[\s\S]{0,500}wfOrgId\.current !== resetOrganizationId/,
  );
});
