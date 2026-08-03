import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COMMAND_GROUPS,
  buildCommands,
  flattenGroups,
  fuzzyScore,
  groupCommands,
  issueCommands,
  rankCommands,
} from '../src/lib/utils/commandPalette.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

const projects = [
  { id: 'p1', name: 'Сайт RetroMagaz', issuePrefix: 'RM' },
  { id: 'p2', name: 'Мобільний застосунок' },
  { id: 'p3', name: 'Архів 2024', status: 'archived' },
];

test('the catalogue reflects what this person can actually do', () => {
  const member = buildCommands({ projects, allowedPermissions: [] });
  assert.equal(member.some(command => command.id === 'action-new-project'), false);

  const admin = buildCommands({ projects, allowedPermissions: ['create:project'] });
  assert.equal(admin.some(command => command.id === 'action-new-project'), true);

  // Stopping a timer is not offered when none is running.
  assert.equal(admin.some(command => command.id === 'action-stop-timer'), false);
  assert.equal(
    buildCommands({ hasActiveTimer: true }).some(command => command.id === 'action-stop-timer'),
    true,
  );
  // Nor is switching organization when there is only one.
  assert.equal(
    buildCommands({ organizationCount: 3 }).some(command => command.id === 'action-switch-org'),
    true,
  );
});

test('archived projects are not destinations', () => {
  const commands = buildCommands({ projects });
  const ids = commands.filter(command => command.group === 'project').map(command => command.id);
  assert.deepEqual(ids, ['project-p1', 'project-p2']);
});

test('a query finds the thing you were aiming at, not merely something matching', () => {
  const commands = buildCommands({ projects, allowedPermissions: ['create:project'] });

  assert.equal(rankCommands(commands, 'нове')[0].id, 'action-new-issue');
  assert.equal(rankCommands(commands, 'кален')[0].id, 'nav-calendar');
  assert.equal(rankCommands(commands, 'retro')[0].id, 'project-p1');
});

test('the wrong keyboard layout still finds the right command', () => {
  const commands = buildCommands({ projects });
  assert.equal(rankCommands(commands, 'settings')[0].id, 'nav-settings');
  assert.equal(rankCommands(commands, 'calendar')[0].id, 'nav-calendar');
  assert.equal(rankCommands(commands, 'my tasks')[0].id, 'nav-my');
});

test('scoring prefers word starts, runs and short labels', () => {
  assert.ok(fuzzyScore('Чат', 'чат') > fuzzyScore('Налаштування чату', 'чат'));
  assert.ok(fuzzyScore('Команда', 'ком') > fuzzyScore('Мої команди та проєкти', 'ком'));
  assert.equal(fuzzyScore('Календар', 'zzz'), null, 'a non-match is null, not zero');
  assert.equal(fuzzyScore('', 'a'), null);
  assert.equal(fuzzyScore('Календар', ''), 0);
});

test('an empty query is a menu, with actions at the top', () => {
  const commands = buildCommands({ projects, allowedPermissions: ['create:project'] });
  const ranked = rankCommands(commands, '');
  assert.equal(ranked[0].group, 'action');
  assert.ok(ranked.length <= 12);
  // And it never silently drops to nothing.
  assert.ok(ranked.length > 0);
});

test('search results are a separate group, not mixed into the catalogue ranking', () => {
  const results = [
    { id: 'i1', issueKey: 'RM-12', title: 'Полагодити Telegram', projectId: 'p1' },
    { id: 'i2', issueKey: 'RM-13', title: 'Мобільна навігація', projectId: 'p1' },
  ];
  const issues = issueCommands(results, projects);
  assert.equal(issues[0].group, 'issue');
  assert.equal(issues[0].href, '/p1/issue/i1');
  assert.equal(issues[0].hint, 'RM-12 · Сайт RetroMagaz');
  assert.ok(issueCommands(new Array(40).fill(results[0]), projects).length <= 8);
});

test('grouping keeps the catalogue order and flattens to the keyboard order', () => {
  const commands = [
    ...buildCommands({ projects, allowedPermissions: ['create:project'] }),
    ...issueCommands([{ id: 'i1', title: 'Задача', projectId: 'p1' }], projects),
  ];
  const groups = groupCommands(commands);
  assert.deepEqual(groups.map(entry => entry.group), COMMAND_GROUPS);
  assert.ok(groups.every(entry => entry.label));

  const flat = flattenGroups(groups);
  assert.equal(flat.length, commands.length);
  // The flat order is what ArrowDown walks, so it must match what is rendered.
  assert.equal(flat[0].group, 'action');
  assert.equal(flat[flat.length - 1].group, 'issue');
});

test('every command is reachable: it navigates or it acts, never neither', () => {
  const commands = [
    ...buildCommands({ projects, allowedPermissions: ['create:project'], hasActiveTimer: true, organizationCount: 2 }),
    ...issueCommands([{ id: 'i1', title: 'Задача', projectId: 'p1' }], projects),
  ];
  for (const command of commands) {
    assert.ok(command.href || command.action, `${command.id} does nothing`);
    assert.ok(command.label, `${command.id} has no label`);
    assert.ok(COMMAND_GROUPS.includes(command.group), `${command.id} has an unknown group`);
  }
  assert.equal(new Set(commands.map(command => command.id)).size, commands.length, 'ids collide');
});

test('the palette is opened from one place and rendered from the kit', async () => {
  const layout = await read('../src/app/(app)/layout.js');
  assert.match(layout, /CommandPalette/);
  const index = await read('../src/components/ui/index.js');
  assert.match(index, /CommandPalette/);
});
