'use client';

export default function Avatar({
  src,
  initials,
  size = 'md', // sm, md, lg, xl
  className = '',
  name,
}) {
  const sizes = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-8 h-8 text-[12px]',
    lg: 'w-10 h-10 text-[13px]',
    xl: 'w-12 h-12 text-[14px]',
  };

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-ink text-white font-bold shrink-0 ${sizes[size]} ${className}`}
      title={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || 'avatar'} className="w-full h-full rounded-full object-cover" />
      ) : (
        initials || '?'
      )}
    </div>
  );
}
