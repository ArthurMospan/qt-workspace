'use client';

// The honest mirror: what of this kit the product actually uses.
//
// Everything here is derived from kit-usage.generated.json, produced by
// scripts/scan-kit-usage.mjs and kept current by tests/kit-usage.test.mjs.
// Nothing on this screen is hand-maintained, which is the point — the previous
// showcase gave a component used in fourteen places and one used nowhere
// exactly the same prominence, so the kit slowly stopped describing the site.

import React, { useMemo, useState } from 'react';
import { Search, CheckCircle2, ChevronDown } from 'lucide-react';
import usage from './kit-usage.generated.json';

function ComponentRow({ name, entry, expanded, onToggle }) {
  return (
    <div className="rounded-[10px] border border-[#f0f0f0] bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(name)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-[10px] px-[14px] py-[10px] text-left transition-colors hover:bg-[#fafafa]"
      >
        <CheckCircle2 size={15} className={`shrink-0 ${entry.showcased ? 'text-[#10b981]' : 'text-[#ef4444]'}`} />

        <span className="text-[13px] font-bold text-[#1f1f1f] font-mono">{name}</span>

        <span className="truncate text-[11px] text-[#cfcfcf] font-mono">
          {entry.file.replace('src/components/ui/', '')}
        </span>

        <span className="ml-auto flex items-center gap-[8px] shrink-0">
          <span
            className="rounded-full bg-[#ecfdf5] px-[8px] py-[2px] text-[11px] font-bold text-[#047857]"
          >
            {entry.count} використань · {entry.showcased ? 'у каталозі' : 'НЕМАЄ В КАТАЛОЗІ'}
          </span>
          <ChevronDown
            size={14}
            className={`text-[#9a9a9a] transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {expanded && (
        <ul className="border-t border-[#f0f0f0] bg-[#fafafa] px-[14px] py-[10px] space-y-[4px]">
          {entry.usedIn.map(file => (
            <li key={file} className="text-[11px] text-[#71717a] font-mono truncate">{file}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function KitStatus() {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  const used = useMemo(() => {
    const term = query.trim().toLowerCase();
    return Object.entries(usage.components)
      .filter(([name, entry]) => entry.count > 0 && (!term || name.toLowerCase().includes(term)))
      .sort((a, b) => b[1].count - a[1].count);
  }, [query]);

  const toggle = name => setExpanded(current => (current === name ? null : name));
  const {
    used: usedTotal,
    covered,
    uncovered,
  } = usage.totals;

  return (
    <div className="flex flex-col gap-[24px]">
      <div>
        <h2 className="text-[22px] font-bold text-[#1f1f1f]">Стан кіту</h2>
        <p className="mt-[4px] max-w-[680px] text-[13px] text-[#9a9a9a]">
          Тут показано тільки компоненти, які продукт реально імпортує. Невикористовувані
          заготовки не є частиною каталогу й тут не відображаються.
        </p>
        <p className="mt-[6px] text-[12px] text-[#cfcfcf]">
          Оновити: <span className="font-mono text-[#71717a]">npm run kit:scan</span> · перевіряється
          тестом <span className="font-mono text-[#71717a]">tests/kit-usage.test.mjs</span>
          . Тест також падає, якщо живий компонент продукту не має preview у каталозі.
        </p>
      </div>

      <div className="flex flex-wrap gap-[12px]">
        {[
          { label: 'У продукті', value: usedTotal, color: '#10b981' },
          { label: 'Покрито каталогом', value: `${covered}/${usedTotal}`, color: uncovered ? '#ef4444' : '#10b981' },
        ].map(stat => (
          <div key={stat.label} className="rounded-[12px] border border-[#f0f0f0] bg-white px-[18px] py-[12px]">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[#9a9a9a]">{stat.label}</div>
            <div className="text-[24px] font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="relative max-w-[320px]">
        <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[#9a9a9a]" />
        <input
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Пошук компонента…"
          aria-label="Пошук компонента"
          className="h-[36px] w-full rounded-[10px] border border-transparent bg-[#f4f4f5] pl-[34px] pr-[12px] text-[13px] text-[#1f1f1f] outline-none transition-colors placeholder:text-[#cfcfcf] focus:border-[#1f1f1f]"
        />
      </div>

      <section className="flex flex-col gap-[8px]">
        <h3 className="text-[13px] font-bold text-[#1f1f1f]">
          У продукті <span className="text-[#9a9a9a]">({used.length})</span>
        </h3>
        {used.map(([name, entry]) => (
          <ComponentRow key={name} name={name} entry={entry} expanded={expanded === name} onToggle={toggle} />
        ))}
        {used.length === 0 && <p className="text-[12px] text-[#9a9a9a]">Нічого не знайдено.</p>}
      </section>

    </div>
  );
}
