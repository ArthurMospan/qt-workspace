'use client';
import UserAvatar from '@/components/UserAvatar';

export default function AvatarGroup({ avatars = [], maxDisplay = 4, size = 'md', className = '' }) {
  const sizeMap = { sm: 28, md: 32, lg: 40, xl: 48 };
  const avatarSize = sizeMap[size] || sizeMap.md;
  const overlapOffset = 8; // px margin overlap

  const displayAvatars = avatars.slice(0, maxDisplay);
  const remaining = avatars.length - maxDisplay;

  return (
    <div className={`flex items-center ${className}`} style={{ gap: `-${overlapOffset}px` }}>
      {displayAvatars.map((avatar, i) => (
        <div key={i} className="relative" style={{ zIndex: displayAvatars.length - i }}>
          <UserAvatar user={avatar} size={avatarSize} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          style={{ width: avatarSize, height: avatarSize, minWidth: avatarSize }}
          className="rounded-full bg-[#e9e9e9] flex items-center justify-center text-[#9a9a9a] font-bold text-[11px]"
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
