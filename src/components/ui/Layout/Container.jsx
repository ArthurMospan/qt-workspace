'use client';

export default function Container({
  children,
  size = 'md',
  centered = true,
  className = '',
}) {
  const sizeMap = {
    xs: 'max-w-[320px]',
    sm: 'max-w-[640px]',
    md: 'max-w-[960px]',
    lg: 'max-w-[1280px]',
    xl: 'max-w-[1536px]',
  };

  return (
    <div
      className={`
        ${sizeMap[size]}
        ${centered ? 'mx-auto' : ''}
        px-[32px]
        ${className}
      `}
    >
      {children}
    </div>
  );
}
