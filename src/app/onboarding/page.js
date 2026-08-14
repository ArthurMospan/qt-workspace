'use client';
// src/app/onboarding/page.js
// Single-step premium onboarding matching the login style.
import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthLayout from '@/components/AuthLayout';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import { ArrowRight, Check } from 'lucide-react';

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewOrg = searchParams.get('new') === 'true';
  const { currentUser, activeOrg, activeOrgId, setActiveOrgId, switchOrg, orgRole, authLoading, orgLoading } = useAppContext();

  const [step, setStep] = useState(0); // 0: Name, 1: Plan
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('free');

  // Auto-fill org name
  useEffect(() => {
    let nextName = '';
    if (isNewOrg) {
      if (currentUser?.email) {
        const prefix = currentUser.email.split('@')[0];
        const formatted = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        nextName = `${formatted} Team`;
      }
    } else if (activeOrg?.name && activeOrg.name !== 'QuickTeam') {
      nextName = activeOrg.name;
    } else if (currentUser?.email) {
      const prefix = currentUser.email.split('@')[0];
      const formatted = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      nextName = `${formatted} Team`;
    }
    if (nextName) queueMicrotask(() => setOrgName(nextName));
  }, [activeOrg?.name, currentUser?.email, isNewOrg]);

  // Non-owner/admin → go to workspace (skip if creating new org)
  useEffect(() => {
    if (isNewOrg) return;
    if (!authLoading && !orgLoading && currentUser && orgRole && orgRole !== 'owner' && orgRole !== 'admin') {
      router.replace('/');
    }
  }, [authLoading, orgLoading, currentUser, orgRole, router, isNewOrg]);

  // Already onboarded → go to workspace (skip if creating new org)
  useEffect(() => {
    if (isNewOrg) return;
    if (!authLoading && !orgLoading && activeOrg?.onboarded === true) {
      router.replace('/');
    }
  }, [authLoading, orgLoading, activeOrg, router, isNewOrg]);

  if (authLoading || orgLoading) {
    return (
      <div className="w-full h-full min-h-screen flex items-center justify-center bg-[#f4f4f5]">
        <div className="w-[32px] h-[32px] border-[3px] border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  const handleNext = () => {
    if (orgName.trim()) setStep(1);
  };

  const handleFinish = async () => {
    if (!orgName.trim() || saving) return;
    setSaving(true);
    const uid = currentUser?.id || currentUser?.uid;
    const orgId = (isNewOrg || !activeOrgId) ? `org_${uid?.slice(0, 8)}_${Date.now()}` : activeOrgId;
    
    try {
      // Upsert the org doc
      await setDoc(doc(db, 'organizations', orgId), {
        id: orgId,
        name: orgName.trim(),
        logo: logoUrl,
        ownerId: uid,
        memberUids: [uid],
        members: [{ uid, role: 'owner', email: currentUser?.email || '' }],
        plan: selectedPlan,
        limits: selectedPlan === 'free' ? { maxProjects: 3, maxMembers: null } : { maxProjects: null, maxMembers: null },
        onboarded: true,
        onboardedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Ensure owner membership exists
      await setDoc(doc(db, 'orgMemberships', `${orgId}_${uid}`), {
        id: `${orgId}_${uid}`,
        orgId,
        userId: uid,
        role: 'owner',
        joinedAt: new Date().toISOString(),
      }, { merge: true });

      // Force local state update immediately, bypassing switchOrg's allOrgs check
      if (setActiveOrgId) {
        setActiveOrgId(orgId);
      }
      sessionStorage.setItem('qt_active_org_id', orgId);
      localStorage.removeItem('qt_active_org_id');
      sessionStorage.setItem('qt_org_selected_this_session', '1');
      
      setTimeout(() => {
        router.replace('/');
      }, 100);
    } catch (err) {
      console.error('[Onboarding] saveOrg error:', err);
      setSaving(false);
    }
  };

  return (
    <AuthLayout 
      hideCreateOrg={true}
      onClose={isNewOrg ? () => router.replace('/') : undefined}
    >
      <div className={`w-full ${step === 1 ? 'max-w-[860px]' : 'max-w-[480px]'} flex flex-col items-center z-10 relative transition-all duration-500 pb-16`}>

        {step === 0 && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <h1 className="text-white text-[32px] font-black tracking-tight mb-[6px] text-center">Створення організації</h1>
            <p className="text-white/50 text-[15px] leading-relaxed text-center mb-[32px]">
              Як називається ваша команда або організація?
            </p>

            {/* Form */}
            <div className="w-full mb-8 space-y-6">
              <div>
                <label className="block text-[14px] font-medium text-white mb-2">
                  Назва
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Введіть назву організації"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && orgName.trim()) handleNext(); }}
                  className="w-full bg-[#2a2a2a] border border-white/10 rounded-[12px] px-4 py-[14px] text-white text-[15px] placeholder:text-white/30 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
                />
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={!orgName.trim()}
              className="w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] py-[16px] px-6 rounded-[16px] text-[15px] font-bold hover:bg-[#e9e9e9] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              Далі
              <ArrowRight size={18} />
            </button>
            <p className="mt-[24px] text-white/30 text-[12px] leading-relaxed text-center">
              Назву організації можна буде змінити пізніше в Налаштуваннях.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="w-full flex flex-col animate-in fade-in slide-in-from-right-8 duration-500">
            
            <div className="w-full flex items-center mb-6 relative">
              <button 
                onClick={() => setStep(0)} 
                className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center gap-2 text-white/50 hover:text-white text-[13px] font-bold transition-colors"
              >
                <ArrowRight size={16} className="rotate-180" /> 
                Назад
              </button>
              <div className="w-full text-center">
                <h1 className="text-white text-[32px] font-black tracking-tight mb-[6px]">Оберіть тариф</h1>
                <p className="text-white/50 text-[15px] leading-relaxed">
                  Почніть безкоштовно або розблокуйте весь потенціал {orgName}.
                </p>
              </div>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Free Plan */}
              <button
                onClick={() => setSelectedPlan('free')}
                className={`flex flex-col text-left p-6 rounded-[24px] border-[2px] transition-all relative overflow-hidden ${
                  selectedPlan === 'free'
                    ? 'border-white bg-[#2a2a2a]'
                    : 'border-[#3a3a3a] hover:border-white/50 bg-[#1f1f1f]'
                }`}
              >
                <div className="mb-4">
                  <span className={`text-[18px] font-bold ${selectedPlan === 'free' ? 'text-white' : 'text-white/50'}`}>Free</span>
                  <div className="text-[28px] font-black text-white mt-1">$0<span className="text-white/50 text-[14px] font-normal">/міс</span></div>
                </div>
                <ul className="flex flex-col gap-3 flex-1 text-[14px]">
                  <li className="flex items-start gap-3 text-white/80">
                    <Check size={18} className="text-white/50 shrink-0 mt-[2px]" />
                    <span>До 3 активних проєктів</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check size={18} className="text-white/50 shrink-0 mt-[2px]" />
                    <span>Базовий трекінг завдань та багів</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check size={18} className="text-white/50 shrink-0 mt-[2px]" />
                    <span>До 5 учасників команди</span>
                  </li>
                  <li className="flex items-start gap-3 text-white/80">
                    <Check size={18} className="text-white/50 shrink-0 mt-[2px]" />
                    <span>Базова аналітика</span>
                  </li>
                </ul>
              </button>

              {/* Lite Plan */}
              <button
                onClick={() => setSelectedPlan('lite')}
                className={`flex flex-col text-left p-6 rounded-[24px] border-[2px] transition-all relative overflow-hidden ${
                  selectedPlan === 'lite'
                    ? 'border-[#0ea5e9] bg-[#0ea5e9]/10 shadow-[0_0_40px_rgba(14,165,233,0.15)]'
                    : 'border-[#3a3a3a] hover:border-white/50 bg-[#1f1f1f]'
                }`}
              >
                <div className="mb-4 relative z-10">
                  <span className={`text-[18px] font-bold ${selectedPlan === 'lite' ? 'text-[#38bdf8]' : 'text-[#0ea5e9]'}`}>Lite</span>
                  <div className="text-[28px] font-black text-white mt-1">$9<span className="text-white/50 text-[14px] font-normal">/міс</span></div>
                </div>
                <ul className="flex flex-col gap-3 flex-1 text-[14px] relative z-10">
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#38bdf8] shrink-0 mt-[2px]" />
                    <span>До 10 активних проєктів</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#38bdf8] shrink-0 mt-[2px]" />
                    <span>Трекінг завдань, багів та часу</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#38bdf8] shrink-0 mt-[2px]" />
                    <span>До 15 учасників команди</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#38bdf8] shrink-0 mt-[2px]" />
                    <span>Розширена аналітика</span>
                  </li>
                </ul>
              </button>

              {/* Pro Plan */}
              <button
                onClick={() => setSelectedPlan('pro')}
                className={`flex flex-col text-left p-6 rounded-[24px] border-[2px] transition-all relative overflow-hidden ${
                  selectedPlan === 'pro'
                    ? 'border-[#6366f1] bg-[#6366f1]/10 shadow-[0_0_40px_rgba(99,102,241,0.15)]'
                    : 'border-[#3a3a3a] hover:border-white/50 bg-[#1f1f1f]'
                }`}
              >
                <div className="mb-4 relative z-10">
                  <div className="flex justify-between items-center">
                    <span className={`text-[18px] font-bold ${selectedPlan === 'pro' ? 'text-[#a5a6f6]' : 'text-[#6366f1]'}`}>Pro</span>
                    <span className="bg-[#6366f1] text-white text-[11px] font-bold px-3 py-1 rounded-full">Рекомендовано</span>
                  </div>
                  <div className="text-[28px] font-black text-white mt-1">$19<span className="text-white/50 text-[14px] font-normal">/міс</span></div>
                </div>
                <ul className="flex flex-col gap-3 flex-1 text-[14px] relative z-10">
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#a5a6f6] shrink-0 mt-[2px]" />
                    <span><strong className="font-semibold text-white">Безлімітні</strong> проєкти та дошки</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#a5a6f6] shrink-0 mt-[2px]" />
                    <span>Усі функції трекінгу + кастомні поля</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#a5a6f6] shrink-0 mt-[2px]" />
                    <span>Безлімітна кількість учасників</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#a5a6f6] shrink-0 mt-[2px]" />
                    <span>Гостьовий доступ для клієнтів</span>
                  </li>
                  <li className="flex items-start gap-3 text-white">
                    <Check size={18} className="text-[#a5a6f6] shrink-0 mt-[2px]" />
                    <span>Пріоритетна підтримка</span>
                  </li>
                </ul>
              </button>
            </div>

            <div className="w-full flex justify-center">
              <button
                onClick={handleFinish}
                disabled={saving}
                className="w-full max-w-[320px] flex items-center justify-center gap-3 bg-white text-[#1f1f1f] py-[16px] px-6 rounded-[16px] text-[15px] font-bold hover:bg-[#e9e9e9] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all shadow-[0_4px_20px_rgba(255,255,255,0.1)]"
              >
                {saving ? (
                  <div className="w-[20px] h-[20px] border-[2px] border-[#1f1f1f]/20 border-t-[#1f1f1f] rounded-full animate-spin" />
                ) : (
                  <>
                    Продовжити
                  </>
                )}
              </button>
            </div>
            
            {/* Disclaimer */}
            <p className="mt-[32px] text-white/30 text-[12px] leading-relaxed text-center">
              Ви зможете змінити тариф в будь-який момент в Налаштуваннях.
            </p>
          </div>
        )}

      </div>
    </AuthLayout>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-[32px] h-[32px] border-[3px] border-[#333] border-t-white rounded-full animate-spin" />
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
