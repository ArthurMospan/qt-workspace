'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '../Button';

export default function SplitButton({
  primaryLabel,
  primaryAction,
  items = [],
  variant = 'primary',
  style = 'primary',
  color = 'dark',
  size = 'lg',
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-flex ${className}`} ref={containerRef}>
      {/* Primary Button */}
      <Button
        style={style}
        color={color}
        size={size}
        onClick={primaryAction}
        className="rounded-r-none"
      >
        {primaryLabel}
      </Button>

      {/* Chevron Button (Dropdown Trigger) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-9 w-9 px-0 flex items-center justify-center rounded-l-none"
        style={{
          backgroundColor:
            style === 'primary'
              ? { dark: '#1f1f1f', blue: '#3b82f6', green: '#10b981' }[color] || '#1f1f1f'
              : style === 'secondary'
                ? { dark: '#f5f5f5', blue: '#dbeafe' }[color] || '#f5f5f5'
                : 'transparent',
          color: style === 'primary' ? '#ffffff' : '#1f1f1f',
          borderLeft: `1px solid ${style === 'primary' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
          cursor: 'pointer',
          transition: 'all 200ms ease-in-out',
        }}
        onMouseEnter={(e) => {
          if (style === 'primary') {
            e.target.style.backgroundColor = { dark: '#303030', blue: '#2563eb' }[color] || '#303030';
          } else if (style === 'secondary') {
            e.target.style.backgroundColor = { dark: '#e9e9e9', blue: '#bfdbfe' }[color] || '#e9e9e9';
          }
        }}
        onMouseLeave={(e) => {
          if (style === 'primary') {
            e.target.style.backgroundColor = { dark: '#1f1f1f', blue: '#3b82f6' }[color] || '#1f1f1f';
          } else if (style === 'secondary') {
            e.target.style.backgroundColor = { dark: '#f5f5f5', blue: '#dbeafe' }[color] || '#f5f5f5';
          }
        }}
      >
        <ChevronDown size={14} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && items.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 w-max min-w-[160px] bg-white border border-[#f0f0f0] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {items.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  item.action?.();
                  setIsOpen(false);
                }}
                className="w-full px-[12px] h-[36px] text-[13px] font-medium hover:bg-[#f4f4f5] transition-colors text-left text-[#1f1f1f]"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
