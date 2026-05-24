// src/app/layout.js — Root layout
import './globals.css';
import { AppProvider } from '@/lib/context/AppContext';
import Toast from '@/components/Toast';

export const metadata = {
  title: 'QuickTeam Workspace',
  description: 'Internal task manager for the QuickTeam team',
};

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body>
        <AppProvider>
          {children}
          <Toast />
        </AppProvider>
      </body>
    </html>
  );
}
