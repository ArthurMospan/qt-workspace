import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMentionedUserIds } from '../src/lib/utils/mentions.js';

const members = [
  { id: 'anna', name: 'Анна Коваль' },
  { uid: 'oleh', name: 'Олег' },
  { id: 'self', name: 'Я' },
];

test('resolves picker mentions with full names and removes duplicates', () => {
  assert.deepEqual(
    extractMentionedUserIds('@Анна Коваль перевір, будь ласка. @Анна Коваль', members),
    ['anna'],
  );
});

test('excludes the author and ignores plain text without @', () => {
  assert.deepEqual(
    extractMentionedUserIds('@Я зроблю, а Олег перегляне', members, 'self'),
    [],
  );
});

test('resolves uid-backed members', () => {
  assert.deepEqual(extractMentionedUserIds('Пінг @Олег', members), ['oleh']);
});
