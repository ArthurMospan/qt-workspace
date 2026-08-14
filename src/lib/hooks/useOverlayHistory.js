'use client';

import { useCallback, useEffect, useId, useRef } from 'react';

const OVERLAY_STATE_KEY = 'qtOverlay';

export function useOverlayHistory({
  isOpen,
  onClose,
  isDirty = false,
  closeConfirmation = 'Закрити вікно й залишити незбережені зміни?',
}) {
  const overlayId = useId();
  const tokenRef = useRef(`overlay-${overlayId}`);
  const activeRef = useRef(false);
  const confirmedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const dirtyRef = useRef(isDirty);
  const confirmationRef = useRef(closeConfirmation);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { dirtyRef.current = isDirty; }, [isDirty]);
  useEffect(() => { confirmationRef.current = closeConfirmation; }, [closeConfirmation]);

  const confirmClose = useCallback(() => {
    if (confirmedRef.current) {
      confirmedRef.current = false;
      return true;
    }
    return !dirtyRef.current || window.confirm(confirmationRef.current);
  }, []);

  const requestClose = useCallback(() => {
    if (!isOpen || !confirmClose()) return;
    const token = tokenRef.current;
    if (activeRef.current && window.history.state?.[OVERLAY_STATE_KEY] === token) {
      confirmedRef.current = true;
      window.history.back();
      return;
    }
    onCloseRef.current?.();
  }, [confirmClose, isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;

    const token = tokenRef.current;
    window.history.pushState({
      ...window.history.state,
      [OVERLAY_STATE_KEY]: token,
    }, '', window.location.href);
    activeRef.current = true;

    const handlePopState = event => {
      if (!activeRef.current || event.state?.[OVERLAY_STATE_KEY] === token) return;
      if (!confirmClose()) {
        window.history.pushState({
          ...event.state,
          [OVERLAY_STATE_KEY]: token,
        }, '', window.location.href);
        return;
      }
      activeRef.current = false;
      onCloseRef.current?.();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (activeRef.current && window.history.state?.[OVERLAY_STATE_KEY] === token) {
        activeRef.current = false;
        window.history.back();
      }
    };
  }, [confirmClose, isOpen]);

  return requestClose;
}
