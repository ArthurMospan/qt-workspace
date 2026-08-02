'use client';

// src/components/WorkspaceDocumentTitle.jsx
// The single owner of document.title inside the authenticated workspace.
//
// It reads the route, the breadcrumb trail and the unread chat count — all
// already in the store — and writes one string. Nothing else in the app touches
// document.title, which is what lets the unread badge and the page name coexist
// instead of overwriting each other.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { decorateTitle, workspaceDocumentTitle } from '@/lib/utils/documentTitle.mjs';

// How long each half of the blink lasts while the tab is in the background.
const BLINK_MS = 1400;

export default function WorkspaceDocumentTitle() {
  const pathname = usePathname();
  const { projects, activeOrg } = useAppContext();
  const breadcrumbs = useWorkspaceStore(state => state.breadcrumbs);
  const unread = useWorkspaceStore(state => state.unreadChatCount);

  const baseTitle = workspaceDocumentTitle({
    pathname,
    breadcrumbs,
    projects,
    organizationName: activeOrg?.name,
  });

  useEffect(() => {
    if (!unread) {
      document.title = baseTitle;
      return undefined;
    }

    // The alternation only runs while the tab is hidden. Blinking a title the
    // reader is currently looking at is noise, not information.
    let alternate = false;
    const render = () => {
      alternate = document.hidden ? !alternate : false;
      document.title = decorateTitle(baseTitle, { unread, alternate });
    };
    render();
    const timer = window.setInterval(render, BLINK_MS);
    document.addEventListener('visibilitychange', render);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', render);
      document.title = baseTitle;
    };
  }, [baseTitle, unread]);

  return null;
}
