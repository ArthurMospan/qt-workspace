'use client';

// src/app/workspace/team/page.js
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { useMemberAnalytics } from '@/lib/hooks/useMemberAnalytics';
import { useRouter } from 'next/navigation';
import {
  UserPlus, Crown, Shield, User, Trash2, Mail, Clock, Plus,
  X, MessageSquare, Activity, Target, CheckCircle2, FileText
} from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';
import { 
  Select, 
  Button, 
  Dialog, 
  Badge, 
  Input, 
  Surface, 
  LoadingSpinner, 
  PageHeader, 
  Card,
  FormGroup,
  SidebarLayout,
  EmptyState,
  SearchInput
} from '@/components/ui';

const NOW = Date.now();

const ROLES = {
  owner:  { label: 'Власник',      color: '#8b5cf6', icon: Crown },
  admin:  { label: 'Адміністратор', color: '#f97316', icon: Shield },
  member: { label: 'Учасник',       color: '#3b82f6', icon: User },
  client: { label: 'Клієнт',        color: '#06b6d4', icon: User },
};

function RoleBadge({ role }) {
  const cfg = ROLES[role] || ROLES.member;
  const Icon = cfg.icon;
  const variantMap = {
    owner: 'info',
    admin: 'warning',
    member: 'default',
    client: 'default',
  };
  const variant = variantMap[role] || 'default';

  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon size={10} />{cfg.label}
    </Badge>
  );
}

