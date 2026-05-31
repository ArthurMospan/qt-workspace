'use client';

import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';

function hexToRgba(hex, alpha) {
  if (!hex) return 'transparent';
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function StatusBadge({ status, className = '' }) {
  const { statuses = [] } = useWorkflowConfig();
  const s = statuses.find(st => st.id === status) || statuses[0] || { label: 'Status', color: '#9a9a9a' };

  return (
    <span 
      className={`inline-flex items-center px-[10px] py-[3px] rounded-[6px] text-[11px] font-medium backdrop-blur-[2px] ${className}`}
      style={{ 
        background: hexToRgba(s.color, 0.08), 
        color: s.color
      }}
    >
      {s.label}
    </span>
  );
}
