import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  robots: { index: true, follow: true },
};

// A public URL may be opened from the workspace, an email, a search result or a
// fresh tab. Its way out therefore cannot depend on browser history. The small
// brand header gives every route a stable home and keeps the public documents
// recognisably QuickTeam without turning them into a marketing site.
export default function PublicLayout({ children }) {
  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-canvas text-ink">
      <a href="#public-content" className="qt-skip-link rounded-[10px] bg-ink px-4 py-2 text-[13px] font-bold text-white">
        До вмісту
      </a>
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="mx-auto flex h-[64px] w-full max-w-[880px] items-center justify-between gap-[20px] px-4 sm:px-6">
          <Link href="/" aria-label="QuickTeam — головна" className="flex min-w-0 items-center gap-[10px]">
            <Image src="/logo-min-dark.svg" alt="" width={32} height={32} loading="eager" />
            <span className="ui-type-section-title truncate text-ink">QuickTeam</span>
          </Link>
          <nav aria-label="Публічна навігація" className="flex items-center gap-[18px] text-[12px] font-bold">
            <Link href="/help" className="hidden text-muted hover:text-ink sm:inline">Довідка</Link>
            <Link href="/terms" className="hidden text-muted hover:text-ink md:inline">Правова інформація</Link>
            <Link href="/" className="text-ink hover:underline">До робочого простору →</Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[880px] px-4 py-[24px] sm:px-6 sm:py-[40px]">
        <main id="public-content" className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
