'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function WorkspaceError({ error, unstable_retry, reset }) {
  useEffect(() => {
    console.error('[WorkspaceError]', error);
  }, [error]);

  const retry = unstable_retry || reset || (() => window.location.reload());

  return (
    <div className="flex-1 h-full bg-canvas flex items-center justify-center p-6">
      <div data-ui-surface="local" className="w-full max-w-[420px] bg-white border border-line rounded-[16px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)] text-center">
        <div className="w-[48px] h-[48px] rounded-[14px] bg-danger-soft text-danger flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} />
        </div>
        <h1 className="ui-type-detail-title text-ink mb-2">QuickTeam не завантажився</h1>
        <p className="text-[14px] text-muted leading-relaxed mb-5">
          Дані не вдалося відрендерити. Спробуйте повторити завантаження сторінки.
        </p>
        <Button onClick={() => retry()} style="primary" size="md" icon={RotateCcw}>
          Повторити
        </Button>
      </div>
    </div>
  );
}
