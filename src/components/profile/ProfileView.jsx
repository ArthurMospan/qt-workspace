import React from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MapPin, Phone, MessageCircle, Zap, Send } from 'lucide-react';
import { Surface, Card, Badge, StatusBadge, Button } from '@/components/ui';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import TaskRow from '@/components/ui/TaskManagement/TaskRow';
import UserAvatar from '@/components/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import { useAllMyTasks } from '@/lib/hooks/useAllMyTasks';

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

  if (!user) return null;

  const uid = user.id || user.uid;
  const isMe = uid === (currentUser?.id || currentUser?.uid);
  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.role === 'owner';
  
  const isOnline = user.lastActive && (Date.now() - new Date(user.lastActive).getTime() < 120000);
  const details = getRealProfileDetails(user);

  // Filter user tasks (max 5, not done/cancelled)
  const userTasks = tasks
    .filter(t => t.assigneeIds?.includes(uid) && t.status !== 'done' && t.status !== 'cancelled')
    .slice(0, 5);

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

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* HERO SECTION */}
      <div className="px-8 py-10 flex flex-col items-center text-center gap-4 shrink-0">
        <div className="relative mb-[12px]">
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
          <h2 className="text-[24px] font-black text-[#1f1f1f]">{user.name || user.email} {isMe && '(ти)'}</h2>
          <p className="text-[14px] text-[#9a9a9a] font-medium">
            {user.positionId ? user.positionId : (user.title || user.email)}
          </p>
        </div>

        {/* Actions */}
        {!isMe && (
          <div className="flex gap-[12px] w-full px-[8px] mt-[4px]">
            <button
              onClick={() => {
                if (onClose) onClose();
                router.push(`/workspace/chat?user=${uid}`);
              }}
              className="h-[56px] flex-1 bg-white border-2 border-[#f0f0f0] rounded-[20px] flex items-center justify-center gap-[10px] text-[15px] font-bold text-[#1f1f1f] hover:bg-[#f7f7f7] hover:border-[#e0e0e0] transition-all active:scale-95"
            >
              <MessageCircle size={18} /> Написати
            </button>
            <button
              onClick={handleEmergencyCall}
              className="h-[56px] flex-1 bg-[#fff1f1] border-2 border-[#ffe0e0] rounded-[20px] flex items-center justify-center gap-[10px] text-[15px] font-bold text-red-500 hover:bg-[#ffeded] hover:border-[#ffdada] transition-all active:scale-95"
            >
              <Zap size={18} /> Виклик
            </button>
          </div>
        )}
      </div>

      {/* BODY SECTION */}
      <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 max-w-[800px] w-full mx-auto">
        
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

        {/* Info Blocks */}
        <div className="flex flex-col gap-4 bg-[#f4f4f5] rounded-[16px] p-[20px]">
          <h3 className="text-[13px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2">Анкета учасника</h3>
          
          <div className="flex flex-col gap-4">
            {/* Telegram */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#9a9a9a]">Telegram</label>
              {details.telegram ? (
                <a href={`https://t.me/${details.telegram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-[14px] text-[#1f1f1f] hover:underline font-medium flex items-center gap-2">
                  <Send size={16} className="text-[#24A1DE]" /> {details.telegram}
                </a>
              ) : (
                <span className="text-[14px] text-[#cfcfcf]">Не вказано</span>
              )}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#9a9a9a]">Телефон (Контактний номер)</label>
              {details.phone ? (
                <span className="text-[14px] text-[#1f1f1f] font-medium flex items-center gap-2">
                  <Phone size={16} className="text-[#6366f1]" /> {details.phone}
                </span>
              ) : (
                <span className="text-[14px] text-[#cfcfcf]">Не вказано</span>
              )}
            </div>

            {/* Location */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#9a9a9a]">Локація (Місто, країна)</label>
              {details.location ? (
                <span className="text-[14px] text-[#1f1f1f] font-medium flex items-center gap-2">
                  <MapPin size={16} className="text-[#f97316]" /> {details.location}
                </span>
              ) : (
                <span className="text-[14px] text-[#cfcfcf]">Не вказано</span>
              )}
            </div>
            
            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-bold text-[#9a9a9a]">Email</label>
              {user.email ? (
                <span className="text-[14px] text-[#1f1f1f] font-medium flex items-center gap-2">
                  <Mail size={16} className="text-[#eab308]" /> {user.email}
                </span>
              ) : (
                <span className="text-[14px] text-[#cfcfcf]">Не вказано</span>
              )}
            </div>
          </div>
        </div>

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

        {/* Активні задачі */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Активні задачі</h3>
            {userTasks.length > 0 && (
              <Button style="ghost" size="sm" onClick={() => {
                if (onClose) onClose();
                router.push(`/workspace/my?assignee=${uid}`);
              }}>
                Всі задачі {user.name?.split(' ')[0]}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {userTasks.length === 0 ? (
              <p className="text-[14px] text-[#9a9a9a] py-2">Немає активних задач</p>
            ) : (
              userTasks.map(task => {
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
        </div>

        {/* Адміністрування */}
        {isAdminOrOwner && !isMe && (
          <div className="flex flex-col gap-3">
            <h3 className="text-[12px] font-bold text-[#9a9a9a] uppercase tracking-wider">Адміністрування</h3>
            <div className="flex items-center gap-2">
              <Button style="secondary" color="gray" onClick={() => {
                if (onClose) onClose();
                router.push(`/workspace/settings?section=team&user=${uid}`);
              }}>
                Керування доступом
              </Button>
              <Button style="secondary" color="gray" onClick={() => {
                if (onClose) onClose();
                router.push(`/workspace/analytics?member=${uid}`);
              }}>
                Аналітика учасника
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
