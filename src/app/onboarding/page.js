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
import { ArrowRight } from 'lucide-react';
import { PlanCards } from '@/components/ui';
import { DEFAULT_PLAN, storedPlanLimit } from '@/lib/utils/plans.mjs';
import { normalizeTimeZone } from '@/lib/utils/timeZone.mjs';

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isNewOrg = searchParams.get('new') === 'true';
  const { currentUser, activeOrg, activeOrgId, setActiveOrgId, switchOrg, orgRole, authLoading, orgLoading } = useAppContext();

  const [step, setStep] = useState(0); // 0: Name, 1: Plan
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(DEFAULT_PLAN);

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
    const isFreshOrganization = isNewOrg || !activeOrgId;
    const orgId = isFreshOrganization ? `org_${uid?.slice(0, 8)}_${Date.now()}` : activeOrgId;
    const detectedTimeZone = normalizeTimeZone(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    
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
        timezone: activeOrg?.timezone || detectedTimeZone,
        // The ceilings come from the registry, not from a ternary. This line
        // used to read `plan === 'free' ? 3 : null`, which handed Lite the
        // unlimited copy of a ceiling the price list sets at ten — the same
        // split that made Lite equal to Free everywhere else.
        limits: {
          maxProjects: storedPlanLimit(selectedPlan, 'projects'),
          maxMembers: storedPlanLimit(selectedPlan, 'members'),
        },
        onboarded: true,
        onboardedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // The owner seat, written once — with the organization it belongs to.
      //
      // Only a new organization needs one. Onboarding an organization that is
      // already the active one means its seat is what made it active, and a
      // client write to a membership that already exists is refused outright:
      // roles, rates and removals are server-owned, and a merge write onto an
      // existing document is an update like any other. So this used to fail on
      // a line whose whole job was to be a no-op, telling the owner the
      // workspace could not be saved after it already had been.
      //
      // Reading first is not the way around it either — the read rule tests
      // `resource.data.userId`, and on a document that is not there yet that is
      // a denial rather than an empty answer. Knowing which case we are in is.
      if (isFreshOrganization) {
        await setDoc(doc(db, 'orgMemberships', `${orgId}_${uid}`), {
          id: `${orgId}_${uid}`,
          orgId,
          userId: uid,
          role: 'owner',
          joinedAt: new Date().toISOString(),
        });
      }

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
            
            <div className="relative mb-6 flex w-full flex-col items-center gap-4 sm:block">
              <button 
                onClick={() => setStep(0)} 
                className="flex self-start items-center gap-2 text-[13px] font-bold text-white/50 transition-colors hover:text-white sm:absolute sm:left-0 sm:top-1/2 sm:-translate-y-1/2"
              >
                <ArrowRight size={16} className="rotate-180" /> 
                Назад
              </button>
              <div className="w-full text-center sm:px-24">
                <h1 className="mb-[6px] text-[28px] font-black tracking-tight text-white sm:text-[32px]">Оберіть тариф</h1>
                <p className="text-white/50 text-[15px] leading-relaxed">
                  Почніть безкоштовно або розблокуйте весь потенціал {orgName}.
                </p>
              </div>
            </div>

            {/* The same price list the settings screen shows, and the same
                registry behind it. This step used to hand-build three cards
                with four invented bullet points each and an accent colour per
                plan, at prices the product had already moved on from — a
                person met that on the day they signed up and a different one
                the first time they went looking for the bill. */}
            <PlanCards
              activePlanId={selectedPlan}
              activeLabel="Обрано"
              onChoose={setSelectedPlan}
              className="mb-8"
            />

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
