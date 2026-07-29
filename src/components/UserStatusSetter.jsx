'use client';
import React, { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Button, Dialog, Input } from '@/components/ui';

const STATUS_PRESETS = [
  { emoji: '💻', text: 'Весь в роботі' },
  { emoji: '🔴', text: 'Зайнятий' },
  { emoji: '🚗', text: 'В дорозі' },
  { emoji: '🔥', text: 'Овертаймлю' },
  { emoji: '🌴', text: 'Вихідний' },
  { emoji: '🧠', text: 'Думаю...' },
  { emoji: '📞', text: 'На зв\'язку' },
];

const EMOJIS = ['😊', '😇', '🤔', '😎', '😴', '🤯', '🥳', '👋', '🤝', '🙌', '✨', '🏆', '🎨', '🚀'];

export default function UserStatusSetter() {
  const { currentUser } = useAppContext();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState('');
  const [emoji, setEmoji] = useState('💭');

  const handleUpdate = async (newEmoji, newText) => {
    if (!currentUser?.id) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      // UI оновиться через live-підписку useAuth на users/{uid} — мутувати currentUser не можна
      await updateDoc(doc(db, 'users', currentUser.id), {
        status: newText,
        statusEmoji: newEmoji
      });
      useWorkspaceStore.getState().showToast('Статус оновлено', 'success');
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      useWorkspaceStore.getState().showToast('Помилка оновлення статусу', 'error');
    }
  };

  const currentEmoji = currentUser?.statusEmoji || '💭';
  const currentText = currentUser?.status || 'Встановити статус';

  return (
    <>
      <button
        onClick={() => {
          setText(currentUser?.status || '');
          setEmoji(currentUser?.statusEmoji || '💭');
          setIsEditing(true);
        }}
        className="flex items-center gap-1.5 mr-1 bg-canvas px-3 py-1.5 rounded-full cursor-pointer hover:bg-[#efefef] transition-colors"
      >
        {currentUser?.status || currentUser?.statusEmoji ? (
          <>
            {currentUser.statusEmoji && <span className="text-[12px]">{currentUser.statusEmoji}</span>}
            {currentUser.status && <span className="text-[11px] font-bold text-ink max-w-[120px] truncate">{currentUser.status}</span>}
          </>
        ) : (
          <span className="text-[11px] font-bold text-muted">Встановити статус</span>
        )}
      </button>

      {isEditing && (
        <Dialog
          isOpen
          onClose={() => setIsEditing(false)}
          title="Ваш статус"
          titleContext="eyebrow"
          presentation="dialog"
          size="status"
          bodyPadding="spacious"
          headerAction={(currentUser?.status || currentUser?.statusEmoji) ? (
            <Button style="ghost" color="red" size="sm" onClick={() => handleUpdate('', '')}>
              Очистити
            </Button>
          ) : null}
        >
          <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-[8px]">
                {STATUS_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => handleUpdate(p.emoji, p.text)}
                    className="flex items-center gap-[10px] p-[10px] rounded-[12px] hover:bg-canvas transition-all text-left group"
                  >
                    <span className="text-[20px] group-hover:scale-110 transition-transform">{p.emoji}</span>
                    <span className="text-[12px] font-bold text-ink truncate">{p.text}</span>
                  </button>
                ))}
              </div>

              <div className="h-[1px] bg-[#f0f0f0]" />

              <div className="flex flex-col gap-[16px]">
                <div className="grid grid-cols-7 gap-[8px]">
                  {EMOJIS.map(e => (
                    <button 
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`w-[36px] h-[36px] rounded-full flex items-center justify-center text-[18px] transition-all ${emoji === e ? 'bg-canvas scale-110 shadow-sm' : 'hover:bg-[#fcfcfc]'}`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex gap-[8px]">
                  <Input
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Що на думці?"
                    maxLength={35}
                    composition="status-entry"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(emoji, text)}
                  />
                  <Button
                    onClick={() => handleUpdate(emoji, text)}
                    composition="status-submit"
                  >
                    OK
                  </Button>
                </div>
              </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
