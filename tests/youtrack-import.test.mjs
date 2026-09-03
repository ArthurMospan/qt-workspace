import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  IMPORT_ABANDONED_AFTER_MS,
  IMPORT_STALLED_AFTER_MS,
  describeImportJob,
  fieldMinutes,
  filterYouTrackIssuesByStatuses,
  importActionsFor,
  importHaltReason,
  importJobIsOpen,
  importJobState,
  importPlanIssues,
  mapYouTrackPriority,
  mapYouTrackStatus,
  mapYouTrackType,
  mergeYouTrackStatuses,
  normalizeYouTrackRelation,
  normalizeYouTrackBaseUrl,
  relationTypeFromYouTrack,
  resolveYouTrackStatus,
  strongestYouTrackRelationRow,
  suggestYouTrackStatusMappings,
  suggestUserMappings,
  youTrackImportedWorkLogMatches,
  youTrackField,
  youTrackStateName,
} from '../src/lib/utils/youtrackImport.mjs';

const workflow = {
  statuses: [
    { id: 'backlog', label: 'Беклог' },
    { id: 'todo', label: 'До роботи' },
    { id: 'in-progress', label: 'У роботі' },
    { id: 'done', label: 'Готово' },
  ],
  priorities: [
    { id: 'blocker', label: 'Блокер' },
    { id: 'high', label: 'Високий' },
    { id: 'medium', label: 'Середній' },
    { id: 'low', label: 'Низький' },
  ],
  types: [
    { id: 'task', label: 'Задача' },
    { id: 'bug', label: 'Баг' },
    { id: 'feature', label: 'Фіча' },
  ],
};

test('normalizes a public YouTrack URL and rejects private hosts', () => {
  assert.equal(normalizeYouTrackBaseUrl('https://acme.youtrack.cloud/'), 'https://acme.youtrack.cloud');
  assert.equal(normalizeYouTrackBaseUrl('https://example.com/youtrack/api'), 'https://example.com/youtrack');
  assert.throws(() => normalizeYouTrackBaseUrl('http://acme.youtrack.cloud'));
  assert.throws(() => normalizeYouTrackBaseUrl('https://127.0.0.1/youtrack'));
  assert.throws(() => normalizeYouTrackBaseUrl('https://192.168.1.20'));
});

test('suggests only exact email mappings', () => {
  assert.deepEqual(
    suggestUserMappings(
      [
        { id: 'u1', name: 'Same Name', email: 'member@example.com' },
        { id: 'u2', name: 'Same Name', email: 'other@example.com' },
      ],
      [{ id: 'qt1', name: 'Same Name', email: 'MEMBER@example.com' }],
    ),
    { u1: 'qt1', u2: 'external' },
  );
});

test('maps common YouTrack workflow values', () => {
  assert.equal(mapYouTrackStatus('In Progress', workflow.statuses), 'in-progress');
  assert.equal(mapYouTrackStatus('Fixed', workflow.statuses), 'done');
  assert.equal(mapYouTrackPriority('Show-stopper', workflow.priorities), 'blocker');
  assert.equal(mapYouTrackPriority('Minor', workflow.priorities), 'low');
  assert.equal(mapYouTrackType('Bug', workflow.types), 'bug');
  assert.equal(mapYouTrackType('User Story', workflow.types), 'feature');
  assert.equal(mapYouTrackType('Epic', workflow.types), 'feature');
  assert.equal(mapYouTrackType('Epic', [
    { id: 'epic', label: 'Epic' },
    ...workflow.types,
  ]), 'feature');
  assert.equal(mapYouTrackType('Epic', [{ id: 'epic', label: 'Epic' }]), null);
});

test('suggests status mappings per source project and honors a valid manual override', () => {
  const projects = [{
    id: 'yt-project',
    statuses: [
      { id: 'open', name: 'Open' },
      { id: 'working', name: 'In Progress' },
      { id: 'fixed', name: 'Fixed', archived: true },
    ],
  }];
  assert.deepEqual(suggestYouTrackStatusMappings(projects, workflow.statuses), {
    'yt-project': {
      Open: 'todo',
      'In Progress': 'in-progress',
      Fixed: 'done',
    },
  });
  assert.equal(resolveYouTrackStatus('Fixed', workflow.statuses, 'in-progress'), 'in-progress');
  assert.equal(resolveYouTrackStatus('Fixed', workflow.statuses, 'removed-status'), 'done');
});

test('reads custom fields and YouTrack durations', () => {
  const issue = {
    customFields: [
      { name: 'State', value: { name: 'Open' } },
      { name: 'Estimation', value: { minutes: 95 } },
    ],
  };
  assert.deepEqual(youTrackField(issue, 'state'), { name: 'Open' });
  assert.equal(fieldMinutes(youTrackField(issue, 'Estimation')), 95);
});

