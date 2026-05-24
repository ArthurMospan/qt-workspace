'use client';
// src/app/login/page.js — Google Sign-In page
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { currentUser, authLoading, signInWithGoogle } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && currentUser) router.replace('/workspace');
  }, [currentUser, authLoading, router]);

  const handleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e.code === 'custom/popup-blocked' ? 'Дозвольте попапи у браузері' : 'Помилка входу. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return (
    <div className="w-full h-full flex items-center justify-center bg-[#111]">
      <div className="w-[36px] h-[36px] border-[3px] border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#111]">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[30%] w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[25%] w-[300px] h-[300px] bg-purple-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-[380px] px-[24px]">
        {/* Logo */}
        <div className="w-[56px] h-[56px] rounded-[16px] bg-white/8 border border-white/10 flex items-center justify-center mb-[24px]">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        </div>

        <h1 className="text-white text-[28px] font-bold tracking-tight mb-[8px]">Workspace</h1>
        <p className="text-white/40 text-[14px] text-center mb-[40px] leading-relaxed">
          Внутрішній таск-менеджер QuickTeam.<br />Тільки для команди.
        </p>

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full h-[52px] flex items-center justify-center gap-[12px] bg-white text-[#111] rounded-[14px] text-[15px] font-bold hover:bg-white/90 disabled:opacity-60 transition-all shadow-[0_4px_24px_rgba(255,255,255,0.1)]"
        >
          {loading ? (
            <div className="w-[20px] h-[20px] border-[2px] border-[#111]/20 border-t-[#111] rounded-full animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Увійти через Google
            </>
          )}
        </button>

        {error && <p className="mt-[12px] text-red-400/80 text-[13px] text-center">{error}</p>}

        <p className="mt-[32px] text-white/20 text-[11px] text-center">
          Доступ тільки для членів команди QuickTeam
        </p>
      </div>
    </div>
  );
}
