'use client';
import Tooltip from '@/components/ui/Navigation/Tooltip';

// src/components/UserAvatar.jsx — Fixed: uses size prop, supports avatar/photoURL
export default function UserAvatar({ user, size = 32, className = '', tooltip = false }) {
  if (!user) return (
    <div style={{ width: size, height: size, minWidth: size }} aria-hidden="true"
      className={`rounded-full bg-line flex items-center justify-center shrink-0 ${className}`}>
      <span style={{ fontSize: size * 0.38 }} className="font-bold text-muted">?</span>
    </div>
  );

  const avatarUrl = user.avatar || user.photoURL;
  const name = user.name || user.email || '?';
  const initials = name.charAt(0).toUpperCase();

  // Deterministic dark color from ID or name, with user.avatarColor support
  const colors = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];
  const avatarColor = user.avatarColor || user.color;
  
  let bg = avatarColor;
  if (!bg) {
    const hashInput = String(user.id || user.uid || name);
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      hash = hashInput.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIdx = Math.abs(hash) % colors.length;
    bg = colors[colorIdx];
  }

  const avatar = (
    <div style={{ width: size, height: size, minWidth: size }}
      className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          style={{ width: size, height: size }}
          className="object-cover"
        />
      ) : (
        <div style={{ width: size, height: size, background: bg }}
          className="flex items-center justify-center" aria-label={name}>
          <span style={{ fontSize: size * 0.38, lineHeight: 1 }} className="font-bold text-white" aria-hidden="true">
            {initials}
          </span>
        </div>
      )}
    </div>
  );

  if (!tooltip) return avatar;
  return (
    <Tooltip content={typeof tooltip === 'string' ? tooltip : name} position="top">
      {avatar}
    </Tooltip>
  );
}