test('detects only exact idempotent YouTrack work-log reimports', () => {
  const timestamp = millis => ({ toMillis: () => millis });
  const imported = {
    issueId: 'issue-a',
    projectId: 'project-a',
    userId: 'external:youtrack:user-a',
    organizationId: 'org-a',
    spentMinutes: 45,
    description: 'Implementation',
    loggedAt: timestamp(1_700_000_000_000),
    source: 'youtrack',
    sourceId: 'work-a',
    externalActor: {
      id: 'external:youtrack:user-a',
      name: 'User A',
      avatar: null,
      email: '',
      external: true,
      sourceId: 'user-a',
    },
  };
  const stored = {
    ...imported,
    loggedAt: {
      seconds: 1_700_000_000,
      nanoseconds: 0,
    },
    createdAt: timestamp(1_700_000_100_000),
  };

  assert.equal(youTrackImportedWorkLogMatches(stored, imported), true);
  assert.equal(
    youTrackImportedWorkLogMatches(
      { ...stored, spentMinutes: 46 },
      imported,
    ),
    false,
  );
  assert.equal(
    youTrackImportedWorkLogMatches(
      { ...stored, description: 'Changed' },
      imported,
    ),
    false,
  );
  assert.equal(
    youTrackImportedWorkLogMatches(
      { ...stored, loggedAt: timestamp(1_700_000_000_001) },
      imported,
    ),
    false,
  );
  assert.equal(youTrackImportedWorkLogMatches(null, imported), false);
});

test('filters import stubs by the selected YouTrack statuses', () => {
  const issues = [
    { id: 'open', customFields: [{ name: 'State', value: { name: 'Open' } }] },
    { id: 'done', customFields: [{ name: 'State', value: { name: 'Done' } }] },
  ];
  assert.deepEqual(filterYouTrackIssuesByStatuses(issues, ['Open']).map(issue => issue.id), ['open']);
  assert.equal(filterYouTrackIssuesByStatuses(issues, undefined), issues);
});

test('an empty status selection never turns into an accidental full import', () => {
  const issues = [
    { id: 'open', customFields: [{ name: 'State', value: { name: 'Open' } }] },
    { id: 'done', customFields: [{ name: 'State', value: { name: 'Done' } }] },
  ];
  assert.deepEqual(filterYouTrackIssuesByStatuses(issues, []), []);
  assert.deepEqual(filterYouTrackIssuesByStatuses(issues, ['', '  ']), []);
});

test('status discovery falls back to states observed on readable issues', () => {
  const statuses = mergeYouTrackStatuses([], [
    { customFields: [{ name: 'Статус', value: { name: 'In Progress' } }] },
    { customFields: [{ name: 'State', value: { name: 'Done' } }] },
    { customFields: [{ name: 'State', value: { name: 'In Progress' } }] },
  ]);
  assert.deepEqual(statuses, [
    { id: 'Done', name: 'Done', archived: false, issueCount: 1 },
    { id: 'In Progress', name: 'In Progress', archived: false, issueCount: 2 },
  ]);
});

// Discovery recognises the state field by `$type`, so a renamed or localized
// one still offers its statuses. Matching the literal name "State" here made
// the picker offer statuses no issue could ever match.
test('the workflow state is read from a renamed or localized state field', () => {
  const renamed = {
    customFields: [
      { name: 'Стан', $type: 'StateIssueCustomField', value: { name: 'У роботі' } },
      { name: 'Priority', $type: 'SingleEnumIssueCustomField', value: { name: 'Critical' } },
    ],
  };
  assert.equal(youTrackStateName(renamed), 'У роботі');
  assert.deepEqual(
    filterYouTrackIssuesByStatuses([renamed], ['У роботі']).length,
    1,
  );
  // Responses without `$type` still resolve through the field name.
  assert.equal(youTrackStateName({ customFields: [{ name: 'State', value: { name: 'Open' } }] }), 'Open');
  assert.equal(youTrackStateName({ customFields: [{ name: 'Статус', value: { name: 'В роботі' } }] }), 'В роботі');
  assert.equal(youTrackStateName({ customFields: [] }), '');
});