function formatLastActive(iso) {
  if (!iso) return 'Ніколи';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Зараз онлайн';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

// ── Real Profile Details (from Firestore users/{uid}) ───────────────────────
// Fields: bio, skills[], telegram, phone, location, timezone
// Can be set in Settings → Особистий профіль
const getRealProfileDetails = (member) => ({
  bio:      member.bio      || null,
  skills:   Array.isArray(member.skills) && member.skills.length ? member.skills : null,
  telegram: member.telegram || null,
  phone:    member.phone    || null,
  location: member.location || null,
  timezone: member.timezone || member.localization?.timezone || null,
});

// ── Member Profile Panel (Right main area) ──────────────────────────────────
function MemberProfilePanel({ uid, onClose, isAdmin, canManage, currentUser, projects, members, changeMemberRole, removeMember, setMemberRate, positions = [], setMemberPosition }) {
  const router = useRouter();
  const showToast = useWorkspaceStore(s => s.showToast);
  const member = members.find(m => (m.id || m.uid) === uid);
  const [activeTab, setActiveTab] = useState('profile');
  
  const stats = useMemberAnalytics(uid);
  const details = member ? getRealProfileDetails(member) : null;
  
  const memberProjects = projects.filter(p => p.team?.includes(uid));
  const activeProjects = memberProjects.filter(p => p.status !== 'archived').length;
  
  if (!member) return null;
  
  const isMe = uid === (currentUser?.id || currentUser?.uid);
  const isOnline = member.lastActive && (NOW - new Date(member.lastActive).getTime() < 120000);

  const handleRoleChange = async (role) => {
    try {
      await changeMemberRole(uid, role);
      showToast('Роль змінено ✓');
    } catch {
      showToast('Помилка', 'error');
    }
  };

  const handleRemove = async () => {
    if (!confirm('Видалити учасника з команди?')) return;
    try {
      await removeMember(uid);
      showToast('Учасника видалено');
      onClose();
    } catch {
      showToast('Помилка видалення', 'error');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Анкета' },
    { id: 'analytics', label: 'Аналітика' },
  ];
  if (isAdmin) {
    tabs.push({ id: 'access', label: 'Доступ' });
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <PageHeader
        variant="alt"
        title={member.name || member.email}
        className="border-none"
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        actions={
          <div className="flex items-center gap-2">
            <RoleBadge role={member.role} />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f4f4f5] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col gap-6 max-w-[640px] w-full mx-auto pb-[100px]">
        
        {/* Main Info */}
        <div className="flex flex-col items-center text-center gap-3 mb-2">
          <div className="relative shrink-0">
            <UserAvatar user={member} size={80} className="text-[28px]" />
            {isOnline && (
              <span className="absolute bottom-2 right-2 w-[16px] h-[16px] bg-[#10b981] rounded-full ring-4 ring-white" />
            )}
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-[#1f1f1f] mb-1">{member.name || member.email} {isMe && '(ти)'}</h2>
            <p className="text-[13px] text-[#9a9a9a]">{member.email}</p>
          </div>

          {!isMe && (
            <div className="mt-2 w-full max-w-[240px]">
              <Button onClick={() => router.push(`/workspace/chat?dm=${uid}`)} style="primary" color="blue" size="md" className="w-full" icon={MessageSquare}>
                Написати повідомлення
              </Button>
            </div>
          )}
        </div>

        {/* Tab content */}
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-6">
            {/* Bio */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Про себе</h3>
              {details.bio ? (
                <p className="text-[13px] text-[#1f1f1f] leading-relaxed bg-[#f4f4f5] p-4 rounded-[12px]">
                  {details.bio}
                </p>
              ) : (
                <p className="text-[13px] text-[#9a9a9a] italic bg-[#f4f4f5] p-4 rounded-[12px]">
                  {isMe ? 'Розкажіть про себе в Налаштуваннях → Особистий профіль' : 'Не вказано'}
                </p>
              )}
            </div>

            {/* Skills */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Навички та компетенції</h3>
              {details.skills ? (
                <div className="flex flex-wrap gap-1.5">
                  {details.skills.map(skill => (
                    <Badge key={skill} variant="default" className="px-2.5 py-1 text-[12px] bg-[#f4f4f5] hover:bg-[#e9e9e9] text-[#1f1f1f] font-semibold border-none">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#9a9a9a] italic">
                  {isMe ? 'Додайте навички в Налаштуваннях' : 'Не вказано'}
                </p>
              )}
            </div>

            {/* Contact & Info */}
            <div className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider">Контактна інформація</h3>
              <div className="flex flex-col gap-3 bg-[#f4f4f5] p-4 rounded-[12px] text-[13px]">
                <div className="flex justify-between items-center">
                  <span className="text-[#9a9a9a]">Локація</span>
                  <span className={`font-semibold ${details.location ? 'text-[#1f1f1f]' : 'text-[#cfcfcf] italic'}`}>
                    {details.location || 'Не вказано'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9a9a9a]">Часовий пояс</span>
                  <span className={`font-semibold ${details.timezone ? 'text-[#1f1f1f]' : 'text-[#cfcfcf] italic'}`}>
                    {details.timezone || 'Не вказано'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9a9a9a]">Telegram</span>
                  {details.telegram ? (
                    <a
                      href={`https://t.me/${details.telegram.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#6366f1] hover:underline"
                    >
                      {details.telegram}
                    </a>
                  ) : (
                    <span className="font-semibold text-[#cfcfcf] italic">Не вказано</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#9a9a9a]">Телефон</span>
                  <span className={`font-semibold ${details.phone ? 'text-[#1f1f1f]' : 'text-[#cfcfcf] italic'}`}>
                    {details.phone || 'Не вказано'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Показники роботи</h3>
            
            {stats.loading ? (
               <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#f4f4f5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#6366f1] mb-1.5">
                    <Target size={14} />
                    <span className="text-[11px] font-bold">Проєкти</span>
                  </div>
                  <p className="text-[24px] font-black text-[#1f1f1f] leading-none">{activeProjects}</p>
                </div>
                <div className="bg-[#f4f4f5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#10b981] mb-1.5">
                    <CheckCircle2 size={14} />
                    <span className="text-[11px] font-bold">Задачі</span>
                  </div>
                  <p className="text-[24px] font-black text-[#1f1f1f] leading-none">{stats.tasksDone}</p>
                </div>
                <div className="bg-[#f4f4f5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#f97316] mb-1.5">
                    <MessageSquare size={14} />
                    <span className="text-[11px] font-bold">Повідомлення</span>
                  </div>
                  <p className="text-[24px] font-black text-[#1f1f1f] leading-none">{stats.messages || 0}</p>
                </div>
                <div className="bg-[#f4f4f5] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#0891b2] mb-1.5">
                    <FileText size={14} />
                    <span className="text-[11px] font-bold">Файли</span>
                  </div>
                  <p className="text-[24px] font-black text-[#1f1f1f] leading-none">{stats.files || 0}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'access' && isAdmin && (
          <div className="flex flex-col gap-5">
            <h3 className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Налаштування доступу</h3>
            
            <FormGroup label="Посада">
              <Select
                value={member.positionId || ''}
                onChange={async val => {
                  try {
                    await setMemberPosition(uid, val);
                    showToast('Посаду оновлено ✓');
                  } catch {
                    showToast('Помилка', 'error');
                  }
                }}
                options={[
                  { value: '', label: 'Без посади' },
                  ...positions.map(p => ({ value: p.id, label: p.label }))
                ]}
              />
            </FormGroup>

            <FormGroup label="Погодинна ставка (USD)">
              <Input
                type="number" min="0" step="1"
                value={member.hourlyRate || 0}
                onChange={async e => {
                  try {
                    await setMemberRate(uid, e.target.value);
                    showToast('Ставку оновлено');
                  } catch {
                    showToast('Помилка оновлення', 'error');
                  }
                }}
              />
            </FormGroup>
            
            {canManage && (
              <>
                <FormGroup label="Глобальна роль">
                  <Select
                    value={member.role}
                    onChange={val => handleRoleChange(val)}
                    options={[
                      { value: 'member', label: 'Учасник' },
                      { value: 'admin', label: 'Адміністратор' },
                      { value: 'client', label: 'Клієнт' }
                    ]}
                  />
                </FormGroup>

                <div className="pt-4 mt-2">
                  <Button onClick={handleRemove} style="secondary" color="red" size="md" className="w-full border-none" icon={Trash2}>
                    Видалити з команди
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Invite Modal ─────────────────────────────────────────────────────────────
function InviteModal({ isOpen, onClose, inviteMember, currentUser }) {
  const showToast = useWorkspaceStore(s => s.showToast);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole,  setInviteRole]  = useState('member');
  const [inviting,    setInviting]    = useState(false);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const result = await inviteMember(
        inviteEmail.trim().toLowerCase(),
        currentUser?.id || currentUser?.uid,
        inviteRole,
      );
      if (result.type === 'added_directly') {
        showToast('Учасника додано до команди ✓');
      } else {
        showToast('Запрошення відправлено ✓');
      }
      setInviteEmail('');
      setInviteRole('member');
      onClose();
    } catch (err) {
      showToast(err.message || 'Помилка', 'error');
    } finally {
      setInviting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Запросити учасника" size="md">
      <form onSubmit={handleInvite} className="flex flex-col gap-5">
        <FormGroup label="Email адреса" required>
          <Input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="name@company.com"
            icon={Mail}
          />
        </FormGroup>
        <FormGroup label="Роль в команді">
          <Select
            value={inviteRole}
            onChange={val => setInviteRole(val)}
            options={[
              { value: 'member', label: 'Учасник (Member)' },
              { value: 'admin', label: 'Адміністратор (Admin)' },
              { value: 'client', label: 'Клієнт (Client)' }
            ]}
          />
        </FormGroup>
        <Surface variant="light" padding="md" className="text-[11px] text-[#9a9a9a]">
          <span className="font-bold text-[#1f1f1f]">Примітка:</span> Якщо користувач вже зареєстрований — він одразу додається. Якщо ні — отримає запрошення при вході.
        </Surface>
        <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-[#f0f0f0]">
          <Button type="button" onClick={onClose} style="secondary" color="dark" size="md">Скасувати</Button>
          <Button type="submit" disabled={inviting || !inviteEmail.trim()} loading={inviting} style="primary" color="dark" size="md" icon={UserPlus}>Надіслати запрошення</Button>
        </div>
      </form>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function TeamPage() {
  const { currentUser, projects, orgRole } = useAppContext();
  const { members, loading, inviteMember, changeMemberRole, removeMember, setMemberRate, setMemberPosition } = useOrganization();
  const { positions = [] } = useWorkflowConfig();
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState(null);

  const isOwner = orgRole === 'owner';
  const isAdmin = orgRole === 'owner' || orgRole === 'admin';

  const filteredMembers = members.filter(m =>
    (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden bg-transparent">
      {/* Sidebar Header */}
      <div className="p-4 flex items-center justify-between shrink-0 bg-transparent">
        <h2 className="text-[16px] font-black text-[#1f1f1f]">Команда</h2>
        {isAdmin && (
          <Button 
            onClick={() => setShowInviteModal(true)} 
            style="primary" 
            color="dark" 
            size="sm" 
            icon={Plus}
          >
            Запросити
          </Button>
        )}
      </div>

      {/* Search Bar */}
      <div className="p-3 bg-transparent shrink-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Пошук..."
        />
      </div>

      {/* Scrollable Members List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-8 text-[12px] text-[#9a9a9a]">
            Нікого не знайдено
          </div>
        ) : (
          filteredMembers.map(member => {
            const uid = member.id || member.uid;
            const isMe = uid === (currentUser?.id || currentUser?.uid);
            const isOnline = member.lastActive && (NOW - new Date(member.lastActive).getTime() < 120000);
            const isSelected = selectedUid === uid;

            return (
              <Card
                key={uid}
                variant={isSelected ? 'white' : 'gray'}
                interactive={true}
                onClick={() => setSelectedUid(uid)}
                className={`flex items-center justify-between gap-3 transition-all duration-200 p-[12px] ${
                  isSelected ? 'ring-1 ring-[#1f1f1f]/20 bg-white shadow-sm' : 'bg-transparent border-transparent'
                }`}
              >
                <div className="flex items-center gap-[10px] min-w-0 flex-1">
                  <div className="relative shrink-0">
                    <UserAvatar user={member} size={36} />
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-[9px] h-[9px] bg-[#10b981] rounded-full ring-2 ring-[#f4f4f5]" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h4 className="text-[13px] font-bold text-[#1f1f1f] truncate">
                      {member.name || member.email}
                      {isMe && <span className="text-[10px] text-[#9a9a9a] font-normal ml-1">(ти)</span>}
                    </h4>
                    <p className="text-[11px] text-[#9a9a9a] truncate">{member.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <RoleBadge role={member.role} />
                  {member.positionId && (
                    <span className="text-[10px] text-[#9a9a9a] bg-white/60 px-1.5 py-0.5 rounded border border-[#e9e9e9] font-medium">
                      {positions.find(p => p.id === member.positionId)?.label || 'Посада'}
                    </span>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      <SidebarLayout
        className="pt-[56px]"
        sidebarWidth="280px"
        sidebar={sidebarContent}
      >
        {selectedUid ? (
          <MemberProfilePanel
            uid={selectedUid}
            onClose={() => setSelectedUid(null)}
            isAdmin={isAdmin}
            canManage={isAdmin && selectedUid !== (currentUser?.id || currentUser?.uid) && members.find(m => (m.id || m.uid) === selectedUid)?.role !== 'owner'}
            currentUser={currentUser}
            projects={projects}
            members={members}
            changeMemberRole={changeMemberRole}
            removeMember={removeMember}
            setMemberRate={setMemberRate}
            positions={positions}
            setMemberPosition={setMemberPosition}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-white h-full">
            <EmptyState
              icon={User}
              title="Оберіть учасника"
              description="Виберіть когось зі списку ліворуч, щоб переглянути його профіль, аналітику та налаштування доступу."
            />
          </div>
        )}
      </SidebarLayout>

      {/* Modals */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        inviteMember={inviteMember}
        currentUser={currentUser}
      />
    </>
  );
}

