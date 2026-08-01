'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// The icon chip is deliberately not themable. Every KPI row used to pick its
// own hue, which made a set of four cards read as four unrelated widgets and
// implied a status the number alone was already carrying. One brand grey chip
// with an ink glyph keeps every analytics surface looking like one system.
/**
 * One number on an analytics screen: the figure, what it counts, and how it
 * moved.
 *
 * @param {React.ComponentType} props.icon Glyph in the grey chip. The chip is never themable — see below.
 * @param {string|number} props.value The figure itself.
 * @param {string} props.label What it counts.
 * @param {string} props.sub Smaller line under the label — the period, usually.
 * @param {number} props.trend Percent change; sign decides the arrow and the colour.
 * @param {() => void} props.onClick Makes the card a control, with the hover ring that goes with it.
 * @param {string} props.className Placement in the parent only.
 */
export default function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  onClick,
  className = '',
}) {
  const content = (
    <div className={`bg-white border border-transparent rounded-[16px] p-5 transition-all duration-200 ${onClick ? 'hover:ring-4 hover:ring-[#ECECEC] cursor-pointer' : ''} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center animate-fade-in bg-canvas">
            <Icon size={16} className="text-ink" />
          </div>
        )}
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-ink leading-none mb-1">{value}</p>
      <p className="text-[11px] font-bold text-muted uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-faint mt-1">{sub}</p>}
    </div>
  );

  // A card that leads somewhere is a control, and a `div` with an onClick is
  // not one: it takes no focus, answers no Enter, and a screen reader walks
  // straight past it. The wrapper is a real button, stripped of its own chrome
  // so the card still draws itself.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="group block w-full text-left">
        {content}
      </button>
    );
  }
  return content;
}
