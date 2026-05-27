'use client';
// src/app/onboarding/page.js
// Lightweight 2-step onboarding: 1) Org name  2) Invite team
// Project creation + QT setup are left for when the user explores the workspace naturally
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Check, ArrowRight, Plus, X } from 'lucide-react';
import Image from 'next/image';

const STEPS = [
  { id: 'org',  title: 'Організація' },
  { id: 'plan', title: 'Тариф' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { currentUser, activeOrg, activeOrgId, setActiveOrgId, orgRole, authLoading, orgLoading } = useAppContext();

  const [step,   setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — Org name
  const [orgName, setOrgName] = useState('');

  // Step 1 — Plan
  const [selectedPlan, setSelectedPlan] = useState('free');

  // Auto-fill if org name is already set
  useEffect(() => {
    if (activeOrg?.name && activeOrg.name !== 'QuickTeam') {
      setOrgName(activeOrg.name);
    }
  }, [activeOrg?.name]);

  // Non-owner/admin → go to workspace
  useEffect(() => {
    if (!authLoading && !orgLoading && currentUser && orgRole && orgRole !== 'owner' && orgRole !== 'admin') {
      router.replace('/workspace');
    }
  }, [authLoading, orgLoading, currentUser, orgRole, router]);

  // Already onboarded → go to workspace
  useEffect(() => {
    if (!authLoading && !orgLoading && activeOrg?.onboarded === true) {
      router.replace('/workspace');
    }
  }, [authLoading, orgLoading, activeOrg, router]);

  if (authLoading || orgLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f7f7]">
        <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
      </div>
    );
  }

  // ── Handlers ──────────────────────────────────────────────────────────

  const saveOrg = async () => {
    if (!orgName.trim()) return;
    setSaving(true);
    const uid = currentUser?.id || currentUser?.uid;
    const orgId = activeOrgId || 'quickteam';
    try {
      // Always upsert the org doc
      await setDoc(doc(db, 'organizations', orgId), {
        name: orgName.trim(),
        ownerId: uid,
        memberUids: [uid],
        members: [{ uid, role: 'owner', email: currentUser?.email || '' }],
        plan: 'free',
        onboarded: false,
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
        hourlyRate: 0,
      }, { merge: true });

      if (!activeOrgId) {
        setActiveOrgId(orgId);
        localStorage.setItem('qt_active_org_id', orgId);
      }
      setStep(1);
    } catch (err) {
      console.error('[Onboarding] saveOrg error:', err);
    }
    setSaving(false);
  };

  const finish = async () => {
    setSaving(true);
    try {
      // Use localStorage fallback if activeOrgId isn't updated in state yet
      const orgIdToUpdate = activeOrgId || localStorage.getItem('qt_active_org_id');

      // Mark org as onboarded and update plan
      await updateDoc(doc(db, 'organizations', orgIdToUpdate), {
        plan: selectedPlan,
        onboarded: true,
        onboardedAt: serverTimestamp(),
      });

      router.replace('/workspace');
    } catch (err) {
      console.error('[Onboarding] finish error:', err);
    }
    setSaving(false);
  };

  // ── UI ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f7f7f7] flex flex-col overflow-y-auto">

      {/* Top bar — uses the SAME logo as workspace sidebar */}
      <header className="bg-white border-b border-[#e9e9e9] h-[52px] flex items-center px-6 shrink-0">
        <Image src="/logo-dark.svg" alt="QuickTeam" width={110} height={22}
          className="object-contain"
          onError={(e) => {
            // fallback: try logo.svg (white version won't work on white bg, try dark)
            e.currentTarget.src = '/logo.svg';
          }}
        />
        <button
          onClick={async () => {
            // Skip onboarding — still mark as onboarded so we don't loop
            if (activeOrgId) {
              await updateDoc(doc(db, 'organizations', activeOrgId), { onboarded: true });
            }
            router.push('/workspace');
          }}
          className="ml-auto text-[12px] text-[#cfcfcf] hover:text-[#9a9a9a] transition-colors"
        >
          Пропустити
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-[480px]">

          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((s, i) => {
              const done    = i < step;
              const current = i === step;
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-[5px] rounded-full text-[12px] font-semibold transition-all ${
                    done    ? 'text-[#10b981]' :
                    current ? 'text-[#1f1f1f] bg-white border border-[#e9e9e9] shadow-sm' :
                              'text-[#cfcfcf]'
                  }`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                      done    ? 'bg-[#10b981] text-white' :
                      current ? 'bg-[#1f1f1f] text-white' :
                                'bg-[#f0f0f0] text-[#cfcfcf]'
                    }`}>
                      {done ? <Check size={9} /> : i + 1}
                    </div>
                    {s.title}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-[1px] ${i < step ? 'bg-[#10b981]' : 'bg-[#e9e9e9]'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step 0: Org name ── */}
          {step === 0 && (
            <div className="bg-white border border-[#e9e9e9] rounded-[20px] p-8 shadow-sm">
              <h1 className="text-[22px] font-bold text-[#1f1f1f] mb-2">Як називається ваша організація?</h1>
              <p className="text-[14px] text-[#9a9a9a] mb-7 leading-relaxed">
                Назва буде видна вашій команді і клієнтам у порталі.
              </p>

              <div className="mb-6">
                <label className="text-[11px] font-bold text-[#9a9a9a] uppercase tracking-wider mb-2 block">
                  Назва
                </label>
                <input
                  autoFocus
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && orgName.trim()) saveOrg(); }}
                  placeholder="Studio One, PixelCraft Agency..."
                  className="w-full text-[15px] font-medium bg-[#f7f7f7] border border-[#e9e9e9] rounded-[10px] px-4 py-[12px] outline-none focus:border-[#1f1f1f] focus:bg-white transition-all"
                />
              </div>

              <button
                onClick={saveOrg}
                disabled={!orgName.trim() || saving}
                className="flex items-center justify-center gap-2 w-full py-[13px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-semibold hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
              >
                {saving ? 'Збереження...' : 'Далі'}
                {!saving && <ArrowRight size={15} />}
              </button>
            </div>
          )}

          {/* ── Step 1: Plan selection ── */}
          {step === 1 && (
            <div className="bg-white border border-[#e9e9e9] rounded-[20px] p-8 shadow-sm">
              <h1 className="text-[22px] font-bold text-[#1f1f1f] mb-2">Оберіть тариф</h1>
              <p className="text-[14px] text-[#9a9a9a] mb-7 leading-relaxed">
                Почніть з безкоштовного плану або розблокуйте всі можливості одразу.
              </p>

              <div className="flex flex-col gap-4 mb-6">
                {[
                  { id: 'free', name: 'Free', price: '$0', desc: 'До 3 активних проєктів, базові функції.', icon: <Check size={16} className="text-[#9a9a9a]" /> },
                  { id: 'pro', name: 'Pro', price: '$15', desc: 'Необмежені проєкти, аналітика, повний контроль.', icon: <Check size={16} className="text-[#6366f1]" /> },
                ].map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`flex items-start gap-4 p-5 rounded-[16px] border-2 text-left transition-all ${
                      selectedPlan === plan.id
                        ? 'border-[#1f1f1f] bg-[#1f1f1f]/5'
                        : 'border-[#f0f0f0] hover:border-[#cfcfcf]'
                    }`}
                  >
                    <div className={`mt-1 w-[20px] h-[20px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedPlan === plan.id ? 'border-[#1f1f1f]' : 'border-[#cfcfcf]'
                    }`}>
                      {selectedPlan === plan.id && <div className="w-[10px] h-[10px] bg-[#1f1f1f] rounded-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[16px] font-bold ${selectedPlan === plan.id ? 'text-[#1f1f1f]' : 'text-[#4a4a4a]'}`}>{plan.name}</span>
                        <span className="text-[14px] font-bold text-[#1f1f1f]">{plan.price}<span className="text-[#9a9a9a] text-[12px] font-normal">/міс</span></span>
                      </div>
                      <p className="text-[13px] text-[#9a9a9a]">{plan.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(0)}
                  className="px-5 py-[13px] bg-[#f7f7f7] border border-[#e9e9e9] text-[#9a9a9a] rounded-[12px] text-[14px] font-semibold hover:bg-[#f0f0f0] transition-colors">
                  ←
                </button>
                <button
                  onClick={finish}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-[13px] bg-[#1f1f1f] text-white rounded-[12px] text-[14px] font-semibold hover:bg-[#2a2a2a] transition-colors disabled:opacity-40"
                >
                  {saving ? 'Збереження...' : 'Увійти у Workspace'}
                  {!saving && <ArrowRight size={15} />}
                </button>
              </div>
            </div>
          )}



          {/* Bottom note */}
          <p className="text-center text-[11px] text-[#cfcfcf] mt-6">
            Усе це можна змінити пізніше в Налаштуваннях
          </p>

        </div>
      </div>
    </div>
  );
}
