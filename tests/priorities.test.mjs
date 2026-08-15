import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SYSTEM_PRIORITIES,
  INACTIVE_PRIORITY_COLOR,
  priorityPresentation,
} from '../src/lib/utils/priorities.mjs';

test('inactive priority rings are neutral grey instead of translucent priority colour', () => {
  const medium = priorityPresentation('medium', DEFAULT_SYSTEM_PRIORITIES);
  assert.equal(medium.outerColor, INACTIVE_PRIORITY_COLOR);
  assert.equal(medium.innerColor, '#eab308');

  const low = priorityPresentation('low', DEFAULT_SYSTEM_PRIORITIES);
  assert.equal(low.outerColor, INACTIVE_PRIORITY_COLOR);
  assert.equal(low.innerColor, INACTIVE_PRIORITY_COLOR);
});

test('high priority keeps both rings active', () => {
  const high = priorityPresentation('high', DEFAULT_SYSTEM_PRIORITIES);
  assert.equal(high.outerColor, '#f97316');
  assert.equal(high.innerColor, '#f97316');
});
