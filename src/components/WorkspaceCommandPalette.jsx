'use client';

// src/components/WorkspaceCommandPalette.jsx
// The palette's one host: the global keystroke, the data it needs, and what
// running a command actually does. The catalogue and its ranking are pure
// (lib/utils/commandPalette.mjs) and the surface is a kit component; this is the
// only piece that knows about the router, the store and the search API.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useSearch } from '@/lib/hooks/useSearch';
import { CommandPalette, KeyboardShortcutsDialog } from '@/components/ui';
import OrgSwitcherScreen from '@/components/OrgSwitcherScreen';
import { buildCommands } from '@/lib/utils/commandPalette.mjs';
import { can } from '@/lib/utils/can';
import { timerTargetHref } from '@/lib/utils/timerNavigation.mjs';

const PERMISSIONS = ['create:project'];

// QUI-103. ⌘K/Ctrl+K is the only global keystroke this file claims.
//
// "?" used to open the shortcuts sheet, guarded by a check that the event was
// not aimed at an input. That guard cannot hold: a question mark is ordinary
// punctuation, and every place it is typed which is not an `<input>`, a
// `<textarea>` or a contenteditable — a chat composer's own key handling, a
// dialog that has focus on itself, the page between two clicks — swallowed the
// character and put a help panel on screen instead. A printable character is
// nobody's shortcut. The sheet is still reachable from the palette itself.

export default function WorkspaceCommandPalette() {
  const router = useRouter();
  const { projects, activeOrgId, orgRole, allOrgs } = useAppContext();
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [orgSwitcherOpen, setOrgSwitcherOpen] = useState(false);
  const { results, matches, loading, search, clear } = useSearch();

  const activeTimer = useWorkspaceStore(state => state.activeTimer);
  const stopTimer = useWorkspaceStore(state => state.stopTimer);

  const commands = useMemo(() => buildCommands({
    projects,
    allowedPermissions: PERMISSIONS.filter(permission => can(orgRole, permission)),
    hasActiveTimer: Boolean(activeTimer),
    organizationCount: allOrgs?.length || 1,
  }), [activeTimer, allOrgs?.length, orgRole, projects]);

  useEffect(() => {
    const onKeyDown = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(value => !value);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onQueryChange = useCallback(query => {
    if (query.trim().length < 2) clear();
    else search(query, activeOrgId);
  }, [activeOrgId, clear, search]);

  const onSelect = useCallback(command => {
    if (command.href) {
      router.push(command.href);
      return;
    }
    if (command.action === 'stop-timer') {
      const result = stopTimer();
      const href = timerTargetHref(result, { minutes: result?.minutes });
      if (href) router.push(href);
      return;
    }
    if (command.action === 'switch-organization') setOrgSwitcherOpen(true);
    if (command.action === 'open-shortcuts') setShortcutsOpen(true);
  }, [router, stopTimer]);

  return (
    <>
      <CommandPalette
        isOpen={open}
        onClose={() => setOpen(false)}
        commands={commands}
        issues={results}
        matches={matches}
        searching={loading}
        projects={projects}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
      />
      <KeyboardShortcutsDialog
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      {orgSwitcherOpen && <OrgSwitcherScreen onClose={() => setOrgSwitcherOpen(false)} />}
    </>
  );
}
