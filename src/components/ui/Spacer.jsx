'use client';

export default function Spacer({
  size = 'md', // xs, sm, md, lg, xl, xxl
  direction = 'vertical', // vertical, horizontal
}) {
  const sizeMap = {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  };

  const sizeValue = sizeMap[size];

  if (direction === 'vertical') {
    return <div style={{ height: sizeValue, flexShrink: 0 }} />;
  }

  return <div style={{ width: sizeValue, flexShrink: 0 }} />;
}
