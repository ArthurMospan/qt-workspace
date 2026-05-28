'use client';

export default function StatusBadge({ status, className = '' }) {
  const statuses = {
    todo: { bg: 'bg-[#efefef]', text: 'text-[#9a9a9a]', label: 'До виконання' },
    'in-progress': { bg: 'bg-[#eef2ff]', text: 'text-[#6366f1]', label: 'В процесі' },
    done: { bg: 'bg-[#ecfdf5]', text: 'text-[#10b981]', label: 'Виконано' },
    blocked: { bg: 'bg-[#fef2f2]', text: 'text-[#ef4444]', label: 'Заблокована' },
  };

  const s = statuses[status] || statuses.todo;

  return (
    <span className={`inline-flex items-center px-[10px] py-[3px] rounded-[6px] text-[11px] font-bold ${s.bg} ${s.text} ${className}`}>
      {s.label}
    </span>
  );
}
