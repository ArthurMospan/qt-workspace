'use client';
import UserAvatar from '@/components/UserAvatar';

export default function AvatarGroup({ avatars = [], maxDisplay = 4, size = 'md', className = '' }) {
  const sizeMap = { sm: 20, md: 28, lg: 36, xl: 44 };
  const avatarSize = sizeMap[size] || sizeMap.md;
  
  const displayAvatars = avatars.slice(0, maxDisplay);
  const remaining = avatars.length - maxDisplay;

  // Map sizing to tailwind space offsets
  const spaceMap = { sm: '-space-x-[5px]', md: '-space-x-[7px]', lg: '-space-x-[9px]', xl: '-space-x-[11px]' };
  const spaceClass = spaceMap[size] || spaceMap.md;

  return (
    <div className={`flex items-center ${spaceClass} ${className}`}>
      {displayAvatars.map((avatar, i) => (
        <div key={i} className="relative" style={{ zIndex: displayAvatars.length - i }}>
          <UserAvatar user={avatar} size={avatarSize} className="ring-2 ring-white" />
        </div>
      ))}
      {remaining > 0 && (
        <div
          style={{ 
            width: avatarSize, 
            height: avatarSize, 
            minWidth: avatarSize,
            fontSize: Math.max(8, avatarSize * 0.35)
          }}
          className="rounded-full bg-[#f5f5f5] text-muted border border-[#efefef] ring-2 ring-white flex items-center justify-center font-bold relative z-0"
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
