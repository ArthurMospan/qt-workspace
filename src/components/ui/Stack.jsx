'use client';

export default function Stack({
  direction = 'vertical', // vertical, horizontal
  gap = 'md', // xs, sm, md, lg, xl, xxl
  align = 'stretch', // stretch, start, center, end
  justify = 'start', // start, center, end, between, around
  className = '',
  children,
}) {
  const gapMap = {
    xs: 'gap-[4px]',
    sm: 'gap-[8px]',
    md: 'gap-[12px]',
    lg: 'gap-[16px]',
    xl: 'gap-[20px]',
    xxl: 'gap-[24px]',
  };

  const alignMap = {
    stretch: 'items-stretch',
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
  };

  const justifyMap = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  };

  const directionClass = direction === 'vertical' ? 'flex-col' : 'flex-row';

  return (
    <div
      className={`
        flex ${directionClass}
        ${gapMap[gap]}
        ${alignMap[align]}
        ${justifyMap[justify]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
