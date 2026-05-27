// src/app/layout.js — Root layout
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import AutoFix from '@/components/AutoFix';

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
      </body>
    </html>
  );
}
