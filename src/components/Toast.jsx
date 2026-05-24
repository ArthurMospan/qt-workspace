'use client';
// src/components/Toast.jsx — Light theme toast notification
import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

export default function Toast() {
  const { toast, hideToast } = useStore();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hideToast, 3000);
    return () => clearTimeout(t);
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
      <div className="flex items-center gap-3 bg-[#1f1f1f] text-white px-5 py-3 rounded-[14px] shadow-xl text-[13px] font-medium animate-[slideUp_0.2s_ease]">
        <CheckCircle size={15} className="text-green-400 shrink-0" />
        <span>{toast}</span>
        <button onClick={hideToast} className="text-white/40 hover:text-white/80 ml-1 transition-colors">
          <X size={13} />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
