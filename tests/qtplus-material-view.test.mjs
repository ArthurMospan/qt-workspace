import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toMaterialView, stageProgress, stageStatusMeta } from '../src/lib/portal/qtplusMaterialView.mjs';

test('toMaterialView: file/audio/image -> kind file, icon = type', () => {
  assert.equal(toMaterialView({ type: 'file', title: 'a.pdf' }).kind, 'file');
  assert.equal(toMaterialView({ type: 'file' }).icon, 'file');
  assert.equal(toMaterialView({ type: 'audio' }).icon, 'audio');
  assert.equal(toMaterialView({ type: 'image' }).icon, 'image');
});

test('toMaterialView: link -> href from url, subtitle from desc', () => {
  const v = toMaterialView({ type: 'link', title: 'Pin', url: 'https://x.test', desc: 'x.test' });
  assert.equal(v.kind, 'link');
  assert.equal(v.href, 'https://x.test');
  assert.equal(v.subtitle, 'x.test');
});

test('toMaterialView: title fallback', () => {
  assert.equal(toMaterialView({ type: 'file', title: '   ' }).title, 'Без назви');
  assert.equal(toMaterialView({ type: 'file' }).title, 'Без назви');
});

test('toMaterialView: checklist shape', () => {
  const v = toMaterialView({ type: 'checklist', items: ['a', 'b'], checkedItems: [0] });
  assert.equal(v.kind, 'checklist');
  assert.deepEqual(v.checklist, { items: ['a', 'b'], checkedItems: [0] });
  assert.equal(v.poll, null);
});

test('toMaterialView: poll shape with total', () => {
  const v = toMaterialView({ type: 'poll', options: ['a', 'b'], votes: [3, 2] });
  assert.equal(v.kind, 'poll');
  assert.deepEqual(v.poll.options, ['a', 'b']);
  assert.equal(v.poll.total, 5);
});

test('toMaterialView: note shape, subtitle falls back to source', () => {
  const v = toMaterialView({ type: 'note', content: 'hi', source: 'Notion' });
  assert.equal(v.kind, 'note');
  assert.deepEqual(v.note, { content: 'hi', source: 'Notion' });
  assert.equal(v.subtitle, 'Notion');
});

test('toMaterialView: unknown type', () => {
  const v = toMaterialView({ type: 'whatever', title: 'x' });
  assert.equal(v.kind, 'unknown');
  assert.equal(v.icon, 'unknown');
});

test('toMaterialView: nullish input safe', () => {
  const v = toMaterialView(null);
  assert.equal(v.kind, 'unknown');
  assert.equal(v.title, 'Без назви');
});

test('stageProgress: empty -> 0%', () => {
  assert.deepEqual(stageProgress([]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(stageProgress(null), { done: 0, total: 0, percent: 0 });
});

test('stageProgress: mixed', () => {
  const s = [{ status: 'done' }, { status: 'done' }, { status: 'in-progress' }, { status: 'todo' }];
  assert.deepEqual(stageProgress(s), { done: 2, total: 4, percent: 50 });
});

test('stageStatusMeta: known + fallback', () => {
  assert.equal(stageStatusMeta('todo').label, 'Заплановано');
  assert.equal(stageStatusMeta('in-progress').label, 'В роботі');
  assert.equal(stageStatusMeta('done').label, 'Завершено');
  assert.equal(stageStatusMeta('weird').label, '—');
});
