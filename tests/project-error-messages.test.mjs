import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { userFacingErrorMessage } from '../src/lib/utils/errors.js';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('API failures prefer the server message and retain a non-empty fallback', () => {
  assert.equal(
    userFacingErrorMessage(new Error('Ліміт активних проєктів вичерпано'), 'Fallback'),
    'Ліміт активних проєктів вичерпано',
  );
  assert.equal(userFacingErrorMessage(new Error('   '), 'Не вдалося'), 'Не вдалося');
  assert.equal(userFacingErrorMessage(null, 'Не вдалося'), 'Не вдалося');
});

test('every project restore surface shows the actionable API error', async () => {
  const [workspace, settings, project, modal] = await Promise.all([
    read('../src/app/(app)/page.js'),
    read('../src/app/(app)/settings/page.js'),
    read('../src/app/(app)/[projectId]/ProjectBoardClient.jsx'),
    read('../src/components/workspace/BoardConfigModal.jsx'),
  ]);

  for (const source of [workspace, settings, project]) {
    assert.match(source, /userFacingErrorMessage\(.*'Не вдалося розархівувати проєкт'/);
    assert.doesNotMatch(source, /showToast\('Помилка розархівування'/);
  }
  assert.match(project, /const handleRestoreProject[\s\S]{0,500}catch \(error\)/);
  assert.match(modal, /await onUnarchive\(project\.id\) !== false/);
  assert.match(modal, /await onArchive\(project\.id\) !== false/);
});

// «Перейдіть на Pro план» named the most expensive way out and the only one
// this file knew about, while the product has offered Lite since sign-up. Both
// routes that refuse a project now name the two things that actually help:
// change the plan, or archive something already finished.
test('the project limit names a way out that is not only the top plan', async () => {
  const unarchive = await read('../src/app/api/projects/[projectId]/route.js');
  const create = await read('../src/app/api/projects/route.js');

  for (const route of [unarchive, create]) {
    assert.match(
      route,
      /Ліміт активних проєктів вичерпано\. Змініть тариф або заархівуйте проєкт\./,
    );
    assert.doesNotMatch(route, /Перейдіть на Pro план/);
  }
});

test('settings API actions no longer replace server errors with generic toasts', async () => {
  const settings = await read('../src/app/(app)/settings/page.js');

  for (const fallback of [
    'Не вдалося згенерувати API ключ',
    'Не вдалося видалити API ключ',
    'Не вдалося змінити роль',
    'Не вдалося змінити посаду',
    'Не вдалося передати права власника',
    'Не вдалося забрати доступ',
    'Не вдалося повернути доступ',
    'Не вдалося вийти з організації',
  ]) {
    assert.match(settings, new RegExp(`userFacingErrorMessage\\([^)]*'${fallback}'`));
  }
});
