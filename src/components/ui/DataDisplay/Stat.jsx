'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function Stat({ number, label, trend, trendValue, icon: Icon, className = '' }) {
  const getTrendColor = (direction) => {
    if (direction === 'up') return 'text-[#10b981]';
    if (direction === 'down') return 'text-[#ef4444]';
    return 'text-muted';
  };

  const getTrendIcon = (direction) => {
    if (direction === 'up') return TrendingUp;
    if (direction === 'down') return TrendingDown;
    return Minus;
  };

  const TrendIcon = getTrendIcon(trend);

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <div className="flex items-center gap-[8px] mb-[4px]">
        {Icon && <Icon size={16} className="text-muted" />}
        <span className="text-[14px] font-bold text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-[8px]">
        <span className="text-[28px] font-bold text-ink">{number}</span>
        {trend && trendValue && (
          <span className={`text-[13px] font-bold flex items-center gap-[4px] ${getTrendColor(trend)}`}>
            <TrendIcon size={14} />
            {trendValue}%
          </span>
        )}
      </div>
    </div>
  );
}
