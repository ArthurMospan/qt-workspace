import React from 'react';
import { Search, ChevronDown, ChevronRight, X, Bell, Hash } from 'lucide-react';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { HeaderSearch } from '../Forms/HeaderSearch';
import { Breadcrumb } from '../Navigation/Breadcrumb';
import Tooltip from '../Navigation/Tooltip';
import Popover from '../Navigation/Popover';
import Pill from '../DataDisplay/Pill';

function ProjectMembersMenu({ members, onMemberClick }) {
  const onlineCount = members.filter(member => member.online).length;

  return (
    <Popover
      position="bottom"
      align="end"
      gap={6}
      hideArrow
      hideCloseIcon
      minWidth="300px"
      padding="8px"
      triggerClassName="flex"
      trigger={(
        <button
          type="button"
          className="flex items-center gap-2 rounded-[10px] px-2 py-1 transition-colors hover:bg-canvas"
          aria-label="Переглянути команду проєкту"
        >
          <span className="flex items-center -space-x-2.5">
            {members.slice(0, 5).map(member => (
              <span
                key={member.id || member.uid}
                className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-white"
              >
                <UserAvatar user={member} size={28} />
                {member.online ? (
                  <span className="absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                ) : null}
              </span>
            ))}
            {members.length > 5 ? (
              <span className="z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-[10px] font-bold text-muted shadow-sm">
                +{members.length - 5}
              </span>
            ) : null}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="w-[284px]">
          <div className="flex items-center justify-between border-b border-line px-2 pb-2 pt-1">
            <div>
              <p className="text-[12px] font-bold text-ink">Команда проєкту</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {onlineCount > 0 ? `${onlineCount} зараз онлайн` : 'Ніхто зараз не онлайн'}
              </p>
            </div>
            <Pill tone="neutral" size="md">{members.length}</Pill>
          </div>

          <div className="mt-1 flex max-h-[320px] flex-col overflow-y-auto">
            {members.map(member => (
              <button
                key={member.id || member.uid}
                type="button"
                onClick={() => {
                  close();
                  onMemberClick?.(member);
                }}
                className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-canvas"
              >
                <span className="relative shrink-0">
                  <UserAvatar user={member} size={34} />
                  <span className={`absolute -bottom-[1px] -right-[1px] h-2.5 w-2.5 rounded-full border-2 border-white ${
                    member.online ? 'bg-emerald-500' : 'bg-[#cfcfcf]'
                  }`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-ink">
                    {member.name || member.displayName || member.email || 'Учасник'}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted">
                    {member.online ? 'В мережі' : member.email || 'Не в мережі'}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

export default function TopHeader({
  mode = 'search', // 'search', 'project', 'breadcrumbs', 'chat'
  
  // Search Props
  searchValue = '',
  searchPlaceholder = 'Пошук...',
  onSearchChange = () => {},
  onSearchClear = () => {},
  
  // Project Props
  projectName = 'Назва проєкту',
  projectSearchActive = false,
  onProjectSearchToggle = () => {},
  
  // Breadcrumbs Props
  breadcrumbs = [],

  // Chat Props
  onlineUsers = [],
  onOnlineUserClick = () => {},

  // Project team props
  projectMembers = [],

  // Right Side Props
  showNotifications = true,
  unreadCount = 0,
  onBellClick = () => {},

  currentUser = null,
  onUserClick = () => {},

  // Right Side Override
  rightContent = null,
  
  // Styling
  hideBorder = false,
}) {
  const renderOnlineUsers = () => (
    <div className="flex items-center -space-x-2.5">
      {onlineUsers.slice(0, 5).map((u, i) => (
        <Tooltip key={u.id || u.uid || i} content={u.name || u.email || 'Учасник'} position="bottom">
          <button
            type="button"
            onClick={() => onOnlineUserClick(u)}
            className="relative w-8 h-8 flex items-center justify-center shrink-0 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:rounded-full"
            aria-label={`Відкрити чат з ${u.name || u.email || 'учасником'}`}
          >
            <span className="overflow-hidden rounded-full ring-2 ring-white"><UserAvatar user={u} size={28} /></span>
            <span className="absolute -bottom-[1px] -right-[1px] w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
          </button>
        </Tooltip>
      ))}
      {onlineUsers.length > 5 && (
        <div className="w-8 h-8 rounded-full border-2 border-white bg-white flex items-center justify-center z-10 text-[10px] font-bold text-gray-600 shadow-sm">
          +{onlineUsers.length - 5}
        </div>
      )}
    </div>
  );

  const renderLeft = () => {
    if (mode === 'breadcrumbs') {
      return (
        <Breadcrumb items={breadcrumbs} />
      );
    }

    if (mode === 'project') {
      const projectCrumbs = [
        { label: 'Проєкти', href: '/' },
        { label: projectName, href: null },
      ];
      return (
        <Breadcrumb
          items={projectCrumbs}
          showSearchButton={true}
          isSearchActive={projectSearchActive}
          onSearchToggle={onProjectSearchToggle}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          onSearchClear={onSearchClear}
          searchPlaceholder={`Пошук по "${projectName}"...`}
        />
      );
    }

    if (mode === 'chat') {
      return (
        <div className="flex items-center w-full">
          <HeaderSearch
            value={searchValue}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder="Пошук по чатах..."
            className="w-[240px]"
          />
        </div>
      );
    }

    // Default: SEARCH mode
    return (
      <HeaderSearch
        value={searchValue}
        onChange={onSearchChange}
        onClear={onSearchClear}
        placeholder={searchPlaceholder}
      />
    );
  };

  return (
    <header className={`h-[56px] shrink-0 bg-white flex items-center pl-[16px] pr-[10px] justify-between z-30 w-full ${!hideBorder ? 'border-b border-[#f0f0f0]' : ''}`}>
      <div className="flex-1 min-w-0 flex items-center">
        {renderLeft()}
        {mode === 'project' && projectMembers.length > 0 ? (
          <div className="ml-3 shrink-0">
            <ProjectMembersMenu members={projectMembers} onMemberClick={onOnlineUserClick} />
          </div>
        ) : null}
      </div>

      {mode === 'chat' && onlineUsers.length > 0 && (
        <div className="ml-3 mr-2 shrink-0">{renderOnlineUsers()}</div>
      )}

      {rightContent ? rightContent : (
        <div className="flex items-center gap-[6px] shrink-0 ml-4 z-50">
          {showNotifications && (
            <button
              onClick={onBellClick}
              className={`relative w-[36px] h-[36px] flex items-center justify-center rounded-[10px] transition-all text-muted hover:bg-canvas hover:text-ink`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-[6px] right-[6px] min-w-[12px] h-[12px] bg-ink text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {mode === 'chat' && (
            <div className="flex items-center gap-1.5 mr-2 bg-canvas px-2 py-1 rounded-full cursor-pointer hover:bg-[#efefef] transition-colors">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[11px] font-bold text-ink">В мережі</span>
            </div>
          )}

          <button
            onClick={onUserClick}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-[10px] hover:bg-canvas transition-all overflow-hidden"
          >
            {currentUser ? (
              <UserAvatar user={currentUser} size={28} />
            ) : (
              <div className="w-[28px] h-[28px] rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-[12px] text-gray-500 font-bold">U</span>
              </div>
            )}
          </button>
        </div>
      )}
    </header>
  );
}
