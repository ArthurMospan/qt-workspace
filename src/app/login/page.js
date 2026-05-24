'use client';
// src/app/login/page.js — Light theme login matching qt/ aesthetic
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';

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
    } catch {
      setError('Помилка входу. Спробуйте ще раз.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return (
    <div className="w-full h-full flex items-center justify-center bg-[#f7f7f7]">
      <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full h-full flex bg-[#f7f7f7] overflow-hidden">
      {/* Left dark panel */}
      <div className="hidden md:flex w-[420px] shrink-0 bg-[#1f1f1f] flex-col justify-between p-10">
        <Image src="/logo.svg" alt="QuickTeam" width={130} height={31} className="object-contain" />
        <div>
          <h2 className="text-white text-[28px] font-bold leading-tight mb-4">
            Внутрішній<br />таск-менеджер
          </h2>
          <p className="text-white/40 text-[14px] leading-relaxed">
            Керуй командою та проєктами в одному місці. Тільки для членів команди QuickTeam.
          </p>
        </div>
        <p className="text-white/20 text-[11px]">© {new Date().getFullYear()} QuickTeam</p>
      </div>

      {/* Right light panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Mobile logo */}
        <div className="md:hidden mb-10">
          <Image src="/logo.svg" alt="QuickTeam" width={140} height={34} className="object-contain invert" />
        </div>

        <div className="w-full max-w-[360px]">
          <h1 className="text-[#1f1f1f] text-[26px] font-bold mb-2">Вхід</h1>
          <p className="text-[#9a9a9a] text-[14px] mb-8">Доступ тільки для команди QuickTeam</p>

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-[#1f1f1f] text-white py-[14px] px-6 rounded-[14px] text-[14px] font-bold hover:bg-[#303030] disabled:opacity-50 transition-all shadow-sm"
          >
            {loading ? (
              <div className="w-[18px] h-[18px] border-[2px] border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Увійти через Google
              </>
            )}
          </button>

          {error && <p className="mt-4 text-red-500 text-[13px] text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
}
