'use client';

export default function ListItem({
  avatar,
  title,
  subtitle,
  actions,
  onClick,
  height = 'default',
  divider = false,
  className = '',
}) {
  const heightMap = {
    compact: 'h-[40px]',
    default: 'h-[48px]',
    spacious: 'h-[56px]',
  };

  return (
    <div
      className={`
        flex items-center gap-[12px] px-[16px]
        ${heightMap[height]}
        ${onClick ? 'cursor-pointer hover:bg-[#f4f4f5]' : ''}
        ${divider ? 'border-b border-[#e9e9e9]' : ''}
        transition-colors duration-200
        ${className}
      `}
      onClick={onClick}
    >
      {/* Avatar */}
      {avatar && (
        <div className="flex-shrink-0">
          {avatar}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {title && (
          <div className="text-[14px] font-[600] text-[#1f1f1f] truncate">
            {title}
          </div>
        )}
        {subtitle && (
          <div className="text-[13px] font-[600] text-[#9a9a9a] truncate">
            {subtitle}
          </div>
        )}
      </div>

      {/* Actions */}
      {actions && (
        <div className="flex-shrink-0 flex items-center gap-[8px]">
          {actions}
        </div>
      )}
    </div>
  );
}
