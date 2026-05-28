'use client';

export default function ButtonGroup({
  children,
  orientation = 'horizontal',
  className = '',
}) {
  const isVertical = orientation === 'vertical';

  return (
    <div
      className={`flex ${isVertical ? 'flex-col' : 'flex-row'} ${className}`}
      style={{ gap: 0 }}
    >
      {children}
    </div>
  );
}
