'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Back out of a legal document.
 *
 * `router.back()` where there is somewhere to go back to — the workspace menu
 * that opened it, a link in a chat — and the workspace itself otherwise, which
 * is what a direct visit or a fresh tab gets. A bare `Link` home would throw
 * away the caller's place; a bare `back()` would strand anyone who arrived
 * here first.
 */
export default function LegalBackLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
      }}
      className="-ml-2 mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-bold text-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      <ArrowLeft size={16} aria-hidden />
      Назад
    </button>
  );
}
