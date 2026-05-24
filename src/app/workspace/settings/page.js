'use client';
// src/app/workspace/settings/page.js — Workspace Settings
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useStore } from '@/store/useStore';
import { User, Bell, Shield, Palette, ChevronRight, Check } from 'lucide-react';

const TASK_STATUSES = [
  { id: 'todo',        label: 'Backlog',     color: '#9a9a9a', desc: 'Задачі в черзі' },
  { id: 'in-progress', label: 'В роботі',   color: '#6366f1', desc: 'Активно виконуються' },
  { id: 'review',      label: 'Перевірка',  color: '#f97316', desc: 'Очікують review' },
  { id: 'done',        label: 'Готово',     color: '#10b981', desc: 'Завершені задачі' },
];

function SettingSection({ title, children }) {
  return (
    <div className="bg-white border border-[#e9e9e9] rounded-[16px] overflow-hidden mb-4">
      <div className="px-6 py-4 border-b border-[#f0f0f0]">
        <h3 className="text-[14px] font-bold text-[#1f1f1f]">{title}</h3>
      </div>
      <div className="divide-y divide-[#f7f7f7]">{children}</div>
    </div>
  );
}

function SettingRow({ label, desc, children }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-[#1f1f1f]">{label}</p>
        {desc && <p className="text-[11px] text-[#9a9a9a] mt-[2px]">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`w-[42px] h-[24px] rounded-full transition-colors relative ${value ? 'bg-[#1f1f1f]' : 'bg-[#e9e9e9]'}`}
    >
      <span className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${value ? 'left-[21px]' : 'left-[3px]'}`} />
    </button>
  );
}

export default function SettingsPage() {
  const { currentUser } = useAppContext();
  const showToast = useStore(s => s.showToast);

  const [notifications, setNotifications] = useState({
    taskAssigned:  true,
    taskDue:       true,
    taskComment:   true,
    taskStatusChange: false,
  });

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    showToast('Налаштування збережено ✓');
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f7f7f7]">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 shrink-0">
        <h1 className="text-[#1f1f1f] text-[22px] font-bold">Налаштування</h1>
        <p className="text-[#9a9a9a] text-[13px] mt-1">Персональні налаштування воркспейсу</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8 max-w-[680px]">

        {/* Profile */}
        <SettingSection title="👤 Профіль">
          <SettingRow label="Ім'я" desc="Відображається в командних задачах">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#1f1f1f]">
              <span>{currentUser?.name}</span>
            </div>
          </SettingRow>
          <SettingRow label="Email" desc="Використовується для входу">
            <span className="text-[13px] text-[#9a9a9a]">{currentUser?.email}</span>
          </SettingRow>
          <SettingRow label="Фото" desc="Ваш аватар у команді">
            {currentUser?.photoURL
              ? <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full" />
              : <div className="w-8 h-8 rounded-full bg-[#1f1f1f] flex items-center justify-center text-white text-[11px] font-bold">
                  {currentUser?.name?.[0]}
                </div>
            }
          </SettingRow>
        </SettingSection>

        {/* Statuses info */}
        <SettingSection title="📋 Статуси задач">
          <div className="px-6 py-3">
            <p className="text-[12px] text-[#9a9a9a] mb-4">Стандартний workflow для всіх проєктів. Кастомізація по проєктах — незабаром.</p>
            <div className="flex flex-col gap-2">
              {TASK_STATUSES.map(s => (
                <div key={s.id} className="flex items-center gap-3 py-2 px-3 bg-[#f7f7f7] rounded-[10px]">
                  <span className="w-[10px] h-[10px] rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="flex-1">
                    <span className="text-[13px] font-semibold text-[#1f1f1f]">{s.label}</span>
                    <span className="text-[11px] text-[#9a9a9a] ml-3">{s.desc}</span>
                  </div>
                  <Check size={13} className="text-[#cfcfcf]" />
                </div>
              ))}
            </div>
          </div>
        </SettingSection>

        {/* Notifications */}
        <SettingSection title="🔔 Сповіщення">
          <SettingRow label="Задачу призначено мені" desc="Хтось призначив задачу на тебе">
            <Toggle value={notifications.taskAssigned} onChange={v => setNotifications(n => ({ ...n, taskAssigned: v }))} />
          </SettingRow>
          <SettingRow label="Дедлайн завтра" desc="Нагадування за 24 години до дедлайну">
            <Toggle value={notifications.taskDue} onChange={v => setNotifications(n => ({ ...n, taskDue: v }))} />
          </SettingRow>
          <SettingRow label="Новий коментар у задачі" desc="Хтось написав у чаті задачі">
            <Toggle value={notifications.taskComment} onChange={v => setNotifications(n => ({ ...n, taskComment: v }))} />
          </SettingRow>
          <SettingRow label="Зміна статусу задачі" desc="Коли змінюється статус твоєї задачі">
            <Toggle value={notifications.taskStatusChange} onChange={v => setNotifications(n => ({ ...n, taskStatusChange: v }))} />
          </SettingRow>
        </SettingSection>

        {/* Workspace info */}
        <SettingSection title="⚙️ Воркспейс">
          <SettingRow label="Назва організації" desc="QuickTeam workspace">
            <span className="text-[13px] font-semibold text-[#1f1f1f]">QuickTeam</span>
          </SettingRow>
          <SettingRow label="Organization ID" desc="Ідентифікатор для multi-tenancy">
            <code className="text-[11px] bg-[#f7f7f7] border border-[#e9e9e9] px-2 py-1 rounded-[6px] text-[#9a9a9a]">quickteam</code>
          </SettingRow>
          <SettingRow label="Клієнтський портал" desc="Інтегрований сервіс для замовників">
            <a href={process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app'}
              target="_blank" rel="noopener noreferrer"
              className="text-[12px] font-medium text-[#6366f1] hover:underline">
              Відкрити →
            </a>
          </SettingRow>
        </SettingSection>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-[13px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-bold hover:bg-[#303030] transition-all"
        >
          {saved ? '✓ Збережено' : 'Зберегти зміни'}
        </button>
      </div>
    </div>
  );
}