test('normalizes link types', () => {
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'blocks' }, 'OUTWARD'), 'blocks');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'is required for' }, 'OUTWARD'), 'blocks');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'depends on' }, 'OUTWARD'), 'blocks');
  assert.deepEqual(
    normalizeYouTrackRelation({ sourceToTarget: 'depends on' }, 'OUTWARD'),
    { relationType: 'blocks', reverse: true, hierarchyHint: false },
  );
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'duplicates' }, 'OUTWARD'), 'duplicates');
  assert.equal(relationTypeFromYouTrack({ sourceToTarget: 'relates to' }, 'OUTWARD'), 'relates-to');
  assert.deepEqual(
    normalizeYouTrackRelation({ sourceToTarget: 'parent for' }, 'OUTWARD'),
    { relationType: 'relates-to', reverse: false, hierarchyHint: true },
  );
});

test('selects the strongest reciprocal relation independently of enqueue order', () => {
  const relates = {
    id: 'pair',
    sourceExternalId: 'b',
    targetExternalId: 'a',
    relationType: 'relates-to',
    hierarchyHint: true,
    externalRelation: 'parent for',
  };
  const blocks = {
    id: 'pair',
    sourceExternalId: 'a',
    targetExternalId: 'b',
    relationType: 'blocks',
    hierarchyHint: false,
    externalRelation: 'blocks',
  };

  assert.deepEqual(
    strongestYouTrackRelationRow(relates, blocks),
    strongestYouTrackRelationRow(blocks, relates),
  );
  assert.equal(strongestYouTrackRelationRow(relates, blocks).relationType, 'blocks');
  assert.equal(strongestYouTrackRelationRow(relates, blocks).hierarchyHint, false);
});

test('breaks equal-strength reciprocal relations deterministically', () => {
  const outward = {
    id: 'pair',
    sourceExternalId: 'b',
    targetExternalId: 'a',
    relationType: 'blocks',
    hierarchyHint: false,
    externalRelation: 'blocks',
  };
  const inward = {
    id: 'pair',
    sourceExternalId: 'a',
    targetExternalId: 'b',
    relationType: 'blocks',
    hierarchyHint: false,
    externalRelation: 'is blocked by',
  };

  assert.equal(
    strongestYouTrackRelationRow(outward, inward).sourceExternalId,
    'a',
  );
  assert.deepEqual(
    strongestYouTrackRelationRow(outward, inward),
    strongestYouTrackRelationRow(inward, outward),
  );
});

// ─── Стан перенесення ────────────────────────────────────────────────────────
//
// Скарга, з якої це почалось: «блок імпорт незавершений до кінця… воно просто
// висить, і ти не розумієш, а шо це таке і шо з ним робити». Причина була
// структурна: панель малювалась для будь-якого найновішого job, а кнопки
// стояли за списком активних статусів, до якого «скасовано» не належить.
//
// Тому правило перевіряється, а не обіцяється: для кожного стану й кожного
// читача має бути хоча б одна дія.

const STATES = [
  { label: 'none', job: null },
  { label: 'ready', job: { id: 'j', status: 'prepared', createdBy: 'author' } },
  { label: 'running', job: { id: 'j', status: 'running', createdBy: 'author', updatedAt: '2026-09-03T10:00:00.000Z' } },
  { label: 'stalled', job: { id: 'j', status: 'running', createdBy: 'author', updatedAt: '2026-09-03T09:00:00.000Z' } },
  { label: 'blocked-connection', job: { id: 'j', status: 'blocked', blockedReason: 'connection', createdBy: 'author', updatedAt: '2026-09-03T10:00:00.000Z' } },
  { label: 'blocked-plan', job: { id: 'j', status: 'blocked', blockedReason: 'plan', createdBy: 'author', updatedAt: '2026-09-03T10:00:00.000Z' } },
  { label: 'blocked-failures', job: { id: 'j', status: 'blocked', blockedReason: 'failures', createdBy: 'author', updatedAt: '2026-09-03T10:00:00.000Z' } },
  { label: 'completed', job: { id: 'j', status: 'completed', createdBy: 'author' } },
  { label: 'cancelled', job: { id: 'j', status: 'cancelled', createdBy: 'author' } },
];

const NOW = Date.parse('2026-09-03T10:00:30.000Z');

const READERS = [
  { label: 'автор', viewer: { userId: 'author', isOrganizationOwner: false, isOrganizationAdmin: true } },
  { label: 'власник', viewer: { userId: 'owner', isOrganizationOwner: true, isOrganizationAdmin: true } },
  { label: 'адміністратор', viewer: { userId: 'admin', isOrganizationOwner: false, isOrganizationAdmin: true } },
];

test('жоден стан перенесення не лишається без дії', () => {
  for (const { label, job } of STATES) {
    const state = importJobState(job, NOW);
    const offered = READERS.flatMap(reader => importActionsFor(job, state, {
      ...reader.viewer,
      abandoned: false,
    }));
    assert.ok(offered.length > 0, `${label}: жоден читач не має жодної дії`);
  }
});

