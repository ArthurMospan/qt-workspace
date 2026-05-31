'use client';
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = '#6366f1',
  trend,
  onClick,
  className = '',
}) {
  const content = (
    <div className={`bg-[#f4f4f5] border border-transparent rounded-[24px] p-5 transition-all duration-200 ${onClick ? 'hover:bg-[#eef0f2] cursor-pointer' : ''} ${className}`}>
      <div className="flex items-start justify-between mb-3">
        {Icon && (
          <div className="w-9 h-9 rounded-[12px] flex items-center justify-center animate-fade-in" style={{ background: color + '15' }}>
            <Icon size={16} style={{ color }} />
          </div>
        )}
        {trend !== undefined && (
          <span className={`text-[11px] font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-[#10b981]' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-[26px] font-bold text-[#1f1f1f] leading-none mb-1">{value}</p>
      <p className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[11px] text-[#cfcfcf] mt-1">{sub}</p>}
    </div>
  );

  if (onClick) {
    return <div onClick={onClick} className="group">{content}</div>;
  }
  return content;
}
