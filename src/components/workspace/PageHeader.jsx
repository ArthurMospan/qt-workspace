'use client';
import Link from 'next/link';
import { Settings } from 'lucide-react';

export default function PageHeader({
  variant = 'main',
  title,
  tabs = [],
  activeTab,
  onTabChange,
  actions,
  filters,
  onConfig,
  className = '',
}) {
  if (variant === 'alt') {
    return (
      <div className={`bg-white flex items-center gap-[8px] px-[20px] py-[10px] shrink-0 border-b border-[#f7f7f7] w-full ${className}`}>
        {title && (
          <div className="flex items-center gap-2 mr-4 shrink-0">
            <h2 className="text-[32px] font-bold text-[#1f1f1f] tracking-tight">{title}</h2>
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
        {tabs?.length > 0 && (
          <div className="flex bg-[#f7f7f7] p-[3px] rounded-[10px] items-center gap-[2px] shrink-0">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              const content = (
                <>
                  {Icon && <Icon size={13} />}
                  {tab.label}
                </>
              );
              const classes = `flex items-center justify-center gap-[6px] px-[16px] h-[32px] text-[12px] font-semibold rounded-[8px] transition-all whitespace-nowrap ${
                active ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-[#9a9a9a] hover:text-[#1f1f1f]'
              }`;

              if (tab.href) {
                return (
                  <Link key={tab.id} href={tab.href} className={classes}>
                    {content}
                  </Link>
                );
              }
              return (
                <button key={tab.id} onClick={() => onTabChange?.(tab.id)} className={classes}>
                  {content}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-w-[20px]" />

        {filters && <div className="flex items-center gap-2 mr-2 shrink-0">{filters}</div>}

        {/* Custom Actions */}
        <div className="flex items-center gap-[8px] shrink-0">
          {actions}
        </div>
      </div>
    );
  }

  // variant === 'main'
  return (
    <div className={`shrink-0 flex flex-col pt-[32px] mb-[24px] gap-[16px] w-full ${className}`}>
      {/* Top Row: Title, Subtitle & Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-[32px] font-bold text-[#1f1f1f] tracking-tight truncate">
          {title}
        </h1>
        
        <div className="flex items-center gap-[12px] shrink-0">
          {actions}
        </div>
      </div>

      {/* Bottom Row: Tabs & Filters */}
      {(tabs?.length > 0 || filters) && (
        <div className="flex items-center gap-[12px] flex-wrap">
          {/* Tabs */}
          {tabs?.length > 0 && (
            <div className="flex bg-[#f7f7f7] p-1 rounded-[12px] border border-[#efefef] shrink-0">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const content = (
                  <>
                    {Icon && <Icon size={14} className="mr-1 inline-block" />}
                    {tab.label}
                  </>
                );
                const classes = `flex items-center justify-center px-[16px] h-[32px] rounded-[10px] text-[12px] font-bold transition-all whitespace-nowrap ${
                  active ? 'bg-white text-[#1f1f1f] shadow-sm' : 'text-[#9a9a9a] hover:text-[#1f1f1f]'
                }`;

                if (tab.href) {
                  return (
                    <Link key={tab.id} href={tab.href} className={classes}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <button key={tab.id} onClick={() => onTabChange?.(tab.id)} className={classes}>
                    {content}
                  </button>
                );
              })}
            </div>
          )}

          {/* Filters */}
          {filters && (
            <div className="flex items-center gap-[12px] flex-wrap flex-1">
              {filters}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
