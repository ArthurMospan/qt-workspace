// src/app/layout.js — Root layout
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import AutoFix from '@/components/AutoFix';
import Script from 'next/script';
import { Inter, Roboto_Condensed } from 'next/font/google';

// Keep both product typefaces on our own origin. The old CSS @import made the
// first paint wait on two browser-side Google requests and occasionally left
// the UI Kit (and a real user) on fallback metrics when either request failed.
const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-inter-loaded',
});

const robotoCondensed = Roboto_Condensed({
  subsets: ['cyrillic', 'latin'],
  display: 'swap',
  variable: '--font-roboto-loaded',
});

// `opengraph-image.js` renders the card; Next only turns it into an absolute
// URL if it knows where the app lives. The same variable the invite links and
// the emails already resolve against, so there is one answer to "what is our
// origin" rather than three.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const OG_DESCRIPTION = 'Внутрішній простір команди: задачі, час, чат і календар';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  // `template` is what makes the tab useful. Every screen sets its own title
  // through it, so a browser with eight QuickTeam tabs open no longer shows
  // eight tabs reading "QuickTeam".
  title: {
    default: 'QuickTeam',
    template: '%s · QuickTeam',
  },
  description: 'Internal task manager for the QuickTeam team',
  // A workspace link is pasted into a chat dozens of times a day. Without this
  // it unfurled as the bare host: no name, no mark, no hint of what it opens.
  openGraph: {
    type: 'website',
    siteName: 'QuickTeam',
    locale: 'uk_UA',
    url: SITE_URL,
    title: 'QuickTeam',
    description: OG_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QuickTeam',
    description: OG_DESCRIPTION,
  },
  applicationName: 'QuickTeam',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    // The 32px favicon was also serving as the home-screen icon, which is why
    // "Add to Home Screen" produced a blurry square.
    apple: { url: '/quickteam.png', sizes: '436x436' },
  },
  appleWebApp: {
    capable: true,
    title: 'QuickTeam',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  // An internal workspace has nothing to gain from being indexed, and every
  // authenticated URL leaks structure if it is.
  robots: { index: false, follow: false },
};

// Deliberately without `viewportFit: 'cover'`. The default fit keeps the home
// indicator and the gesture bar outside the layout viewport, so a fixed bottom
// bar physically cannot slide underneath them; opting into cover would move
// that responsibility into every `env()` call site and one missed inset is a
// tab bar behind the system UI. See --qt-nav-* in globals.css.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom stays available: disabling it is an accessibility regression,
  // and the app has real 11px type in places.
  maximumScale: 5,
  // Paints the browser's own chrome to match the page, which is what makes the
  // top of the screen read as one surface rather than a site inside a browser.
  themeColor: '#f4f4f5',
  colorScheme: 'light',
};

// Анти-мигання брендингу: сайдбар рендериться на сервері стандартним темним і
// перефарбовується лише після гідрації React (сотні мс). Цей скрипт виконується
// ДО першого кадру: бере останню застосовану тему з localStorage (пише її
// useSidebarThemeBoot) і через <style> з !important фарбує [data-app-sb]
// одразу. Коли приїжджають живі дані організації — стиль прибирається.
const SIDEBAR_BOOT_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem('qt_sidebar_theme')||'null');if(!t)return;var ok=function(v){return typeof v==='string'&&/^(#[0-9a-fA-F]{3,8}|rgba?\\([0-9.,%\\s]+\\))$/.test(v)};if(!ok(t.bg))return;var map={text:'--sb-text',muted:'--sb-muted',hover:'--sb-hover',active:'--sb-active',border:'--sb-border',mutedProject:'--sb-muted-project',mutedHeader:'--sb-muted-header'};var css='background-color:'+t.bg+' !important;--sb-bg:'+t.bg+' !important;';for(var k in map){if(ok(t[k]))css+=map[k]+':'+t[k]+' !important;'}var s=document.createElement('style');s.id='sb-boot-theme';s.textContent='[data-app-sb]{'+css+'}';document.head.appendChild(s)}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="uk" className={`${inter.variable} ${robotoCondensed.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_BOOT_SCRIPT }} />
        <AppProvider>
          <AutoFix />
          {children}
        </AppProvider>
        <Script
          src="https://buggy-bag.vercel.app/buggy-bag-standalone.js"
          data-api-key="4ed8e40e-bfeb-4dff-863e-53a36662254b"
          data-portal-url="https://buggy-bag.vercel.app"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
