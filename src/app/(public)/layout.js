import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  robots: { index: true, follow: true },
};

const NAVIGATION = [
  { href: '/help', label: 'Довідка' },
  { href: '/news', label: 'Новини' },
  { href: '/versions', label: 'Версії' },
];

export default function PublicLayout({ children }) {
  return (
    <div className="h-dvh w-full overflow-y-auto overflow-x-hidden bg-canvas text-ink">
      <a href="#public-content" className="qt-skip-link rounded-lg bg-ink px-4 py-2 text-sm font-bold text-white">
        До вмісту
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 w-full max-w-[1120px] flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/help" aria-label="QuickTeam — довідка" className="mr-auto inline-flex items-center">
            <Image src="/logo.svg" alt="QuickTeam" width={166} height={40} className="h-auto w-[124px]" priority />
          </Link>
          <nav aria-label="Інформаційні сторінки" className="flex flex-wrap items-center gap-1">
            {NAVIGATION.map(item => (
              <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-canvas hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/login" className="rounded-[10px] bg-ink px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-ink-hover">
            Увійти
          </Link>
        </div>
      </header>
      <main id="public-content" className="mx-auto min-h-[calc(100dvh-64px)] w-full max-w-[1120px] px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-xs text-muted sm:px-6">
          <span>QuickTeam</span>
          <Link href="/terms" className="hover:text-ink">Умови</Link>
          <Link href="/privacy" className="hover:text-ink">Конфіденційність</Link>
          <Link href="/offer" className="hover:text-ink">Оферта</Link>
        </div>
      </footer>
    </div>
  );
}
