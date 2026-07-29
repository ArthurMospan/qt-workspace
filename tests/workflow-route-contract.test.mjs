import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('workflow mutations are authenticated and transactional', async () => {
  const route = await read(
    '../src/app/api/organizations/[organizationId]/workflow/route.js',
  );

  assert.match(
    route,
    /authorizeOrgRequest\([\s\S]{0,180}\['owner', 'admin'\]/,
  );
  assert.match(route, /normalizeWorkflowMutationInput\(body\)/);
  assert.match(route, /await db\.runTransaction\(async transaction =>/);
  assert.match(route, /where\('organizationId', '==', organizationId\)/);
  assert.match(route, /introducedIssueExecutionViolations\(\{/);
  assert.match(route, /STATUS_MIGRATION_REQUIRED/);
  assert.match(route, /WORKFLOW_EXECUTION_CONFLICT/);
  assert.match(route, /workflow-status-migrated/);
  assert.match(route, /updates\.completedAt = now/);
  assert.match(
    route,
    /updates\.completedAt = admin\.firestore\.FieldValue\.delete\(\)/,
  );
});

test('settings use the workflow API and never batch issue status changes directly', async () => {
  const [settings, service] = await Promise.all([
    read('../src/app/(app)/settings/page.js'),
    read('../src/lib/services/workflow.js'),
  ]);

  assert.match(settings, /updateWorkflowViaApi/);
  assert.match(settings, /queueWorkflowMutation/);
  assert.match(settings, /statusMigrations:\s*\[\{/);
  assert.doesNotMatch(
    settings,
    /setDoc\(doc\(db, 'organizations', activeOrgId, 'settings', 'workflow'/,
  );
  assert.doesNotMatch(settings, /writeBatch\(db\)[\s\S]{0,500}completedAt/);
  assert.match(
    service,
    /fetch\([\s\S]{0,180}\/api\/organizations\/\$\{encodeURIComponent\(organizationId\)\}\/workflow/,
  );
  assert.match(service, /Authorization:\s*`Bearer \$\{token\}`/);
});
