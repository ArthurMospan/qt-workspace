'use client';
import { useState } from 'react';
import TopHeader from '@/components/ui/Layout/TopHeader';
import UserMenu from '@/components/ui/Layout/UserMenu';
import NotificationBell from '@/components/ui/Layout/NotificationBell';
import NotificationCard from '@/components/ui/Layout/NotificationCard';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import { CalendarClock } from 'lucide-react';
import { PreviewBlock } from '../preview';

export default function HeadersSection() {
  // Open by default: a closed menu previews a 36px avatar and nothing else, and
  // the part worth showing is what it opens.
  const [menuOpen, setMenuOpen] = useState(true);

  return (
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock title="1) WorkspaceHeader (Живий компонент)" description="Справжній хедер додатку, який реагує на стейт (хлібні крихти, таймер, чат)." filePath="src/components/WorkspaceHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden bg-white">
          <WorkspaceHeader />
        </div>
      </PreviewBlock>

      <PreviewBlock title="2) Звичайний пошук (Search Mode)" description="Пошук для загальних сторінок (старий TopHeader)." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="search" 
            searchPlaceholder="Пошук по моїх завданнях..." 
            unreadCount={0} 
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="3) Хлібні крихти з пошуком (Project Mode)" description="Навігація проєкту з розсувним пошуком. Аватарок команди тут навмисно немає — склад проєкту видно на вкладці «Команда», а хедер лишається місцем для навігації." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader
            mode="project"
            projectName="Mobile App Redesign"
            unreadCount={5}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="4) Хлібні крихти детального перегляду (Breadcrumbs Mode)" description="Відображення повного ієрархічного шляху до конкретної завдання." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="breadcrumbs" 
            breadcrumbs={[
              { label: 'Проєкти', href: '/' },
              { label: 'Mobile App Redesign', href: '/project-1' },
              { label: 'QT-104: Зворотній звʼязок', href: null },
            ]}
            unreadCount={2}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock title="5) Пошук по чатах + Аватарки + Статус (Chat Mode)" description="Спеціальний режим для чатів та каналів." filePath="src/components/ui/Layout/TopHeader.jsx" fullWidth>
        <div className="border border-[#f0f0f0] rounded-[16px] overflow-hidden">
          <TopHeader 
            mode="chat" 
            showNotifications={false}
            // No third-party avatar host here: the three placeholder URLs this
            // used to fetch failed on every load of the page, and the product
            // deliberately stores no such URL either — a user without a photo
            // gets initials in their own deterministic colour, which is the
            // thing worth previewing.
            onlineUsers={[
              { id: 'oksana', name: 'Оксана Литвин' },
              { id: 'ivan', name: 'Іван Петренко' },
              { id: 'taras', name: 'Тарас Шевчук' },
            ]}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="6) Меню користувача"
        description="Аватар у хедері й меню, яке він відкриває. Жив усередині WorkspaceHeader — а той розумний (контекст, стор, роутер, Firestore), тож у кіт переїхала тільки розмітка."
        filePath="src/components/ui/Layout/UserMenu.jsx"
        component="UserMenu"
        fullWidth
      >
        <div className="flex min-h-[220px] justify-end rounded-[16px] border border-[#f0f0f0] bg-white p-[16px]">
          <UserMenu
            user={{ id: 'kit-arthur', name: 'Артур Моспан', email: 'arthur@quickteam.app' }}
            open={menuOpen}
            onToggle={() => setMenuOpen(value => !value)}
            onSettings={() => {}}
            onSignOut={() => {}}
          />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="7) Дзвінок сповіщень"
        description="Скільки непрочитаних, і чи серед них є аварійне — воно замінює сам глиф, бо аварія це не голосніша версія того самого."
        filePath="src/components/ui/Layout/NotificationBell.jsx"
        component="NotificationBell"
      >
        <div className="flex items-center gap-[16px] rounded-[12px] bg-white p-[12px]">
          <NotificationBell unreadCount={0} onToggle={() => {}} />
          <NotificationBell unreadCount={3} onToggle={() => {}} />
          <NotificationBell unreadCount={42} onToggle={() => {}} />
          <NotificationBell unreadCount={2} hasEmergency onToggle={() => {}} />
          <NotificationBell unreadCount={3} open onToggle={() => {}} />
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="8) Картка сповіщення"
        description="Те, що приїжджає над робочою областю, коли сповіщення надходить. Не Toast: тост звітує про твою ж дію і йде сам, а це приходить непроханим, називає відправника й може нести цілу календарну відповідь."
        filePath="src/components/ui/Layout/NotificationCard.jsx"
        component="NotificationCard"
        fullWidth
      >
        {/* `fixed` in the component, so the preview gives it a positioned box to
            sit in rather than letting it fly to the corner of the catalogue. */}
        <div className="relative h-[190px] w-full overflow-hidden rounded-[16px] bg-canvas [&>*]:!absolute [&>*]:!bottom-[12px] [&>*]:!right-[12px]">
          <NotificationCard
            icon={<span className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[10px] bg-white text-ink"><CalendarClock size={16} /></span>}
            categoryLabel="Запрошення в подію"
            categoryColor="#6366f1"
            organizationName="QuickTeam"
            title="Планерка команди, четвер 10:00"
            body="Олена Коваль запросила вас на щотижневу зустріч команди дизайну."
            onOpen={() => {}}
            onDismiss={() => {}}
          />
        </div>
      </PreviewBlock>
    </div>
  );
}
