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
    white: 'bg-[#ffffff] border border-[#e9e9e9]',
    gray: 'bg-[#f7f7f7]',
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
        ${interactive ? 'cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)] transition-shadow duration-200' : 'shadow-[0_1px_4px_rgba(0,0,0,0.04)]'}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
