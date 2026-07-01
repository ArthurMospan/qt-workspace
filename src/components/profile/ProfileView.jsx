import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MapPin, Phone, MessageCircle, Zap, Send, MoreVertical, Shield, BarChart2 } from 'lucide-react';
import { Surface, Card, Badge, StatusBadge, Button, Tabs, ContextMenu } from '@/components/ui';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

const getRealProfileDetails = (member) => {
  const isDemo = member.email === 'demo@quickteam.com' || member.email?.startsWith('demo');
  if (isDemo && !member.bio && !member.profile?.bio) {
    return {
      bio: 'Я продукт-менеджер з понад 5 роками досвіду в управлінні B2B SaaS продуктами. Завжди відкритий до нових ідей та спілкування.',
      skills: ['Product Management', 'Agile', 'Scrum', 'UX/UI', 'Roadmapping'],
      telegram: '@demo_pm',
      phone: '+38 (050) 123-45-67',
      location: 'Київ, Україна',
      timezone: 'Europe/Kyiv'
    };
  }

  const skills = member.profile?.skills || member.skills;
  return {
    bio:      member.profile?.bio      || member.bio      || null,
    skills:   Array.isArray(skills) && skills.length ? skills : null,
    telegram: member.profile?.telegram || member.telegram || null,
    phone:    member.profile?.phone    || member.phone    || null,
    location: member.profile?.location || member.location || null,
    timezone: member.profile?.timezone || member.timezone || member.localization?.timezone || null,
  };
};

