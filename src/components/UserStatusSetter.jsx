'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';

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

      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-[20px]">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-ink/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-[340px] bg-white rounded-[24px] p-[24px] shadow-2xl flex flex-col gap-[20px]"
            >
              <div className="flex items-center justify-between px-[4px]">
                <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Ваш статус</span>
                <div className="flex items-center gap-[12px]">
                  {(currentUser?.status || currentUser?.statusEmoji) && (
                    <button 
                      onClick={() => handleUpdate('', '')}
                      className="text-[11px] font-bold text-red-500 hover:underline uppercase"
                    >
                      Очистити
                    </button>
                  )}
                  <button onClick={() => setIsEditing(false)} className="w-[32px] h-[32px] rounded-full bg-canvas flex items-center justify-center text-muted hover:text-ink hover:bg-line">
                    <Plus size={18} className="rotate-45" />
                  </button>
                </div>
              </div>
              
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
                  <input 
                    autoFocus
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Що на думці?"
                    maxLength={35}
                    className="flex-1 h-[44px] bg-canvas border border-transparent outline-none rounded-[12px] px-[16px] text-[13px] text-ink font-medium transition-all placeholder:text-faint focus:border-[#d0d0d0]"
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdate(emoji, text)}
                  />
                  <button 
                    onClick={() => handleUpdate(emoji, text)}
                    className="h-[44px] px-[20px] bg-ink text-white rounded-[12px] font-bold text-[13px] hover:bg-black transition-all active:scale-95"
                  >
                    OK
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
