'use client';
import IssueDetail from '@/components/workspace/IssueDetail';

export default function IssueModal({ issue, onClose }) {
  if (!issue) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:pt-8 sm:pb-8 sm:px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-t-[24px] rounded-b-none sm:rounded-[24px] shadow-2xl w-full max-w-[1200px] h-full max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <IssueDetail issueId={issue.id} projectId={issue.projectId} isModal={true} onClose={onClose} />
      </div>
    </div>
  );
}