test('автор бачить вихід із кожного стану, а не лише зупинку', () => {
  for (const { label, job } of STATES) {
    const state = importJobState(job, NOW);
    const actions = importActionsFor(job, state, {
      userId: 'author',
      isOrganizationOwner: false,
      isOrganizationAdmin: true,
      abandoned: false,
    });
    assert.ok(actions.length > 0, `${label}: авторові нічого не запропоновано`);
    // Крім «іде» — там єдина осмислена дія справді одна: зупинити.
    if (state !== 'running') {
      assert.ok(
        actions.some(action => action.kind === 'primary'),
        `${label}: у автора немає головної дії`,
      );
    }
  }
});

test('скасоване й завершене перенесення прибирається з екрана будь-ким, хто його бачить', () => {
  for (const status of ['cancelled', 'completed']) {
    const job = { id: 'j', status, createdBy: 'somebody-else' };
    const state = importJobState(job, NOW);
    for (const reader of READERS) {
      const actions = importActionsFor(job, state, { ...reader.viewer, abandoned: false });
      assert.ok(
        actions.some(action => action.id === 'acknowledge'),
        `${status}: ${reader.label} не може прибрати панель`,
      );
    }
  }
  // І щойно його прибрали, воно перестає бути тим, на що дивишся.
  assert.equal(
    importJobState({ id: 'j', status: 'cancelled', acknowledgedAt: '2026-09-03T10:00:00.000Z' }, NOW),
    'none',
  );
});

test('пауза — це прострочена оренда І тиша, а не одна лише тиша', () => {
  const silent = '2026-09-03T09:00:00.000Z';
  const withLease = {
    id: 'j', status: 'running', updatedAt: silent, leaseUntil: '2026-09-03T10:01:00.000Z',
  };
  // Оренда ще діє: крок просто повільний — одна задача зі сотнею коментарів і
  // вкладенням на 20 MB. Це не пауза.
  assert.equal(importJobState(withLease, NOW), 'running');
  assert.equal(importJobState({ ...withLease, leaseUntil: null }, NOW), 'stalled');
  assert.ok(NOW - Date.parse(silent) > IMPORT_STALLED_AFTER_MS);
});

test('покинуте перенесення може зупинити будь-який адміністратор', () => {
  const job = {
    id: 'j', status: 'running', createdBy: 'author', updatedAt: '2026-09-03T09:00:00.000Z',
  };
  const state = importJobState(job, NOW);
  const fresh = importActionsFor(job, state, {
    userId: 'admin', isOrganizationOwner: false, isOrganizationAdmin: true, abandoned: false,
  });
  assert.equal(fresh.some(action => action.id === 'cancel'), false);
  const abandoned = importActionsFor(job, state, {
    userId: 'admin', isOrganizationOwner: false, isOrganizationAdmin: true, abandoned: true,
  });
  assert.ok(abandoned.some(action => action.id === 'cancel'));
  assert.ok(IMPORT_ABANDONED_AFTER_MS > IMPORT_STALLED_AFTER_MS);
});

test('поки перенесення відкрите, налаштування закриті — і навпаки', () => {
  assert.equal(importJobIsOpen('running'), true);
  assert.equal(importJobIsOpen('ready'), true);
  assert.equal(importJobIsOpen('stalled'), true);
  assert.equal(importJobIsOpen('blocked'), true);
  assert.equal(importJobIsOpen('completed'), false);
  assert.equal(importJobIsOpen('cancelled'), false);
  assert.equal(importJobIsOpen('none'), false);
});

test('відкликаний токен — це не зіпсована задача', () => {
  // Саме ця різниця перетворювала 663 задачі на 663 помилки: обидва випадки
  // ловив один catch, черга посувалась, і смуга доходила до ста відсотків з
  // нулем перенесених.
  const revoked = Object.assign(new Error('YouTrack 401: Unauthorized'), {
    status: 401, source: 'youtrack',
  });
  assert.equal(importHaltReason(revoked), 'connection');
  assert.equal(importHaltReason(new Error('Підключення YouTrack пошкоджене: …')), 'connection');
  assert.equal(importHaltReason(new Error('Ліміт проєктів вичерпано')), 'plan');
  assert.equal(importHaltReason(Object.assign(new Error('x'), { code: '8' })), 'quota');
  // А це справді одна задача: її пропускають і йдуть далі.
  assert.equal(importHaltReason(new Error('Вкладення перевищує 20 MB')), '');
  assert.equal(importHaltReason(Object.assign(new Error('YouTrack 500: boom'), {
    status: 500, source: 'youtrack',
  })), '');
});

