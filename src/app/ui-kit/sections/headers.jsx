'use client';
import TopHeader from '@/components/ui/Layout/TopHeader';
import WorkspaceHeader from '@/components/WorkspaceHeader';
import { PreviewBlock } from '../preview';

export default function HeadersSection() {
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
    </div>
  );
}
