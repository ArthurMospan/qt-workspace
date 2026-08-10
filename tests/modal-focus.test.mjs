import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('custom modals share one complete keyboard and scroll-lock contract', async () => {
  const hook = await read('../src/lib/hooks/useModalFocus.js');

  assert.match(hook, /event\.key === 'Escape'/);
  assert.match(hook, /event\.key !== 'Tab'/);
  assert.match(hook, /modalStack\[modalStack\.length - 1\] !== token/);
  assert.match(hook, /bodyLockCount \+= 1/);
  assert.match(hook, /previouslyFocused\.focus\(\)/);
  assert.match(hook, /\(event\.shiftKey \? last : first\)\.focus\(\)/);
});

test('every product dialog outside the shared shell opts into the modal-focus contract', async () => {
  const paths = [
    '../src/components/MobileNav.jsx',
    '../src/components/OrgSwitcherScreen.jsx',
    '../src/components/workspace/IssueModal.jsx',
    '../src/components/ui/AttachmentViewer.jsx',
    '../src/components/workspace/qtplus/MediaLightbox.jsx',
  ];

  for (const path of paths) {
    const source = await read(path);
    assert.match(source, /useModalFocus/);
    assert.match(source, /tabIndex=/);
  }
});
