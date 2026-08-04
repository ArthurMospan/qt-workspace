'use client';

// src/components/FaviconBadge.jsx
// The unread count, painted onto the tab icon.
//
// The single owner of <link rel="icon"> inside the authenticated workspace, in
// the same way WorkspaceDocumentTitle is the single owner of document.title.
// It draws the real favicon into a canvas, stamps a badge over it and hands the
// result back to the browser as a data URL; when nothing is unread it puts the
// original href back, so the icon a bookmark captured is never a stale badge.
//
// Everything about *what* the badge says lives in `lib/utils/faviconBadge.mjs`.
// This file is only the paint.

import { useEffect, useRef } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { badgeCount, badgeGeometry, badgeLabel } from '@/lib/utils/faviconBadge.mjs';

// The icon the layout already declares. Drawn from the PNG rather than the ICO
// because canvas cannot decode an ICO in every browser.
const SOURCE_ICON = '/favicon.png';
// Four times the 16px the browser renders, so the badge's curve survives the
// downscale instead of turning into a red square.
const CANVAS_SIZE = 64;
const BADGE_FILL = '#ef4444';

function iconLink() {
  if (typeof document === 'undefined') return null;
  // The layout declares two icons; the PNG is the one a badge can replace.
  return (
    document.querySelector('link[rel="icon"][type="image/png"]')
    || document.querySelector('link[rel="icon"]')
  );
}

export default function FaviconBadge() {
  const { activeOrgId } = useAppContext();
  const notifications = useWorkspaceStore(state => state.notifications);
  const unreadChats = useWorkspaceStore(state => state.unreadChatCount);

  // The badge is scoped the same way the bell is: a count that includes another
  // organisation's unread items is a count nothing on screen agrees with.
  const unreadNotifications = (notifications || []).filter(
    item => !item?.read && item?.organizationId === activeOrgId,
  ).length;

  const count = badgeCount({ unreadChats, unreadNotifications });

  // Captured once, before anything is overwritten: after the first repaint the
  // link's own href is a data URL and no longer says where the icon came from.
  const originalHref = useRef(null);

  useEffect(() => {
    const link = iconLink();
    if (!link) return undefined;
    if (originalHref.current === null) originalHref.current = link.getAttribute('href') || SOURCE_ICON;

    let cancelled = false;

    const restore = () => {
      if (!cancelled) link.setAttribute('href', originalHref.current);
    };

    if (count <= 0) {
      restore();
      return () => { cancelled = true; };
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { radius, centerX, centerY, ringWidth, fontSize } = badgeGeometry(CANVAS_SIZE);

      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Punch a transparent hole first, then fill it. Drawing the ring as a
      // stroke over the icon leaves the icon showing through the anti-aliased
      // edge, which at 16px looks like a smudge rather than a badge.
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + ringWidth, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = BADGE_FILL;
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${fontSize}px -apple-system, "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Optical centre: a digit's ink sits slightly above the em box's middle.
      ctx.fillText(badgeLabel(count), centerX, centerY + fontSize * 0.04);

      link.setAttribute('href', canvas.toDataURL('image/png'));
    };
    // A favicon that fails to decode is not worth a broken tab icon: leave
    // whatever the browser already has.
    image.onerror = restore;
    image.src = originalHref.current || SOURCE_ICON;

    return () => { cancelled = true; };
  }, [count]);

  // Put the plain icon back when the workspace unmounts — signing out should
  // not leave a badge on the login tab.
  useEffect(() => () => {
    const link = iconLink();
    if (link && originalHref.current) link.setAttribute('href', originalHref.current);
  }, []);

  return null;
}
