'use client';
// src/components/Toast.jsx — Global toast notification
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';

export default function Toast() {
  const toast = useStore(s => s.toast);
  const clearToast = useStore(s => s.clearToast);

  if (!toast) return null;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  const colors = {
    success: 'bg-green-500/20 border-green-500/30 text-green-300',
    error: 'bg-red-500/20 border-red-500/30 text-red-300',
    info: 'bg-blue-500/20 border-blue-500/30 text-blue-300',
  };

  return (
    <div className="fixed bottom-[24px] left-1/2 -translate-x-1/2 z-[9999] pointer-events-none">
      <div
        className={`flex items-center gap-[10px] px-[16px] py-[10px] rounded-[12px] border backdrop-blur-md text-[13px] font-semibold shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${colors[toast.type] || colors.success}`}
      >
        <span>{icons[toast.type] || icons.success}</span>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
