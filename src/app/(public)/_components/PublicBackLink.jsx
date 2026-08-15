'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';

/**
 * The only chrome a public document gets.
 *
 * `router.back()` where there is somewhere to go back to — the workspace menu
 * that opened it, the login screen, a link in a chat — and the workspace itself
 * otherwise, which is what a direct visit or a fresh tab gets. A plain link home
 * would throw away the caller's place; a bare `back()` would strand anyone who
 * arrived here first.
 */
export default function PublicBackLink() {
  const router = useRouter();

  return (
    <Button
      style="ghost"
      size="sm"
      icon={ArrowLeft}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.push('/');
      }}
      className="-ml-[8px]"
    >
      Назад
    </Button>
  );
}
