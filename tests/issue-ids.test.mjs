import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  issueMatchesRouteIdentifier,
  issuePath,
  legacyStoredIssueKey,
  projectIssuePrefixTaken,
  suggestAvailableIssuePrefix,
} from '../src/lib/utils/issueKeys.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('every project task writer consumes the stable project issue sequence', async () => {
  const [sources, transactionalResolver] = await Promise.all([
    Promise.all([
    read('../src/app/api/issues/route.js'),
    read('../src/lib/server/telegram.js'),
    read('../src/app/api/v1/tasks/route.js'),
    ]),
    read('../src/lib/server/issueKeys.js'),
  ]);

  for (const source of sources) {
    assert.match(source, /resolveProjectIssuePrefixInTransaction\(/);
    assert.match(source, /issueCounter: next/);
    assert.match(source, /issueKey = `\$\{issuePrefix\}-\$\{next\}`/);
  }
  assert.match(transactionalResolver, /where\('organizationId', '==', organizationId\)/);
  assert.match(transactionalResolver, /suggestAvailableIssuePrefix\(project, organizationProjects, projectId\)/);
});

test('project prefixes are explicit, unique and lock after the first task', async () => {
  const [createRoute, updateRoute, form, workspace] = await Promise.all([
    read('../src/app/api/projects/route.js'),
    read('../src/app/api/projects/[projectId]/route.js'),
    read('../src/components/ui/TaskManagement/ProjectSettingsForm.jsx'),
    read('../src/app/(app)/page.js'),
  ]);

  assert.match(createRoute, /issuePrefix: normalizedPrefix/);
  assert.match(createRoute, /projectIssuePrefixTaken\(organizationProjects, normalizedPrefix\)/);
  assert.match(updateRoute, /ISSUE_PREFIX_LOCKED/);
  assert.match(updateRoute, /Number\(currentProject\.issueCounter \|\| 0\) > 0/);
  assert.match(form, /Після першої задачі код закріпиться/);
  assert.match(createRoute, /suggestedPrefix/);
  assert.match(workspace, /suggestAvailableIssuePrefix\(\{ name \}, projects\)/);
});

test('similar project names receive the next readable free prefix', () => {
  const projects = [
    { id: 'p1', name: 'Engineering', issuePrefix: 'ENG' },
    { id: 'p2', name: 'Engagement', issuePrefix: 'ENG2' },
  ];

  assert.equal(projectIssuePrefixTaken(projects, 'eng'), true);
  assert.equal(suggestAvailableIssuePrefix({ name: 'Engine' }, projects), 'ENG3');
  assert.equal(
    suggestAvailableIssuePrefix(
      { name: 'Long project', issuePrefix: 'ABCDEFGH' },
      [{ id: 'p3', issuePrefix: 'ABCDEFGH' }],
    ),
    'ABCDEFG2',
  );
  assert.equal(
    legacyStoredIssueKey('ENG3-12', { issuePrefix: 'ENG3', name: 'Engineering' }),
    'WS-12',
  );
});

test('task routes use the human issue key and still recognize old document-id links', () => {
  const issue = { id: 'firestore-symbols-123', projectId: 'project/one', issueKey: 'eng-12' };

  assert.equal(issuePath(issue), '/project%2Fone/issue/ENG-12');
  assert.equal(issueMatchesRouteIdentifier(issue, 'ENG-12'), true);
  assert.equal(issueMatchesRouteIdentifier(issue, 'eng-12'), true);
  assert.equal(issueMatchesRouteIdentifier(issue, 'firestore-symbols-123'), true);
  assert.equal(issueMatchesRouteIdentifier(issue, 'ENG-13'), false);
  assert.equal(issuePath({ id: 'legacy-id', projectId: 'project-1' }), '/project-1/issue/legacy-id');

  const legacyIssue = { id: 'old-doc', projectId: 'project-1', issueKey: 'WS-12' };
  const project = { id: 'project-1', name: 'Engineering', issuePrefix: 'ENG' };
  assert.equal(issuePath(legacyIssue, project), '/project-1/issue/ENG-12');
  assert.equal(issueMatchesRouteIdentifier(legacyIssue, 'ENG-12', project), true);
});

test('the task detail route resolves a key then canonicalizes legacy URLs', async () => {
  const detail = await read('../src/components/workspace/IssueDetail.jsx');
  assert.match(detail, /issueMatchesRouteIdentifier\(candidate, issueLocator, project\)/);
  assert.match(detail, /router\.replace\(`\$\{canonicalIssuePath\}/);
});

test('search shows only persisted task IDs and never invents one from a document id', async () => {
  const [route, modal] = await Promise.all([
    read('../src/app/api/search/route.js'),
    read('../src/components/SearchModal.jsx'),
  ]);

  assert.match(route, /scoreField\(issue\.issueKey, term, WEIGHTS\.key\)/);
  assert.match(route, /issueKey: taskDisplayKey\(storedIssue, projectsById\.get\(storedIssue\.projectId\)\)/);
  assert.match(modal, /issue\.issueKey \|\| 'Без ID'/);
  assert.doesNotMatch(modal, /issue\.id\.slice/);
});
