'use client';
// src/components/workspace/ProjectTabBar.jsx
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Plus, Settings } from 'lucide-react';

export default function ProjectTabBar({
  projectId,
  tabs,
  activeTab,
  onTabChange,
  showPortal = false,
  showPortalIndicator = false,
  onCreateTask,
  onConfig,
  projectName,
}) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith(`/workspace/${projectId}/portal`);

  return (
    <div className="bg-white flex items-center gap-[8px] px-[20px] py-[10px] shrink-0 border-b border-[#f7f7f7]">
      {projectName && (
        <div className="flex items-center gap-2 mr-4">
          <h2 className="text-[16px] font-bold text-[#1f1f1f]">{projectName}</h2>
          {onConfig && (
            <button
              onClick={onConfig}
              className="text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors p-1 rounded-md hover:bg-[#f7f7f7]"
              title="Налаштування"
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      )}
      {/* Tab group */}
      <div className="flex bg-[#f7f7f7] p-[3px] rounded-[10px] items-center gap-[2px]">
        {!isPortal && (tabs || []).map(tab => {
          const Icon   = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={`flex items-center gap-[6px] px-[14px] py-[6px] text-[12px] font-semibold rounded-[8px] transition-all whitespace-nowrap ${
                active
                  ? 'bg-white text-[#1f1f1f] shadow-sm'
                  : 'text-[#9a9a9a] hover:text-[#1f1f1f]'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}

        {isPortal && (tabs || []).map(tab => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.id}
              href={`/workspace/${projectId}`}
              className="flex items-center gap-[6px] px-[14px] py-[6px] text-[12px] font-semibold rounded-[8px] text-[#9a9a9a] hover:text-[#1f1f1f] transition-all whitespace-nowrap"
            >
              <Icon size={13} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      {/* Portal tab */}
      {showPortal && (
        <Link
          href={`/workspace/${projectId}/portal`}
          className={`relative flex items-center gap-[6px] px-[14px] py-[7px] rounded-[10px] text-[12px] font-semibold transition-all whitespace-nowrap ${
            isPortal
              ? 'bg-[#6366f1]/10 text-[#6366f1]'
              : 'bg-[#f7f7f7] text-[#9a9a9a] hover:text-[#6366f1] hover:bg-[#6366f1]/8'
          }`}
        >
          <MessageSquare size={13} />
          QuickTeam+
          {showPortalIndicator && (
            <span className="absolute -top-[3px] -right-[3px] w-[10px] h-[10px] rounded-full bg-[#ef4444] border-2 border-white" />
          )}
        </Link>
      )}

      {/* Create Task Button */}
      {onCreateTask && (
        <button
          onClick={onCreateTask}
          className="flex items-center gap-[6px] px-[14px] py-[7px] bg-[#1f1f1f] text-white rounded-[10px] text-[12px] font-bold hover:bg-[#303030] transition-colors"
        >
          <Plus size={14} />
          Створити задачу
        </button>
      )}
    </div>
  );
}
