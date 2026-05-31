'use client';
import Alert from '@/components/ui/Feedback/Alert';
import LoadingSpinner from '@/components/ui/Feedback/LoadingSpinner';
import EmptyState from '@/components/ui/Feedback/EmptyState';
import Surface from '@/components/ui/Surface';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, Inbox } from 'lucide-react';

export default function FeedbackTab() {
  return (
    <div className="space-y-8">
      {/* Alerts */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Alerts (5 варіантів)</h2>
        <Surface padding="lg" className="space-y-3">
          <Alert type="success" title="Успішно!" description="Дія виконана успішно" icon={CheckCircle2} />
          <Alert type="info" title="Інформація" description="Це важлива інформація" icon={Info} />
          <Alert type="warning" title="Попередження" description="Будьте обережні з цією дією" icon={AlertTriangle} />
          <Alert type="error" title="Помилка" description="Щось пішло не так" icon={AlertCircle} />
        </Surface>
      </div>

      {/* Loading Spinners */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Loading Spinners (3 розміри)</h2>
        <Surface padding="lg" className="flex gap-8 items-center">
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="sm" />
            <span className="text-[12px] text-[#9a9a9a]">Small</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="md" />
            <span className="text-[12px] text-[#9a9a9a]">Medium</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LoadingSpinner size="lg" />
            <span className="text-[12px] text-[#9a9a9a]">Large</span>
          </div>
        </Surface>
      </div>

      {/* Empty States */}
      <div>
        <h2 className="text-[24px] font-bold text-[#1f1f1f] mb-4">Empty States</h2>
        <Surface padding="lg">
          <EmptyState
            icon={Inbox}
            title="Немає даних"
            description="Тут поки немає даних. Створіть перший елемент щоб почати"
          />
        </Surface>
      </div>
    </div>
  );
}