export default function ProfileView({ user, onClose }) {
  const router = useRouter();
  const { currentUser, projects } = useAppContext();
  const { tasks } = useAllMyTasks(user?.id || user?.uid);
  const { positions = [] } = useWorkflowConfig();
  const [activeTab, setActiveTab] = useState('profile');

  if (!user) return null;

  const uid = user.id || user.uid;
  const isMe = uid === (currentUser?.id || currentUser?.uid);
  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  
  const isOnline = user.lastActive && (Date.now() - new Date(user.lastActive).getTime() < 120000);
  const details = getRealProfileDetails(user);

  const positionName = positions.find(p => p.id === user.positionId)?.label || user.positionId || user.title || user.email;

  const allActiveTasks = tasks.filter(t => t.assigneeIds?.includes(uid) && t.status !== 'done' && t.status !== 'cancelled');

  const handleTaskClick = (task) => {
    if (onClose) onClose();
    router.push(`/workspace/${task.projectId}?issue=${task.issueKey || task.id}`);
  };

  const handleEmergencyCall = async () => {
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const emergencyText = `🆘 ЕКСТРЕННИЙ ВИКЛИК від ${currentUser?.name || 'Учасника'}!`;
      const link = `/workspace/chat?user=${currentUser?.id || currentUser?.uid}`;
      
      await addDoc(collection(db, 'notifications'), {
        userId: uid,
        type: 'alert',
        text: emergencyText,
        createdAt: new Date(),
        read: false,
        link
      });
      
      if (typeof Audio !== 'undefined') {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
        audio.volume = 0.2;
        audio.play().catch(() => {});
      }

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            type: 'emergency',
            title: '🆘 ЕКСТРЕННИЙ ВИКЛИК',
            body: `Вас терміново викликає ${currentUser?.name || 'Учасник'}. Зайдіть у додаток!`,
            link: `${window.location.origin}${link}`,
            userName: currentUser?.name || 'Учасник'
          })
        });
      } catch (err) {
        console.error('Email failed to send', err);
      }

      useWorkspaceStore.getState().showToast(`Виклик надіслано ${user.name || 'користувачу'}`, 'success');
      if (onClose) onClose();
    } catch (e) {
      console.error(e);
      useWorkspaceStore.getState().showToast('Помилка при надсиланні виклику', 'error');
    }
  };

  const tabsConfig = [
    { id: 'profile', label: 'Профіль' },
    { id: 'tasks', label: `Задачі (${allActiveTasks.length})` }
  ];

  const adminMenu = [
    { label: 'Керування доступом', icon: Shield, onClick: () => { if(onClose) onClose(); router.push(`/workspace/settings?section=team&user=${uid}`); } },
    { label: 'Аналітика учасника', icon: BarChart2, onClick: () => { if(onClose) onClose(); router.push(`/workspace/analytics?tab=workload&member=${uid}`); } }
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* HEADER SECTION */}
      <div className="shrink-0 pt-8 pb-4 flex flex-col items-center">
        <div className="flex flex-col items-center text-center px-8">
          <div className="relative mb-2">
            <UserAvatar user={user} size={100} className="text-[32px] shadow-sm" />
            {isOnline && (
              <div className="absolute bottom-1 right-1 w-5 h-5 bg-[#10b981] rounded-full ring-4 ring-white" />
            )}
            {(user.status || user.statusEmoji) && (
              <div className="absolute top-[-20px] left-[65%] bg-white border border-[#f0f0f0] rounded-[18px] px-[12px] py-[8px] shadow-lg flex items-center gap-[6px] z-20 max-w-[180px] min-w-[50px]">
                <span className="text-[18px] shrink-0">{user.statusEmoji}</span>
                {user.status && (
                  <span className="text-[13px] font-normal text-[#1f1f1f] tracking-tight truncate">
                    {user.status}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-1 text-center items-center">
            <h2 className="text-[24px] font-black text-[#1f1f1f]">{user.name || user.email} {isMe && <span className="text-[#9a9a9a] font-normal text-[18px]">(ти)</span>}</h2>
            <p className="text-[14px] text-[#9a9a9a] font-medium">
              {positionName}
            </p>
          </div>

          {/* Actions */}
          {!isMe && (
            <div className="flex items-center gap-2 mt-4">
              <Button
                onClick={() => {
                  if (onClose) onClose();
                  router.push(`/workspace/chat?user=${uid}`);
                }}
                style="secondary"
                color="dark"
                size="lg"
                icon={MessageCircle}
              >
                Написати
              </Button>
              <Button
                onClick={handleEmergencyCall}
                style="outline"
                color="red"
                size="lg"
                icon={Zap}
                className="!bg-red-50 hover:!bg-red-100 !border !border-[#ef4444]"
              >
                Виклик
              </Button>
              
              {isAdminOrOwner && (
                <ContextMenu
                  trigger={
                    <Button style="secondary" color="dark" size="icon-lg" icon={MoreVertical} />
                  }
                  items={adminMenu}
                />
              )}
            </div>
          )}
        </div>

        {/* TABS */}
        <div className="mt-6 flex justify-center w-full px-8">
          <Tabs tabs={tabsConfig} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
      </div>

      {/* BODY SECTION */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 w-full max-w-[800px] mx-auto">
        
        {activeTab === 'profile' && (
          <div className="flex flex-col gap-8">
            {/* Про себе */}
            {(details.bio || isMe) && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Про себе</h3>
                {details.bio ? (
                  <p className="text-[14px] text-[#1f1f1f] leading-relaxed">
                    {details.bio}
                  </p>
                ) : (
                  <p className="text-[14px] text-[#cfcfcf] italic">
                    Додайте опис у налаштуваннях профілю.
                  </p>
                )}
              </div>
            )}

            {/* Навички */}
            {details.skills && details.skills.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Навички</h3>
                <div className="flex flex-wrap gap-2">
                  {details.skills.map(skill => (
                    <Badge key={skill} variant="gray" className="text-[13px] px-3 py-1 bg-[#f4f4f5] text-[#1f1f1f] border-transparent font-medium">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Анкета */}
            <div className="flex flex-col gap-4">
              <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Контакти</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                {/* Telegram */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0">
                    <Send size={14} className="text-[#1f1f1f]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#9a9a9a] leading-none mb-1">Telegram</span>
                    {details.telegram ? (
                      <a href={`https://t.me/${details.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#1f1f1f] hover:underline font-medium truncate leading-none">
                        {details.telegram}
                      </a>
                    ) : (
                      <span className="text-[13px] text-[#cfcfcf] leading-none">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Phone */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-[#1f1f1f]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#9a9a9a] leading-none mb-1">Телефон (Контактний номер)</span>
                    {details.phone ? (
                      <span className="text-[13px] text-[#1f1f1f] font-medium leading-none truncate">{details.phone}</span>
                    ) : (
                      <span className="text-[13px] text-[#cfcfcf] leading-none">Не вказано</span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0">
                    <MapPin size={14} className="text-[#1f1f1f]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#9a9a9a] leading-none mb-1">Локація (Місто, країна)</span>
                    {details.location ? (
                      <span className="text-[13px] text-[#1f1f1f] font-medium leading-none truncate">{details.location}</span>
                    ) : (
                      <span className="text-[13px] text-[#cfcfcf] leading-none">Не вказано</span>
                    )}
                  </div>
                </div>
                
                {/* Email */}
                <div className="flex items-center gap-3">
                  <div className="w-[32px] h-[32px] rounded-full bg-[#f4f4f5] flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-[#1f1f1f]" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-[#9a9a9a] leading-none mb-1">Email</span>
                    {user.email ? (
                      <span className="text-[13px] text-[#1f1f1f] font-medium leading-none truncate">{user.email}</span>
                    ) : (
                      <span className="text-[13px] text-[#cfcfcf] leading-none">Не вказано</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-2">
            {allActiveTasks.length === 0 ? (
              <div className="bg-[#f4f4f5] rounded-[16px] p-8 text-center border border-[#f0f0f0]">
                <p className="text-[14px] text-[#9a9a9a]">Немає активних задач</p>
              </div>
            ) : (
              allActiveTasks.map(task => {
                const projectName = projects.find(p => p.id === task.projectId)?.name || 'Проєкт';
                return (
                  <TaskRow
                    key={task.id}
                    issue={task}
                    projectId={task.projectId}
                    projectName={projectName}
                    onClick={() => handleTaskClick(task)}
                  />
                );
              })
            )}
          </div>
        )}

      </div>
    </div>
  );
}
