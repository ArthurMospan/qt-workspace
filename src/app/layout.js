// src/app/layout.js — Root layout
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import AutoFix from '@/components/AutoFix';
import Script from 'next/script';

export const metadata = {
  title: 'QuickTeam',
  description: 'Internal task manager for the QuickTeam team',
};

// Анти-мигання брендингу: сайдбар рендериться на сервері стандартним темним і
// перефарбовується лише після гідрації React (сотні мс). Цей скрипт виконується
// ДО першого кадру: бере останню застосовану тему з localStorage (пише її
// useSidebarThemeBoot) і через <style> з !important фарбує [data-app-sb]
// одразу. Коли приїжджають живі дані організації — стиль прибирається.
const SIDEBAR_BOOT_SCRIPT = `(function(){try{var t=JSON.parse(localStorage.getItem('qt_sidebar_theme')||'null');if(!t)return;var ok=function(v){return typeof v==='string'&&/^(#[0-9a-fA-F]{3,8}|rgba?\\([0-9.,%\\s]+\\))$/.test(v)};if(!ok(t.bg))return;var map={text:'--sb-text',muted:'--sb-muted',hover:'--sb-hover',active:'--sb-active',border:'--sb-border',mutedProject:'--sb-muted-project',mutedHeader:'--sb-muted-header'};var css='background-color:'+t.bg+' !important;--sb-bg:'+t.bg+' !important;';for(var k in map){if(ok(t[k]))css+=map[k]+':'+t[k]+' !important;'}var s=document.createElement('style');s.id='sb-boot-theme';s.textContent='[data-app-sb]{'+css+'}';document.head.appendChild(s)}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
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
