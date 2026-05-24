'use client';
// src/app/workspace/[projectId]/page.js — Enterprise board page
import { use, useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useIssues } from '@/lib/hooks/useIssues';
import { useTeamMembers } from '@/lib/hooks/useTeamMembers';
import { useTimeLogs } from '@/lib/hooks/useTimeLogs';
import { useComments } from '@/lib/hooks/useComments';
import { useAuditLog } from '@/lib/hooks/useAuditLog';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import AgileBoard from '@/components/workspace/AgileBoard';
import IssueModal from '@/components/workspace/IssueModal';
import Link from 'next/link';
import { ArrowLeft, BarChart2, List } from 'lucide-react';

export default function BoardPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const { issues, loading, createIssue, updateIssue, deleteIssue, moveIssue } = useIssues(projectId);
  const { showToast, activeTimer } = useWorkspaceStore();
  const [activeIssue, setActiveIssue] = useState(null);

  const project = projects?.find(p => p.id === projectId);
  const teamUids = Array.isArray(project?.team) ? project.team : [];
  const { members } = useTeamMembers(teamUids);

  // Hooks for active issue data
  const { logs: timeLogs, addTimeLog } = useTimeLogs(activeIssue?.id);
  const { comments, addComment }       = useComments(activeIssue?.id);
  const { logs: auditLogs }            = useAuditLog(activeIssue?.id);

  // Keep activeIssue synced with live data
  useEffect(() => {
    if (!activeIssue) return;
    const updated = issues.find(i => i.id === activeIssue.id);
    if (updated) setActiveIssue(updated);
  }, [issues]); // eslint-disable-line

  // ── Handlers ──────────────────────────────────────────────────────

  const handleAddIssue = useCallback(async (columnId, title) => {
    try {
      await createIssue({ title, columnId }, currentUser?.id || currentUser?.uid);
      showToast('Задачу додано ✓');
    } catch (err) {
      console.error(err);
      showToast('Помилка: ' + err.message, 'error');
    }
  }, [createIssue, currentUser, showToast]);

  const handleMoveIssue = useCallback(async (issueId, newColumnId, newIndex) => {
    try {
      await moveIssue(issueId, newColumnId, newIndex, currentUser?.id, currentUser?.name);
    } catch (err) {
      showToast(err.message || 'Помилка переміщення', 'error');
    }
  }, [moveIssue, currentUser, showToast]);

  const handleUpdate = useCallback(async (patch) => {
    if (!activeIssue) return;
    try {
      await updateIssue(activeIssue.id, patch, currentUser?.id, currentUser?.name);
    } catch (err) {
      showToast('Помилка збереження', 'error');
    }
  }, [activeIssue, updateIssue, currentUser, showToast]);

  const handleDelete = useCallback(async () => {
    if (!activeIssue) return;
    await deleteIssue(activeIssue.id);
    setActiveIssue(null);
    showToast('Задачу видалено');
  }, [activeIssue, deleteIssue, showToast]);

  const handleAddComment = useCallback(async (text) => {
    if (!activeIssue) return;
    await addComment(activeIssue.id, text, currentUser);
  }, [activeIssue, addComment, currentUser]);

  const handleLogTime = useCallback(async (minutes, description) => {
    if (!activeIssue) return;
    await addTimeLog(
      activeIssue.id,
      projectId,
      currentUser?.id || currentUser?.uid,
      minutes,
      description,
    );
    // Update issue spentMinutes aggregate
    const newSpent = (activeIssue.spentMinutes || 0) + minutes;
    await updateIssue(activeIssue.id, { spentMinutes: newSpent });
    showToast(`${minutes} хв списано ✓`);
  }, [activeIssue, addTimeLog, projectId, currentUser, updateIssue, showToast]);

  const handleAddSubtask = useCallback(async (title) => {
    if (!activeIssue) return;
    const subs = [...(activeIssue.subtasks || []), { title, done: false }];
    await handleUpdate({ subtasks: subs });
  }, [activeIssue, handleUpdate]);

  const handleToggleSubtask = useCallback(async (index) => {
    if (!activeIssue) return;
    const subs = [...(activeIssue.subtasks || [])];
    subs[index] = { ...subs[index], done: !subs[index].done };
    await handleUpdate({ subtasks: subs });
  }, [activeIssue, handleUpdate]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-[#e9e9e9] shrink-0">
        <Link href="/workspace" className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
          <ArrowLeft size={15} />
        </Link>
        <div className="h-[14px] w-[1px] bg-[#e9e9e9]" />
        <h1 className="text-[14px] font-bold text-[#1f1f1f]">{project?.name || '...'}</h1>
        <span className="text-[11px] text-[#9a9a9a]">{issues.length} задач</span>

        <div className="ml-auto flex items-center gap-2">
          <Link href={`/workspace/${projectId}/backlog`}
            className="flex items-center gap-[6px] px-3 py-[6px] text-[11px] font-semibold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all">
            <List size={13} /> Backlog
          </Link>
          <Link href={`/workspace/${projectId}/reports`}
            className="flex items-center gap-[6px] px-3 py-[6px] text-[11px] font-semibold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-[8px] transition-all">
            <BarChart2 size={13} /> Reports
          </Link>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : (
          <AgileBoard
            issues={issues}
            members={members}
            activeTimerIssueId={activeTimer?.issueId}
            onCardClick={setActiveIssue}
            onAddIssue={handleAddIssue}
            onMoveIssue={handleMoveIssue}
          />
        )}
      </div>

      {/* Issue modal */}
      {activeIssue && (
        <IssueModal
          issue={activeIssue}
          members={members}
          comments={comments}
          timeLogs={timeLogs}
          auditLogs={auditLogs}
          onClose={() => setActiveIssue(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddComment={handleAddComment}
          onLogTime={handleLogTime}
          onAddSubtask={handleAddSubtask}
          onToggleSubtask={handleToggleSubtask}
        />
      )}
    </div>
  );
}
