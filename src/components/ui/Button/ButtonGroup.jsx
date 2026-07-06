'use client';
import React from 'react';

export default function ButtonGroup({
  children,
  orientation = 'horizontal',
  className = '',
}) {
  const isVertical = orientation === 'vertical';
  const arrayChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <div className={`inline-flex ${isVertical ? 'flex-col' : 'flex-row'} ${className}`}>
      {arrayChildren.map((child, index) => {
        if (!React.isValidElement(child)) return child;

        const isFirst = index === 0;
        const isLast = index === arrayChildren.length - 1;

        let roundedClasses = '';
        if (arrayChildren.length === 1) {
          roundedClasses = '!rounded-[10px]';
        } else if (isVertical) {
          if (isFirst) {
            roundedClasses = '!rounded-t-[10px] !rounded-b-none';
          } else if (isLast) {
            roundedClasses = '!rounded-b-[10px] !rounded-t-none';
          } else {
            roundedClasses = '!rounded-none';
          }
        } else {
          if (isFirst) {
            roundedClasses = '!rounded-l-[10px] !rounded-r-none';
          } else if (isLast) {
            roundedClasses = '!rounded-r-[10px] !rounded-l-none';
          } else {
            roundedClasses = '!rounded-none';
          }
        }

        const buttonStyle = child.props.style || 'primary';
        const dividerClass = !isFirst
          ? isVertical
            ? buttonStyle === 'secondary'
              ? 'border-t border-line'
              : 'border-t border-ink-hover'
            : buttonStyle === 'secondary'
              ? 'border-l border-line'
              : 'border-l border-ink-hover'
          : '';

        return React.cloneElement(child, {
          className: `${roundedClasses} ${dividerClass} ${child.props.className || ''}`,
        });
      })}
    </div>
  );
}
