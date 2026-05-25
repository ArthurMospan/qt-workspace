'use client';
import React, { useState, useMemo } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Archive, ArchiveRestore, Plus, Folder, Clock, Users, CheckCircle2, TrendingUp, Target, ArrowRight, Check, Lock, Globe, X, MoreVertical, Edit2, Trash2, User } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const CircularProgress = ({ progress = 0, size = 44, strokeWidth = 3 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.min(100, Math.max(0, progress || 0));
  const offset = circumference - (safeProgress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#f0f0f0" strokeWidth={strokeWidth} fill="transparent" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={safeProgress >= 100 ? "#f0f0f0" : "#1f1f1f"}
          strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" fill="transparent" className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {safeProgress >= 100 ? (
          <Check size={size * 0.38} strokeWidth={2} className="text-[#1f1f1f]" />
        ) : (
          <span className="text-[10px] font-bold text-[#1f1f1f]">
            {Math.round(safeProgress)}%
          </span>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-[20px] p-[16px] border border-[#f0f0f0] flex items-center gap-[16px] transition-all ${onClick ? 'cursor-pointer hover:border-[#1f1f1f]/20' : ''}`}
  >
    <div className="w-[44px] h-[44px] rounded-[14px] flex items-center justify-center shrink-0 bg-[#f7f7f7] text-[#1f1f1f]">
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[#9a9a9a] text-[10px] font-bold uppercase tracking-widest mb-[2px]">{title}</p>
      <h3 className="text-[20px] font-bold text-[#1f1f1f] tracking-tight">{value}</h3>
    </div>
    {onClick && <ArrowRight size={16} className="text-[#cfcfcf] ml-auto" />}
  </div>
);


const ProjectCard = ({ project, archive, unarchive }) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isArchived = project.status === 'archived';
  const teamCount = Array.isArray(project.team) ? project.team.length : 0;
  const budget = project.totalBudgetHours || 0;
  const spent = project.spentMinutes ? Math.round(project.spentMinutes / 60) : 0;
  
  const handleCardClick = (e) => {
    // Prevent navigation if clicking inside the menu or menu button
    if (e.target.closest('.no-nav')) return;
    router.push(`/workspace/${project.id}`);
  };

  return (
    <div 
      onClick={handleCardClick}
      className="group cursor-pointer relative bg-white rounded-[24px] flex flex-col justify-between border border-[#f0f0f0] overflow-visible hover:scale-[1.01] hover:ring-8 hover:ring-[#1f1f1f]/5 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-[#1f1f1f]/10 transition-all duration-300 p-[24px] pb-[32px] gap-[20px]"
    >
      <div className="z-10 relative flex flex-col gap-[20px]">
        {/* Top Row: Team & Progress */}
        <div className="flex justify-between items-center">
          <div className="flex -space-x-[12px]">
             {Array.from({ length: Math.min(teamCount, 3) }).map((_, i) => (
                <div key={i} className="w-[32px] h-[32px] rounded-full bg-[#f0f0f0] border-2 border-white flex items-center justify-center overflow-hidden">
                  <User size={16} className="text-[#9a9a9a]" />
                </div>
             ))}
             {teamCount > 3 && (
               <div className="w-[32px] h-[32px] rounded-full bg-[#f7f7f7] border-2 border-white flex items-center justify-center text-[10px] font-bold text-[#9a9a9a]">
                 +{teamCount - 3}
               </div>
             )}
             {teamCount === 0 && (
                <div className="w-[32px] h-[32px] rounded-full bg-[#f0f0f0] border-2 border-white flex items-center justify-center">
                  <Users size={14} className="text-[#9a9a9a]" />
                </div>
             )}
          </div>

          <div className="flex items-center gap-[12px]">
            <CircularProgress progress={project.progress || 0} size={44} />
            <div className="relative no-nav">
              <button 
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-[8px] text-[#9a9a9a] hover:bg-[#f7f7f7] hover:text-[#1f1f1f] rounded-full transition-all"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-[180px] bg-white rounded-[16px] shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-[#f0f0f0] py-[8px] z-50">
                    <button className="w-full text-left px-[16px] py-[10px] text-[13px] font-bold text-[#1f1f1f] hover:bg-[#f7f7f7] flex items-center gap-[8px]">
                      <Edit2 size={14} /> Редагувати
                    </button>
                    {!isArchived ? (
                      <button 
                        onClick={(e) => { e.stopPropagation(); archive(project.id); setMenuOpen(false); }}
                        className="w-full text-left px-[16px] py-[10px] text-[13px] font-bold text-[#9a9a9a] hover:bg-[#f7f7f7] hover:text-[#1f1f1f] flex items-center gap-[8px]"
                      >
                        <Archive size={14} /> Архівувати
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => { e.stopPropagation(); unarchive(project.id); setMenuOpen(false); }}
                        className="w-full text-left px-[16px] py-[10px] text-[13px] font-bold text-[#10b981] hover:bg-emerald-50 flex items-center gap-[8px]"
                      >
                        <ArchiveRestore size={14} /> Розархівувати
                      </button>
                    )}
                    <div className="h-[1px] bg-[#f0f0f0] my-[4px]" />
                    <button className="w-full text-left px-[16px] py-[10px] text-[13px] font-bold text-red-500 hover:bg-red-50 flex items-center gap-[8px]">
                      <Trash2 size={14} /> Видалити
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Title & Description */}
        <div className="flex flex-col gap-[8px]">
          <h2 className="text-[22px] font-bold text-[#1f1f1f] leading-tight line-clamp-1 group-hover:text-[#6366f1] transition-colors">
            {project.name}
          </h2>
          <p className="text-[#9a9a9a] text-[14px] font-medium leading-[22px] line-clamp-2">
            {project.description || 'Немає опису...'}
          </p>
        </div>

        {/* Visibility badge */}
        {project.visibility === 'internal' && (
          <div className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-full bg-[#f0f0f0] w-fit">
            <Lock size={10} className="text-[#9a9a9a]" />
            <span className="text-[9px] font-bold text-[#9a9a9a] uppercase tracking-wider">Внутрішній</span>
          </div>
        )}
        {project.visibility === 'shared' && (
          <div className="flex items-center gap-[4px] px-[8px] py-[3px] rounded-full bg-blue-50 w-fit">
            <Globe size={10} className="text-blue-400" />
            <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">Клієнтський</span>
          </div>
        )}
      </div>

      {/* Bottom Row */}
      <div className="z-10 relative mt-auto flex flex-col gap-[16px]">
         <div className="flex items-center gap-[12px]">
            {budget > 0 && (
              <div className="flex items-center gap-[6px] text-[#9a9a9a]">
                <Clock size={14} strokeWidth={2.5} className="opacity-30" />
                <span className="text-[11px] font-bold tracking-tight">{spent}г / {budget}г</span>
              </div>
            )}
            {isArchived && (
               <span className="text-[10px] font-bold px-[8px] py-[3px] rounded-full bg-[#f7f7f7] text-[#9a9a9a] border border-[#e9e9e9]">
                 Архів
               </span>
            )}
         </div>
      </div>
    </div>
  );
};


// ── New Internal Project Modal ───────────────────────────────────────────────
function NewProjectModal({ onClose, orgId, userId }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [visibility,  setVisibility]  = useState('internal');
  const [saving,      setSaving]      = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        visibility,
        organizationId: orgId,
        team: [userId],
        status: 'active',
        progress: 0,
        stagesCount: 4,
        issueCounter: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
      };
      
      await addDoc(collection(db, 'debug_logs'), {
        msg: 'attempting create',
        payload: { ...payload, createdAt: 'serverTimestamp', updatedAt: 'serverTimestamp' },
        time: new Date().toISOString()
      });

      const projectRef = await addDoc(collection(db, 'projects'), payload);
      
      const stageNames = ['Брифінг & Аналіз', 'Дизайн & UI/UX', 'Розробка', 'Тестування & Реліз'];
      const newStages = [];
      for (let i = 0; i < stageNames.length; i++) {
        const stageData = {
          label: `${String(i + 1).padStart(2, '0')}. ${stageNames[i]}`,
          status: i === 0 ? 'in-progress' : 'todo',
          projectId: projectRef.id,
          order: i,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'stages'), stageData);
      }
      
      await addDoc(collection(db, 'debug_logs'), {
        msg: 'create success with stages',
        time: new Date().toISOString()
      });
      
      onClose();
    } catch (err) {
      console.error('[NewProject]', err);
      await addDoc(collection(db, 'debug_logs'), {
        msg: 'create error',
        error: err.message,
        time: new Date().toISOString()
      }).catch(() => {});
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-[24px] w-full max-w-[480px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-[24px] pt-[24px] pb-[20px] border-b border-[#f0f0f0]">
          <h2 className="text-[18px] font-bold text-[#1f1f1f]">Новий проєкт</h2>
          <button onClick={onClose} className="p-[6px] hover:bg-[#f7f7f7] rounded-[8px] text-[#9a9a9a]"><X size={18} /></button>
        </div>
        <div className="p-[24px] flex flex-col gap-[16px]">
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Назва проєкту *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Наприклад: Редизайн сайту"
              className="w-full text-[15px] font-semibold bg-[#f7f7f7] rounded-[12px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[6px] block">Опис</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Короткий опис проєкту..."
              rows={3}
              className="w-full text-[14px] bg-[#f7f7f7] rounded-[12px] px-[14px] py-[10px] outline-none border border-transparent focus:border-[#1f1f1f] transition-colors resize-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-[8px] block">Видимість</label>
            <div className="grid grid-cols-2 gap-[8px]">
              {[
                { val: 'internal', icon: Lock,  label: 'Внутрішній', desc: 'Лише для команди' },
                { val: 'shared',   icon: Globe, label: 'Клієнтський', desc: 'Видно у клієнтському порталі' },
              ].map(({ val, icon: Icon, label, desc }) => (
                <button
                  key={val}
                  onClick={() => setVisibility(val)}
                  className={`flex flex-col items-start gap-[4px] p-[12px] rounded-[12px] border-2 text-left transition-all ${
                    visibility === val
                      ? 'border-[#1f1f1f] bg-[#1f1f1f]/5'
                      : 'border-[#f0f0f0] hover:border-[#cfcfcf]'
                  }`}
                >
                  <div className="flex items-center gap-[6px]">
                    <Icon size={14} className={visibility === val ? 'text-[#1f1f1f]' : 'text-[#9a9a9a]'} />
                    <span className={`text-[13px] font-bold ${visibility === val ? 'text-[#1f1f1f]' : 'text-[#4a4a4a]'}`}>{label}</span>
                  </div>
                  <span className="text-[11px] text-[#9a9a9a] leading-tight">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-[8px] px-[24px] pb-[24px]">
          <button onClick={onClose} className="flex-1 py-[12px] rounded-[12px] text-[14px] font-bold text-[#9a9a9a] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
            Скасувати
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-1 py-[12px] rounded-[12px] text-[14px] font-bold text-white bg-[#1f1f1f] hover:bg-[#303030] disabled:opacity-40 transition-colors"
          >
            {saving ? 'Створення...' : 'Створити проєкт'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { projects, currentUser, activeOrgId } = useAppContext();
  const [showArchived,  setShowArchived]  = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);

  const visible = (projects || []).filter(p =>
    showArchived ? p.status === 'archived' : p.status !== 'archived'
  );

  const archive   = (id) => updateDoc(doc(db, 'projects', id), { status: 'archived' });
  const unarchive = (id) => updateDoc(doc(db, 'projects', id), { status: 'active' });

  const stats = useMemo(() => {
    const active = (projects || []).filter(p => p.status !== 'archived');
    const total = active.length;
    const completed = active.filter(p => p.progress >= 100).length;
    const avgProgress = total > 0 ? Math.round(active.reduce((acc, p) => acc + (p.progress || 0), 0) / total) : 0;
    return { total, completed, avgProgress };
  }, [projects]);

  return (<>
    <div className="flex-1 h-full overflow-y-auto overflow-x-hidden px-[16px] md:px-[32px] pb-[120px] custom-scrollbar bg-[#f7f7f7]">
      <div className="max-w-[1400px] mx-auto">
        
        {/* Header Section */}
        <div className="pt-[32px] mb-[32px]">
          <div className="flex justify-between items-center mb-[24px]">
            <div>
               <h1 className="text-[26px] md:text-[36px] font-bold text-[#1f1f1f] tracking-tight leading-tight truncate">
                 Проєкти команди
               </h1>
               <p className="text-[#9a9a9a] mt-[4px] text-[14px]">Внутрішній робочий простір</p>
            </div>

            <div className="flex items-center gap-[12px]">
              <button
                onClick={() => setShowArchived(s => !s)}
                className={`flex items-center gap-[8px] px-[16px] py-[12px] rounded-[14px] text-[13px] font-bold border transition-all ${
                  showArchived
                    ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                    : 'bg-white text-[#9a9a9a] border-[#e9e9e9] hover:border-[#cfcfcf] hover:text-[#1f1f1f]'
                }`}
              >
                <Archive size={16} />
                <span className="hidden sm:inline">{showArchived ? 'Активні' : 'Архів'}</span>
              </button>

              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-[8px] px-[20px] py-[12px] rounded-[14px] text-[13px] font-bold bg-[#1f1f1f] text-white hover:bg-[#303030] transition-all shadow-sm"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Новий проєкт</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          {!showArchived && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px]">
              <StatCard title="Активних проєктів" value={stats.total} icon={Target} />
              <StatCard title="Середній прогрес" value={`${stats.avgProgress}%`} icon={TrendingUp} />
              <StatCard title="Завершено" value={stats.completed} icon={CheckCircle2} />
            </div>
          )}
        </div>

        {/* Projects Grid */}
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-[80px] text-center bg-white rounded-[32px] border border-[#f0f0f0]">
            <div className="w-[80px] h-[80px] bg-[#f7f7f7] rounded-full flex items-center justify-center mb-[24px]">
              <Folder size={40} className="text-[#cfcfcf]" />
            </div>
            <h2 className="text-[22px] font-bold text-[#1f1f1f] mb-[8px]">
              {showArchived ? 'Немає архівних проєктів' : 'Немає активних проєктів'}
            </h2>
            <p className="text-[#9a9a9a] text-[14px] max-w-[280px]">
              Всі проєкти створюються клієнтами через основний портал.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[24px]">
            {visible.map(p => (
              <ProjectCard 
                key={p.id} 
                project={p} 
                archive={archive} 
                unarchive={unarchive} 
              />
            ))}
          </div>
        )}

      </div>
    </div>

    {showNewProject && (
      <NewProjectModal
        onClose={() => setShowNewProject(false)}
        orgId={activeOrgId}
        userId={currentUser?.id || currentUser?.uid}
      />
    )}
  </>);
}
