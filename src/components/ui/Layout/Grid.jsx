'use client';

export default function Grid({
  children,
  cols = 'auto',
  gap = 'md',
  className = '',
}) {
  const colsMap = {
    auto: 'grid-cols-[repeat(auto-fit,minmax(200px,1fr))]',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    6: 'grid-cols-6',
  };

  const gapMap = {
    sm: 'gap-[8px]',
    md: 'gap-[16px]',
    lg: 'gap-[24px]',
  };

  return (
    <div
      className={`
        grid
        ${colsMap[cols]}
        ${gapMap[gap]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
