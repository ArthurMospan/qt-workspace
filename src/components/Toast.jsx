'use client';
// src/components/Toast.jsx
// Store connector: reads the toast from useWorkspaceStore and renders it
// through the ui-kit Toast (single source of truth for the toast visuals).
import useWorkspaceStore from '@/store/useWorkspaceStore';
import UiToast from '@/components/ui/Feedback/Toast';

export default function Toast() {
  const toast = useWorkspaceStore(s => s.toast);
  const clearToast = useWorkspaceStore(s => s.clearToast);

  if (!toast) return null;

  const message = typeof toast === 'string' ? toast : toast.message;
  const variant = toast.type || 'success';

  return (
    <UiToast
      key={toast.id || message}
      variant={variant}
      message={message}
      action={toast.action?.label}
      onAction={toast.action?.onClick}
      autoClose={false}
      onClose={clearToast}
    />
  );
}
