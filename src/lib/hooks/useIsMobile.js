'use client';

// src/lib/hooks/useIsMobile.js — viewport gate matching Tailwind's `md` breakpoint.
// Returns null on the first client render, then true/false. Layouts should wait
// for the resolved value before mounting viewport-specific navigation so hidden
// nav variants do not briefly subscribe to Firestore.
//
// The query is `(width < 48rem)` because that is character for character what
// Tailwind v4 compiles `max-md:` into, and this hook is the JS half of gates
// whose other half is a `max-md:` utility — a header button hidden by
// `max-md:hidden` whose replacement is a menu row rendered when `isMobile`.
// `(max-width: 767px)` stood here and is not the same query: at a viewport of
// 767.5px, ordinary under browser zoom or a fractional device pixel ratio, the
// CSS half fired and this half did not, so on a task and on an event the header
// pencil and the ⤢ were hidden while neither replacement row was added — a
// quick view with no way to edit and no way to open full page. Only that
// fractional band moves; at 767 both queries are true and at 768 both are
// false, so nothing at or above md changes. Range syntax is safe to ask of the
// browser here: every `max-md:` utility in the bundle is already emitted this
// way, so a browser that cannot parse it has no phone layout to gate.
import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(null);
  useEffect(() => {
    const mq = window.matchMedia('(width < 48rem)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}
