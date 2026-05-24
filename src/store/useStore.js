// src/store/useStore.js — Minimal Zustand store for workspace
import { create } from 'zustand';

export const useStore = create((set) => ({
  // Toast notifications
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),
}));
