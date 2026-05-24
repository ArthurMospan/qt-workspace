'use client';
// src/app/workspace/page.js — Overview: project list + task stats
import { useAppContext } from '@/lib/context/AppContext';
import { useTasks } from '@/lib/hooks/useTasks';
import Link from 'next/link';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

function ProjectCard({ project }) {
  const { tasks } = useTasks(project.id);
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'in-progress').length;
  const overdue = tasks.filter(t => {
    if (!t.dueDate || t.status === 'done') return false;
    const d = t.dueDate?.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
    return d < new Date();
  }).length;

  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/workspace/${project.id}`}
      className="group flex flex-col gap-[14px] bg-[#1a1a1a] border border-white/[0.07] rounded-[18px] p-[20px] hover:border-white/[0.14] hover:bg-[#1e1e1e] transition-all duration-150"
    >
      {/* Project name + link to portal */}
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <h3 className="text-white text-[15px] font-bold truncate">{project.name}</h3>
          {project.description && (
            <p className="text-white/35 text-[12px] mt-[3px] line-clamp-1">{project.description}</p>
          )}
        </div>
        <a
          href={`${PORTAL_URL}/project/${project.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-white/60 transition-all shrink-0 mt-[2px]"
          title="Портал клієнта"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-[6px]">
          <span className="text-white/30 text-[10px] font-medium">Прогрес задач</span>
          <span className="text-white/50 text-[10px] font-bold">{done}/{total}</span>
        </div>
        <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-[16px]">
        <Stat value={inProgress} label="В роботі" color="text-blue-400" />
        <Stat value={tasks.filter(t => t.status === 'review').length} label="Перевірка" color="text-yellow-400" />
        {overdue > 0 && <Stat value={overdue} label="Прострочено" color="text-red-400" />}
        <div className="ml-auto text-white/25 text-[11px] font-medium group-hover:text-white/50 transition-colors flex items-center gap-[4px]">
          Відкрити →
        </div>
      </div>
    </Link>
  );
}

function Stat({ value, label, color }) {
  return (
    <div className="flex items-center gap-[5px]">
      <span className={`text-[13px] font-bold ${color}`}>{value}</span>
      <span className="text-white/30 text-[11px]">{label}</span>
    </div>
  );
}

export default function WorkspaceOverviewPage() {
  const { currentUser, projects, projectsLoading } = useAppContext();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-[28px] pt-[24px] pb-[20px] border-b border-white/[0.06] shrink-0">
        <h1 className="text-white text-[22px] font-bold">Привіт, {currentUser?.name?.split(' ')[0]} 👋</h1>
        <p className="text-white/35 text-[13px] mt-[3px]">
          {projects?.length || 0} активних проєктів
        </p>
      </div>

      {/* Projects grid */}
      <div className="flex-1 overflow-y-auto p-[28px]">
        {projectsLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <div className="w-[32px] h-[32px] border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
          </div>
        ) : projects?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="text-[48px] mb-[16px]">📋</div>
            <h2 className="text-white text-[18px] font-bold mb-[8px]">Немає проєктів</h2>
            <p className="text-white/35 text-[13px]">Створіть проєкт у клієнтському порталі</p>
            <a href={PORTAL_URL} target="_blank" rel="noopener noreferrer"
              className="mt-[16px] text-blue-400/70 hover:text-blue-400 text-[13px] transition-colors">
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
