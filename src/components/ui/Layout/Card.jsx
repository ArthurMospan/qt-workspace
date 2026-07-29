'use client';

export default function Card({
  children,
  variant = 'white',
  preset,
  padding = 'md',
  interactive = false,
  onClick,
  className = '',
}) {
  const presetMap = {
    bordered: 'bordered-card',
    borderless: 'card',
    canvas: 'panel',
    elevated: 'elevated-card',
  };
  const resolvedPreset = preset || (variant === 'gray' ? 'canvas' : 'bordered');

  return (
    <div
      data-ui-surface={presetMap[resolvedPreset] ?? 'bordered-card'}
      data-ui-padding={padding}
      className={`
        ui-surface
        ${interactive ? 'cursor-pointer hover:bg-[#fcfcfc] hover:border-faint hover:ring-4 hover:ring-ink/5 transition-all duration-200' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
