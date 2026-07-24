'use client';
import IssueDetail from '@/components/workspace/IssueDetail';

export default function IssueModal({ issue, onClose }) {
  if (!issue) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={issue.title || 'Завдання'}
        className="relative flex h-[94dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl sm:h-full sm:max-h-none sm:w-[min(1040px,88vw)] sm:rounded-none sm:pb-0"
        onClick={e => e.stopPropagation()}
      >
        <IssueDetail issueId={issue.id} projectId={issue.projectId} isModal={true} onClose={onClose} />
      </div>
    </div>
  );
}
