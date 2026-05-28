'use client';

export default function Surface({
  variant = 'card', // card, panel, light
  padding = 'md', // xs, sm, md, lg, xl, xxl
  className = '',
  children,
}) {
  const variantClasses = {
    card: 'bg-white border border-[#e9e9e9] rounded-[12px] shadow-[0_1px_4px_rgba(0,0,0,0.04)]',
    panel: 'bg-[#f7f7f7] rounded-[16px]',
    light: 'bg-[#f7f7f7] rounded-[12px]',
  };

  const paddingMap = {
    xs: 'p-[8px]',
    sm: 'p-[12px]',
    md: 'p-[16px]',
    lg: 'p-[20px]',
    xl: 'p-[24px]',
    xxl: 'p-[32px]',
  };

  return (
    <div
      className={`
        ${variantClasses[variant]}
        ${paddingMap[padding]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
