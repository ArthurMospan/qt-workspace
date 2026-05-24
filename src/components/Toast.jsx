'use client';
// src/components/Toast.jsx
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

export default function Toast() {
  const toast = useWorkspaceStore(s => s.toast);
  const clearToast = useWorkspaceStore(s => s.clearToast);

  if (!toast) return null;

  const message = typeof toast === 'string' ? toast : toast.message;
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
      <div className="flex items-center gap-3 bg-[#1f1f1f] text-white px-5 py-3 rounded-[14px] shadow-xl text-[13px] font-medium pointer-events-auto"
        style={{ animation: 'slideUp 0.2s ease' }}>
        {isError
          ? <AlertCircle size={15} className="text-red-400 shrink-0" />
          : <CheckCircle size={15} className="text-green-400 shrink-0" />
        }
        <span>{message}</span>
        <button onClick={clearToast} className="text-white/40 hover:text-white/80 ml-1 transition-colors">
          <X size={13} />
        </button>
      </div>
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translate(-50%,12px); }
          to   { opacity:1; transform:translate(-50%,0); }
        }
      `}</style>
    </div>
  );
}
