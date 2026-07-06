'use client';

export default function Card({
  children,
  variant = 'white',
  padding = 'md',
  interactive = false,
  onClick,
  className = '',
}) {
  const variantMap = {
    white: 'bg-surface border border-line',
    gray: 'bg-canvas',
  };

  const paddingMap = {
    sm: 'p-[12px]',
    md: 'p-[16px]',
    lg: 'p-[20px]',
    xl: 'p-[24px]',
  };

  return (
    <div
      className={`
        rounded-[16px]
        ${variantMap[variant]}
        ${paddingMap[padding]}
        ${interactive ? 'cursor-pointer hover:bg-[#fcfcfc] hover:border-faint hover:ring-4 hover:ring-ink/5 transition-all duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
