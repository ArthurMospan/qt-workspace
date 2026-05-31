import React from 'react';
import { Search, ChevronRight, X, Bell, Hash } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { HeaderSearch } from '../Forms/HeaderSearch';
import { Breadcrumb } from '../Navigation/Breadcrumb';

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

  const renderLeft = () => {
    if (mode === 'breadcrumbs') {
      return (
        <Breadcrumb items={breadcrumbs} />
      );
    }

    if (mode === 'project') {
      const projectCrumbs = [
        { label: 'Проєкти', href: '/workspace' },
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
        <div className="flex items-center gap-4 w-full">
          <HeaderSearch
            value={searchValue}
            onChange={onSearchChange}
            onClear={onSearchClear}
            placeholder="Пошук по чатах..."
            className="w-[240px]"
          />
          
          <div className="h-4 w-[1px] bg-[#e9e9e9]"></div>
          
          {/* Online Users Avatars */}
          <div className="flex items-center -space-x-2">
            {onlineUsers.slice(0, 5).map((u, i) => (
              <div key={i} className="relative w-7 h-7 rounded-[10px] border-2 border-white overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                <UserAvatar user={u} size={24} />
                <div className="absolute bottom-[-2px] right-[-2px] w-2.5 h-2.5 bg-green-500 border-[1.5px] border-white rounded-full"></div>
              </div>
            ))}
            {onlineUsers.length > 5 && (
              <div className="w-7 h-7 rounded-[10px] border-2 border-white bg-gray-100 flex items-center justify-center z-10 text-[10px] font-bold text-gray-600">
                +{onlineUsers.length - 5}
              </div>
            )}
          </div>
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
      </div>

      {rightContent ? rightContent : (
        <div className="flex items-center gap-[6px] shrink-0 ml-4 z-50">
          {showNotifications && (
            <button
              onClick={onBellClick}
              className={`relative w-[36px] h-[36px] flex items-center justify-center rounded-[10px] transition-all text-[#9a9a9a] hover:bg-[#f4f4f5] hover:text-[#1f1f1f]`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-[6px] right-[6px] min-w-[12px] h-[12px] bg-[#6366f1] text-white text-[8px] font-bold rounded-full flex items-center justify-center px-[2px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {mode === 'chat' && (
            <div className="flex items-center gap-1.5 mr-2 bg-[#f4f4f5] px-2 py-1 rounded-full cursor-pointer hover:bg-[#efefef] transition-colors">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[11px] font-bold text-[#1f1f1f]">В мережі</span>
            </div>
          )}

          <button
            onClick={onUserClick}
            className="flex items-center justify-center w-[36px] h-[36px] rounded-[10px] hover:bg-[#f4f4f5] transition-all overflow-hidden"
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
