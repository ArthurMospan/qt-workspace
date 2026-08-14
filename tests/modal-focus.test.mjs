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
  assert.match(hook, /querySelector\('\[data-qt-floating-overlay\]'\)/);
});

test('shared dialogs own a browser-history entry and protect dirty drafts', async () => {
  const [dialog, historyHook, createTask] = await Promise.all([
    read('../src/components/ui/Dialog.jsx'),
    read('../src/lib/hooks/useOverlayHistory.js'),
    read('../src/components/CreateTaskModal.jsx'),
  ]);

  assert.match(dialog, /useOverlayHistory\(\{ isOpen, onClose, isDirty, closeConfirmation \}\)/);
  assert.match(dialog, /useModalFocus\(\{ isOpen, onClose: requestClose \}\)/);
  assert.match(historyHook, /window\.history\.pushState/);
  assert.match(historyHook, /window\.addEventListener\('popstate'/);
  assert.match(historyHook, /window\.history\.back\(\)/);
  assert.match(historyHook, /window\.confirm\(confirmationRef\.current\)/);
  assert.match(createTask, /isDirty=\{mode === 'task' && draftTouched\}/);
});

test('Escape closes a floating control, then its form, then the task page', async () => {
  const [select, popover, contextMenu, escapeHook, issueDetail] = await Promise.all([
    read('../src/components/ui/Select.jsx'),
    read('../src/components/ui/Navigation/Popover.jsx'),
    read('../src/components/ui/ContextMenu.jsx'),
    read('../src/lib/hooks/useFloatingOverlayEscape.js'),
    read('../src/components/workspace/IssueDetail.jsx'),
  ]);

  assert.ok((select.match(/event\.stopPropagation\(\)/g) || []).length >= 3);
  assert.match(popover, /useFloatingOverlayEscape\(\{ open: isOpen/);
  assert.match(contextMenu, /useFloatingOverlayEscape\(\{ open: isOpen/);
  assert.match(escapeHook, /event\.stopPropagation\(\)/);
  assert.match(issueDetail, /if \(showLinkInput\) \{ setShowLinkInput\(false\); return; \}/);
  assert.match(issueDetail, /if \(isEditing\) \{ setIsEditing\(false\); return; \}/);
  assert.match(issueDetail, /router\.push\(`\/\$\{projectId\}`\)/);
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
