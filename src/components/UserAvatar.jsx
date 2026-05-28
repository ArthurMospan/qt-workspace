'use client';
// src/components/UserAvatar.jsx — Fixed: uses size prop, supports avatar/photoURL
export default function UserAvatar({ user, size = 32, className = '' }) {
  if (!user) return (
    <div style={{ width: size, height: size, minWidth: size }} aria-hidden="true"
      className={`rounded-full bg-[#e9e9e9] flex items-center justify-center shrink-0 ${className}`}>
      <span style={{ fontSize: size * 0.38 }} className="font-bold text-[#9a9a9a]">?</span>
    </div>
  );

  const avatarUrl = user.avatar || user.photoURL;
  const name = user.name || user.email || '?';
  const initials = name.charAt(0).toUpperCase();

  // Deterministic dark color from name
  const colors = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777'];
  const colorIdx = name.charCodeAt(0) % colors.length;
  const bg = colors[colorIdx];

  return (
    <div style={{ width: size, height: size, minWidth: size }} aria-hidden="true"
      className={`rounded-full overflow-hidden flex items-center justify-center shrink-0 ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          style={{ width: size, height: size }}
          className="object-cover"
        />
      ) : (
        <div style={{ width: size, height: size, background: bg }}
          className="flex items-center justify-center">
          <span style={{ fontSize: size * 0.38, lineHeight: 1 }} className="font-bold text-white">
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
