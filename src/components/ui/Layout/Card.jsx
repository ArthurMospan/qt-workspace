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
    gray: 'bg-[#f4f4f5]',
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
        ${interactive ? 'cursor-pointer hover:bg-[#fcfcfc] hover:border-[#cfcfcf] hover:ring-4 hover:ring-[#1f1f1f]/5 transition-all duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
