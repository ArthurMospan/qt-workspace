'use client';

import { useEffect, useState } from 'react';

// Whether the browser believes it can reach the network.
//
// Firestore queues writes silently while offline, which is the right behaviour
// for the data and the wrong behaviour for the person: they keep typing into
// what looks like a working app and find out later. `navigator.onLine` is a
// coarse signal — it reports the link, not whether anything answers on it — but
// it catches the case that matters, which is a phone that left coverage.
//
// Initialised to true rather than to navigator.onLine so the server render and
// the first client render agree; the real value arrives in the effect.
export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(window.navigator.onLine !== false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
