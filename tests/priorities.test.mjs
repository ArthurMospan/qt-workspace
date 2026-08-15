import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_SYSTEM_PRIORITIES,
  priorityPresentation,
} from '../src/lib/utils/priorities.mjs';

test('priority presentation keeps the configured semantic colour', () => {
  assert.equal(priorityPresentation('medium', DEFAULT_SYSTEM_PRIORITIES).color, '#eab308');
  assert.equal(priorityPresentation('high', DEFAULT_SYSTEM_PRIORITIES).color, '#f97316');
  assert.equal(priorityPresentation('low', DEFAULT_SYSTEM_PRIORITIES).color, '#9a9a9a');
});

test('priority icon is one solid dot on a forty-percent same-colour halo', () => {
  const icon = readFileSync(new URL('../src/components/ui/DataDisplay/PriorityIcon.jsx', import.meta.url), 'utf8');
  assert.match(icon, /r="5\.5" fill=\{config\.color\} fillOpacity="0\.4"/);
  assert.match(icon, /r="2\.5" fill=\{config\.color\}/);
  assert.doesNotMatch(icon, /strokeDasharray|outerColor|innerColor/);
});
