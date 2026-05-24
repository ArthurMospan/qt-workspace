'use client';
// src/components/UserAvatar.jsx — Simple avatar without qt/ store dependency
import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function UserAvatar({
  user,
  userId,
  className = '',
  showOnline = false,
  onClick,
}) {
  const id = userId || user?.id;
  const [profile, setProfile] = useState(user?.name ? user : null);

  useEffect(() => {
    if (user?.name && user?.avatar) { setProfile(user); return; }
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'users', id), (snap) => {
      if (snap.exists()) setProfile({ id, ...snap.data() });
    });
    return () => unsub();
  }, [id, user]);

  const avatarUrl = profile?.avatar;
  const name = profile?.name || 'Користувач';

  let isOnline = false;
  if (profile?.lastActive) {
    isOnline = (Date.now() - new Date(profile.lastActive).getTime()) < 75000;
  }
  if (user?.isOnline !== undefined) isOnline = user.isOnline;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} onClick={onClick}>
      <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white/10">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span className="text-[11px] font-bold text-white/60">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      {showOnline && isOnline && (
        <span className="absolute bottom-[1px] right-[1px] w-[8px] h-[8px] bg-green-500 rounded-full border-[2px] border-[#111]" />
      )}
    </div>
  );
}
