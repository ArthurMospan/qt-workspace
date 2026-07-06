'use client';

// src/lib/hooks/useIsMobile.js — viewport gate matching Tailwind's `md` breakpoint.
// Returns null on the server and the first client render (so both nav variants
// stay mounted for hydration and CSS decides visibility), then true/false —
// letting the layout UNMOUNT the irrelevant one instead of just hiding it,
// which kills its Firestore listeners and re-renders.
import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}
