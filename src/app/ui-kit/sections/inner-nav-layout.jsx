'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Surface from '@/components/ui/Surface';
import { IconAction, SidebarLayout, InnerNavigation, MobilePaneBack, UserAvatar, ChannelRail, MemberRail, ConfirmProvider, ChatComposerCore, StatusPill } from '@/components/ui';
import ChatComposerDock from '@/components/ui/ChatComposerDock';
import ChatConversationHeader from '@/components/ui/Chat/ChatConversationHeader';
import ChatMessageList from '@/components/ui/Chat/ChatMessageList';
import { Plus, User, Bell, X, Users, Building } from 'lucide-react';
import { ChatIcon } from '@/lib/design/icons';
import { PreviewBlock } from '../preview';
import { CHAT_DEMO_MEMBERS, CHAT_DEMO_MESSAGES } from '../demo-data';

// The three screens that "look different" — and the one shell they share.
//
// Settings, Team and Chat each render a canvas rail beside a white pane. Only
// Settings used to say so; Chat and Team hand-wrote the same shell, which is
// exactly how they drifted apart. They are still three different layouts —
// that part was never the problem — they are just three *named* ones now, so
// changing the shell changes all three and nothing else.
export default function NavMenuSection() {
  const [active, setActive] = useState('profile');
  const [teamPane, setTeamPane] = useState('sidebar');
  const NAV = [
    { id: 'profile',       label: 'Особистий профіль', icon: User,     group: 'Особисте' },
    { id: 'notifications', label: 'Сповіщення',        icon: Bell,     group: 'Особисте' },
    { id: 'workspace',     label: 'Загальні',          icon: Building, group: 'Організація' },
    { id: 'team',          label: 'Учасники команди',  icon: Users,    group: 'Організація' },
  ];
  const demoUser = { id: 'kit-arthur', name: 'Артур Моспан' };

  // No local row helpers here on purpose. This preview used to hand-copy the
  // two rails, and the copy was wrong in five ways at once: 8px radius drawn as
  // 10px, the #ebebeb selected row drawn as white-with-a-shadow, a 32px avatar
  // drawn at 24px, a muted name drawn as bold ink, and no presence dot at all.
  // ChannelRail and MemberRail are the components /chat and /team render, so
  // the catalogue shows the thing itself instead of a drawing of it.

  // MessageBubble in the chat preview can open a confirm ("delete message"),
  // so the section supplies the provider the app supplies at layout level.
  return (
    <ConfirmProvider>
    <div className="flex flex-col gap-[32px]">
      <PreviewBlock
        title="SidebarLayout context=&quot;settings&quot;"
        component="SidebarLayout"
        description="Повна висота вікна, нічого не зафіксовано зверху. InnerNavigation у рейці, біла панель контенту малюється самим лейаутом (hasBorder={false})."
        filePath="src/app/(app)/settings/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-white">
          <SidebarLayout
            context="settings"
            sidebar={<InnerNavigation items={NAV} activeId={active} onChange={setActive} />}
            hasBorder={false}
          >
            <main className="flex-1 overflow-y-auto custom-scrollbar bg-canvas relative">
              <div className="max-w-[760px] mx-auto px-[16px] py-[24px] md:px-[32px] md:py-[48px] min-h-full flex flex-col">
                <div className="flex-1 pb-[100px]">
                  <h2 className="text-[22px] font-bold text-ink">Особистий профіль</h2>
                  <p className="mt-1 text-[13px] text-muted">Керуйте особистими даними та налаштуваннями профілю.</p>
                  <Surface preset="card" padding="lg" className="mt-6">
                    <div className="h-[180px]" />
                  </Surface>
                </div>
              </div>
            </main>
          </SidebarLayout>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="SidebarLayout context=&quot;team&quot;"
        description="Під фіксованим 56px хедером, тому каркас сам резервує цю висоту. Права панель — Surface preset=&quot;panel&quot;, а не проста біла зона, тому сторінка малює її сама (wrapsContent: false)."
        filePath="src/app/(app)/team/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-white">
          <SidebarLayout
            context="team"
            mobilePane={teamPane}
            className="!pt-[12px]"
            sidebar={(
              <MemberRail
                members={[
                  { id: 'arthur', name: 'Артур Моспан', positionName: 'Власник організації', online: true },
                  { id: 'olena', name: 'Олена Коваль', positionName: 'Frontend Developer', online: true },
                  { id: 'petro', name: 'Петро Іванчук', positionName: 'Designer' },
                  { id: 'anna', name: 'Анна Мельник', positionName: 'QA Engineer' },
                ]}
                activeId="arthur"
                action={<Button style="ghost" size="icon-xs" icon={Plus} className="hover:!bg-white" title="Запросити" />}
              />
            )}
          >
            <Surface preset="panel" padding="sm" className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-col items-center gap-2 py-8">
                <UserAvatar user={demoUser} size="hero" />
                <h3 className="text-[18px] font-bold text-ink">Артур Моспан</h3>
                <StatusPill label="Онлайн" tone="success" />
              </div>
              <button type="button" onClick={() => setTeamPane(teamPane === 'sidebar' ? 'content' : 'sidebar')}
                className="mx-auto rounded-[8px] bg-canvas px-3 py-1.5 text-[11px] font-bold text-muted">
                mobilePane: {teamPane} (клац, щоб перемкнути)
              </button>
            </Surface>
          </SidebarLayout>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="SidebarLayout context=&quot;chat&quot;"
        description="Той самий каркас, але чат подає дві панелі поруч — розмову й гілку — тому лейаут не загортає контент у власну білу зону. Це єдина справжня відмінність чату; жолоб, ширина рейки та відступ під хедером тепер спільні."
        filePath="src/app/(app)/chat/page.js"
        fullWidth
      >
        <div className="h-[420px] w-full overflow-hidden rounded-[24px] border border-line bg-canvas">
          <SidebarLayout
            context="chat"
            className="!pt-[12px]"
            sidebar={(
              <ChannelRail
                activeId="general"
                groups={[
                  {
                    id: 'channels',
                    label: 'Канали',
                    action: <Button style="ghost" size="icon-xs" icon={Plus} className="hover:!bg-white" title="Новий канал" />,
                    items: [
                      { id: 'general', kind: 'channel', name: 'general' },
                      { id: 'design', kind: 'channel', name: 'design', unreadCount: 3 },
                      { id: 'releases', kind: 'channel', name: 'releases' },
                    ],
                  },
                  {
                    id: 'dms',
                    label: 'Особисті',
                    items: [
                      { id: 'olena', kind: 'dm', name: 'Олена Коваль', user: { name: 'Олена Коваль' }, online: true, unreadCount: 1 },
                      { id: 'petro', kind: 'dm', name: 'Петро Іванчук', user: { name: 'Петро Іванчук' } },
                    ],
                  },
                ]}
              />
            )}
          >
            <div className="flex flex-1 gap-3 min-w-0 overflow-hidden">
              {/* Conversation pane — the product's own chrome: canvas surface,
                  64px translucent header, composer docked at the bottom. */}
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-canvas">
                {/* The header and the list are the product's own components.
                    This preview used to retype both, and the copy was already
                    wrong twice over: a bare <Info> glyph where /chat has a
                    toggle, and no pinned counter at all. */}
                <ChatConversationHeader
                  type="channel"
                  title="general"
                  subtitle="Загальний канал для всієї команди"
                  pinnedCount={1}
                  infoLabel="Про канал"
                />
                <ChatMessageList
                  messages={CHAT_DEMO_MESSAGES}
                  myUid="kit-arthur"
                  members={CHAT_DEMO_MEMBERS}
                  typingUsers={['Олена Коваль']}
                  unreadCount={2}
                  hasMore
                  onLoadMore={() => {}}
                  onReact={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onThread={() => {}}
                  onPin={() => {}}
                  onOpenAttachment={() => {}}
                />
                <ChatComposerDock>
                  <div className="relative px-4 pb-4">
                    <ChatComposerCore variant="workspace" value="" onChange={() => {}} onSubmit={() => {}} placeholder="Написати в #general..." canSubmit={false} />
                  </div>
                </ChatComposerDock>
              </div>
              {/* Thread rail — the second pane, and the only reason chat opts
                  out of the shell drawing a single content pane. */}
              <div data-ui-overlay="responsive-pane" className="hidden shrink-0 flex-col overflow-hidden rounded-[16px] bg-canvas md:flex md:w-[280px]">
                <div className="relative z-10 flex h-[56px] shrink-0 items-center justify-between border-b border-line/70 bg-canvas/90 px-5 backdrop-blur-xl">
                  <div className="flex items-center gap-2">
                    <ChatIcon size={16} className="text-muted" />
                    <h3 className="ui-type-card-title text-ink">Гілка</h3>
                  </div>
                  <IconAction label="Закрити гілку" icon={X} size="md" appearance="quiet" composition="chat-panel-action" />
                </div>
              </div>
            </div>
          </SidebarLayout>
        </div>
      </PreviewBlock>

      <PreviewBlock
        title="Вихід із панелі на мобільному"
        component="MobilePaneBack"
        description="SidebarLayout показує нижче md лише одну панель, тож та панель мусить пропонувати шлях назад. Тут control видно завжди — у продукті він ховається на md і вище, де обидві панелі й так на екрані. Команда й Налаштування малювали його кожен окремо."
        filePath="src/components/ui/Navigation/MobilePaneBack.jsx"
      >
        <div className="flex flex-col gap-3 rounded-[12px] bg-white p-[16px] [&_button]:!flex">
          <MobilePaneBack label="До списку команди" onClick={() => {}} />
          <MobilePaneBack label="Всі налаштування" onClick={() => {}} />
        </div>
      </PreviewBlock>
    </div>
    </ConfirmProvider>
  );
}
