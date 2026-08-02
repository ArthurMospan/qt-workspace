'use client';

import { useEffect, useState } from 'react';

// True while the on-screen keyboard covers part of the viewport.
//
// The layout viewport already accounts for every other piece of mobile browser
// chrome — the URL bar, the toolbar, the home indicator — which is why a fixed
// bottom bar behaves without any inset arithmetic. The keyboard is the
// exception: depending on the platform and the `interactive-widget` mode it
// either hides a fixed element behind itself or leaves it floating on top, and
// both look like a bug. visualViewport is the only API that reports the box
// that is actually visible.
//
// The threshold is a fraction rather than a pixel count so it holds on a small
// phone and on a tablet: a collapsing URL bar costs well under a fifth of the
// height, a keyboard costs a third or more.
const KEYBOARD_FRACTION = 0.3;

export function useKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = typeof window === 'undefined' ? null : window.visualViewport;
    if (!viewport) return undefined;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const hidden = window.innerHeight - viewport.height;
      const next = hidden > window.innerHeight * KEYBOARD_FRACTION;
      setOpen(previous => (previous === next ? previous : next));
    };
    // resize fires per animation frame while the keyboard slides in.
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    viewport.addEventListener('resize', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
    };
  }, []);

  // Published on <body> as well, so CSS can collapse the space the bar reserves
  // without every screen subscribing to this hook.
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.dataset.keyboard = open ? 'open' : 'closed';
    return () => { delete document.body.dataset.keyboard; };
  }, [open]);

  return open;
}

export default useKeyboardOpen;
