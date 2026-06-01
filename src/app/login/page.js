'use client';
// src/app/login/page.js — Premium Dark Theme Login page with glassmorphism card and subtle animations
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import Image from 'next/image';
import Link from 'next/link';
import AnimatedLogo from '@/components/AnimatedLogo';

import AuthLayout from '@/components/AuthLayout';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, signInWithEmail, currentUser, authLoading } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);



  useEffect(() => {
    if (!authLoading && currentUser) {
      router.replace('/workspace');
    }
  }, [currentUser, authLoading, router]);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
      sessionStorage.setItem('just_logged_in', 'true');
      router.replace('/workspace');
    } catch (err) {
      console.error('[Login] Error:', err);
      setError('Не вдалося увійти. Спробуйте ще раз.');
      setLoading(false);
    }
  };

  if (authLoading) return (
    <div className="w-full h-full flex items-center justify-center bg-[#1c1c1c]">
      <div className="w-[32px] h-[32px] border-[3px] border-[#3a3a3a] border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <AuthLayout hideCreateOrg={true}>
      <div className="w-full max-w-[360px] flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        
        {/* Animated Logo */}
        <div className="mb-[24px]">
          <AnimatedLogo />
        </div>

        {/* Title & Info */}
        <h1 className="text-white text-[32px] font-black tracking-tight mb-[10px]">Вхід в QuickTeam</h1>
        <p className="text-white/50 text-[15px] leading-relaxed max-w-[280px] mb-[32px]">
          Керуй командою та проєктами в одному місці.
        </p>

        {/* Google Sign-in Button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] py-[14px] px-6 rounded-[16px] text-[15px] font-bold hover:bg-[#e9e9e9] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-xl mb-3"
        >
          {loading ? (
            <div className="w-[20px] h-[20px] border-[2px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" className="shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Увійти через Google
            </>
          )}
        </button>

        {/* Email Sign-in Form */}
        <form 
          onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const email = formData.get('email');
            const password = formData.get('password');
            try {
              setLoading(true);
              setError(null);
              await signInWithEmail(email, password);
              sessionStorage.setItem('just_logged_in', 'true');
              router.replace('/workspace');
            } catch (err) {
              console.error('[Email Login] Error:', err);
              setError('Помилка входу за Email. Перевірте пошту та пароль.');
              setLoading(false);
            }
          }}
          className="w-full flex flex-col gap-3"
        >
          <input 
            type="email" 
            name="email" 
            placeholder="Електронна пошта" 
            required 
            disabled={loading}
            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-[12px] text-[14px] outline-none focus:border-white/30 transition-colors"
          />
          <input 
            type="password" 
            name="password" 
            placeholder="Пароль" 
            required 
            disabled={loading}
            className="w-full bg-white/5 border border-white/10 text-white px-4 py-3 rounded-[12px] text-[14px] outline-none focus:border-white/30 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-white/10 text-white border border-white/20 py-[12px] px-6 rounded-[16px] text-[14px] font-semibold active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {loading ? (
              <div className="w-[18px] h-[18px] border-[2px] border-white/20 border-t-white rounded-full animate-spin" />
            ) : 'Увійти за Email'}
          </button>
        </form>

        {error && (
          <p className="mt-6 text-red-400 text-[13px] font-medium leading-relaxed bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-[12px] w-full">
            {error}
          </p>
        )}

      </div>
    </AuthLayout>
  );
}