test('збережений вибір називає те, що в ньому розійшлося з дійсністю', () => {
  const discovery = {
    projects: [{ id: 'p1', name: 'Ядро', shortName: 'CORE', statuses: [{ name: 'Open' }] }],
    users: [{ id: 'u1', name: 'Оксана', email: 'o@example.com' }],
  };
  const present = {
    targetStatuses: [{ id: 'todo', label: 'До роботи' }],
    projects: [{ id: 'qt1', name: 'Маркетинг', status: 'active', hiddenColumns: [] }],
    memberIds: new Set(['member-1']),
  };
  const healthy = {
    selectedProjectIds: ['p1'],
    projectMappings: { p1: 'create' },
    statusFilters: { p1: ['Open'] },
    statusMappings: { p1: { Open: 'todo' } },
    userMappings: { u1: 'member-1' },
  };
  assert.deepEqual(importPlanIssues(healthy, discovery, present), []);

  const goneStatus = importPlanIssues({
    ...healthy,
    statusMappings: { p1: { Open: 'in-progress' } },
  }, discovery, present);
  assert.equal(goneStatus.length, 1);
  assert.equal(goneStatus[0].opens, 'scope');

  const goneMember = importPlanIssues({ ...healthy, userMappings: { u1: 'member-gone' } }, discovery, present);
  assert.equal(goneMember.length, 1);
  assert.equal(goneMember[0].opens, 'people');

  const archivedTarget = importPlanIssues({
    ...healthy,
    projectMappings: { p1: 'qt-archived' },
  }, discovery, present);
  assert.equal(archivedTarget.length, 1);

  // Порожній вибір — не помилка мапінгу, а просто нічого не обрано: про це
  // говорить сама панель, а не список розбіжностей.
  assert.deepEqual(importPlanIssues({ ...healthy, selectedProjectIds: [] }, discovery, present), []);
});

test('пігулка стану називає окремо саме той збій, який людина може полагодити', () => {
  const tokenDead = describeImportJob({
    id: 'j', status: 'blocked', blockedReason: 'connection', updatedAt: '2026-09-03T10:00:00.000Z',
  }, NOW);
  assert.equal(tokenDead.state, 'blocked');
  assert.equal(tokenDead.label, 'Потрібен новий токен');
  assert.equal(tokenDead.tone, 'danger');
  assert.equal(describeImportJob({ id: 'j', status: 'prepared' }, NOW).label, 'Готово до запуску');
  assert.equal(describeImportJob(null, NOW).label, 'Не розпочато');
});

// ─── Один стандартний workflow ───────────────────────────────────────────────
//
// Копій було дві, і вони розійшлися рівно на «На перевірці»: екран вибору
// імпорту пропонував пʼять статусів (`DEFAULT_STATUS_IDS`), а
// `prepareYouTrackImport` приймав чотири зі своєї приватної таблиці — і запуск
// падав із «Статус QuickTeam для «Closed» більше не існує» над списком, у якому
// цей статус стояв. Тест тримає те, чого не видно з жодного окремого файлу.

test('стандартні статуси існують в одному списку, і ідентифікатори виводяться з нього', async () => {
  const defaults = await import('../src/lib/utils/workflowDefaults.mjs');

  assert.deepEqual(
    defaults.DEFAULT_STATUS_IDS,
    defaults.DEFAULT_STATUSES.map(status => status.id),
    'DEFAULT_STATUS_IDS має виводитися з DEFAULT_STATUSES, а не стояти поруч',
  );
  assert.ok(
    defaults.DEFAULT_STATUSES.some(status => status.id === 'review'),
    '«На перевірці» — одна з пʼяти категорій продукту й мусить бути серед стандартних',
  );
  defaults.DEFAULT_STATUSES.forEach(status => {
    assert.ok(status.id && status.label && status.category, `${status.id}: неповний статус`);
  });
});

test('importer YouTrack не тримає власного списку стандартних статусів', async () => {
  const importer = await readFile(new URL('../src/lib/server/youtrackImporter.js', import.meta.url), 'utf8');

  // Список береться зі спільного модуля...
  assert.match(importer, /statuses:\s*DEFAULT_STATUSES,/);
  assert.match(importer, /DEFAULT_STATUSES,\s*\n\s*resolveClosedStatusIds/);
  // ...а не пишеться тут ще раз.
  assert.doesNotMatch(importer, /id:\s*'backlog',\s*label:/, 'у importer знову зʼявився власний список статусів');
  assert.doesNotMatch(importer, /id:\s*'blocker',\s*label:/, 'у importer знову зʼявився власний список пріоритетів');
});
