'use client';

import React from 'react';

// ─── UI Kit: Chat Search Banner ──────────────────────────────────────────────
// The amber strip that says how many messages matched, with the way to drop the
// filter.
//
// Its «Очистити» was the only amber text button in the product. Rather than
// give the shared `TextAction` a one-off amber tone that nothing else would
// ever ask for, the colour stays here, where it belongs to the banner it sits
// on — a tone with one caller is a hardcode wearing a variant's name.
function matchWord(count) {
  if (count === 1) return 'повідомлення';
  return count < 5 ? 'повідомлення' : 'повідомлень';
}

export default function ChatSearchBanner({ query, count = 0, onClear }) {
  return (
    <div className="bg-[#fffbe6] border-b border-[#ffe58f] px-6 py-2 flex items-center justify-between shrink-0">
      <p className="text-[13px] text-[#876800]">
        Знайдено <strong>{count}</strong> {matchWord(count)} за запитом <strong>«{query}»</strong>
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-[#d4b106] hover:text-[#ad8b00] text-[13px] font-semibold underline"
      >
        Очистити
      </button>
    </div>
  );
}
