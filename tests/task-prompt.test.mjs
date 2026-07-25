import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaskAiPrompt } from '../src/lib/utils/taskPrompt.mjs';

test('builds a portable AI prompt from task context', () => {
  const prompt = buildTaskAiPrompt({
    issue: {
      issueKey: 'QT-42',
      title: 'Додати імпорт',
      description: 'Перенести проєкти без дублювання.',
      priority: 'high',
      estimateMinutes: 90,
      subtasks: [{ title: 'Зробити dry-run', done: false }],
    },
    projectName: 'QuickTeam',
    statusName: 'У роботі',
    assigneeNames: ['Олена'],
    taskUrl: 'https://quick.team/p/issue/42',
  });

  assert.match(prompt, /QT-42/);
  assert.match(prompt, /Перенести проєкти без дублювання/);
  assert.match(prompt, /1 год 30 хв/);
  assert.match(prompt, /- \[ \] Зробити dry-run/);
  assert.match(prompt, /не вигадуй факти/);
});

test('does not render empty task metadata', () => {
  const prompt = buildTaskAiPrompt({ issue: { title: 'Коротка задача' } });
  assert.doesNotMatch(prompt, /Виконавці:/);
  assert.match(prompt, /Коротка задача/);
});
