'use client';
// src/app/privacy-policy/page.js — Premium Dark Theme Privacy Policy page
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-white/80 py-[60px] px-6 relative overflow-hidden select-none">
      {/* Decorative dark glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#6366f1]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#0891b2]/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[680px] mx-auto z-10 relative">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between mb-[40px]">
          <Link href="/login" className="inline-flex items-center gap-2 text-[13px] text-white/50 hover:text-white transition-colors group">
            <ArrowLeft size={16} className="transform group-hover:-translate-x-1 transition-transform" />
            Назад до входу
          </Link>
          <Image src="/logo.svg" alt="QuickTeam" width={110} height={26} className="object-contain" />
        </div>

        {/* Card wrapper */}
        <div className="backdrop-blur-xl bg-white/[0.02] border border-white/[0.05] p-8 md:p-10 rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <div className="w-12 h-12 bg-white/[0.04] border border-white/[0.08] rounded-[16px] flex items-center justify-center mb-6">
            <Shield size={22} className="text-[#6366f1]" />
          </div>

          <h1 className="text-white text-[28px] font-black tracking-tight mb-2">
            Політика конфіденційності
          </h1>
          <p className="text-white/40 text-[12px] mb-8">
            Останнє оновлення: 29 травня 2026 року
          </p>

          <div className="space-y-6 text-[14px] leading-relaxed text-white/70">
            <section>
              <h2 className="text-white text-[16px] font-bold mb-2">1. Збір інформації</h2>
              <p>
                Ми збираємо інформацію, яку ви надаєте безпосередньо нам під час авторизації через Google, включаючи ваше ім'я, адресу електронної пошти та зображення профілю. Це необхідно для створення вашого облікового запису та ідентифікації в системі QuickTeam.
              </p>
            </section>

            <section>
              <h2 className="text-white text-[16px] font-bold mb-2">2. Використання даних</h2>
              <p>
                Ваші дані використовуються виключно для забезпечення роботи внутрішнього таск-менеджера: відображення виконавців у задачах, оновлення статусів у реальному часі, надсилання внутрішніх сповіщень та інтеграції з клієнтським порталом. Ми не передаємо ваші дані третім особам.
              </p>
            </section>

            <section>
              <h2 className="text-white text-[16px] font-bold mb-2">3. Захист інформації</h2>
              <p>
                Ми впроваджуємо сучасні технічні та організаційні заходи безпеки (включаючи шифрування даних та безпечні сервери Google Firebase) для захисту вашої особистої інформації від несанкціонованого доступу, зміни або видалення.
              </p>
            </section>

            <section>
              <h2 className="text-white text-[16px] font-bold mb-2">4. Ваші права</h2>
              <p>
                Ви маєте право в будь-який момент переглянути, оновити або видалити свої дані через налаштування профілю воркспейсу або звернувшись до адміністратора вашої організації QuickTeam.
              </p>
            </section>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/20 text-[11px] mt-8">
          © {new Date().getFullYear()} QuickTeam. Всі права захищені.
        </p>
      </div>
    </div>
  );
}
