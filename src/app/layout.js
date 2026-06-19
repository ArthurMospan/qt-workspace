// src/app/layout.js — Root layout
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import AutoFix from '@/components/AutoFix';
import Script from 'next/script';

export const metadata = {
  title: 'QuickTeam Workspace',
  description: 'Internal task manager for the QuickTeam team',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
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

