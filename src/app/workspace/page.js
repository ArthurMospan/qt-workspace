'use client';
// src/app/workspace/page.js — Light overview: project grid with stats
import { useAppContext } from '@/lib/context/AppContext';
import { useTasks } from '@/lib/hooks/useTasks';
import Link from 'next/link';
import { ExternalLink, Folder, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

function ProjectCard({ project }) {
  const { tasks } = useTasks(project.id);
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const inReview = tasks.filter(t => t.status === 'review').length;
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    return d < new Date();
  }).length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link href={`/workspace/${project.id}`}
      className="group bg-white border border-[#e9e9e9] rounded-[16px] p-[20px] hover:border-[#cfcfcf] hover:shadow-md transition-all duration-150">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="w-[36px] h-[36px] bg-[#f7f7f7] rounded-[10px] flex items-center justify-center shrink-0">
          <Folder size={16} className="text-[#9a9a9a]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-[#1f1f1f] truncate">{project.name}</h3>
          {project.description && (
            <p className="text-[11px] text-[#9a9a9a] mt-[2px] line-clamp-1">{project.description}</p>
          )}
        </div>
        <a href={`${PORTAL_URL}/project/${project.id}`} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-[#cfcfcf] hover:text-[#9a9a9a] transition-all shrink-0">
          <ExternalLink size={13} />
        </a>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#9a9a9a]">Прогрес</span>
          <span className="text-[11px] font-semibold text-[#1f1f1f]">{progress}%</span>
        </div>
        <div className="h-[4px] bg-[#f0f0f0] rounded-full overflow-hidden">
          <div className="h-full bg-[#1f1f1f] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <Stat icon={<CheckCircle2 size={12} />} value={done} label="Готово" color="#10b981" />
        <Stat icon={<Clock size={12} />} value={inProgress} label="В роботі" color="#6366f1" />
        {inReview > 0 && <Stat icon={<Clock size={12} />} value={inReview} label="Перевірка" color="#f97316" />}
        {overdue > 0 && <Stat icon={<AlertTriangle size={12} />} value={overdue} label="Прострочено" color="#ef4444" />}
        <div className="ml-auto text-[11px] font-medium text-[#cfcfcf] group-hover:text-[#9a9a9a] transition-colors">
          Відкрити →
        </div>
      </div>
    </Link>
  );
}

function Stat({ icon, value, label, color }) {
  return (
    <div className="flex items-center gap-[5px]" style={{ color }}>
      {icon}
      <span className="text-[12px] font-bold">{value}</span>
      <span className="text-[11px] text-[#9a9a9a]">{label}</span>
    </div>
  );
}

export default function WorkspaceOverviewPage() {
  const { currentUser, projects, projectsLoading } = useAppContext();
  const firstName = currentUser?.name?.split(' ')[0];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Top bar */}
      <div className="px-8 pt-8 pb-6 shrink-0">
        <h1 className="text-[#1f1f1f] text-[24px] font-bold">Привіт, {firstName} 👋</h1>
        <p className="text-[#9a9a9a] text-[14px] mt-1">{projects?.length || 0} активних проєктів</p>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {projectsLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="w-[28px] h-[28px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : projects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="w-[64px] h-[64px] bg-[#e9e9e9] rounded-[20px] flex items-center justify-center mb-4">
              <Folder size={28} className="text-[#9a9a9a]" />
            </div>
            <h2 className="text-[#1f1f1f] text-[18px] font-bold mb-2">Немає проєктів</h2>
            <p className="text-[#9a9a9a] text-[13px] mb-4">Створіть проєкт у клієнтському порталі</p>
            <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
              className="text-[13px] font-medium text-[#1f1f1f] underline underline-offset-4 hover:text-[#303030] transition-colors">
              Відкрити портал →
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-[16px]">
            {projects.map(p => <ProjectCard key={p.id} project={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
