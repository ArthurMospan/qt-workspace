'use client';
// src/components/OrgSwitcherScreen.jsx
// Full-screen org picker — Windows account-switcher style.
// Shown when user has multiple orgs or clicks "Switch org" in sidebar.
import { useState } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useRouter } from 'next/navigation';
import { Building2, Crown, Shield, User, Plus, Check, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const PLAN_BADGE = {
  pro:  { label: 'PRO',  bg: 'bg-[#eab308]', text: 'text-white' },
  free: { label: 'FREE', bg: 'bg-[#e9e9e9]', text: 'text-[#9a9a9a]' },
};

const ROLE_ICON = {
  owner:  Crown,
  admin:  Shield,
  member: User,
};

function OrgCard({ org, role, active, onClick }) {
  const plan  = PLAN_BADGE[org.plan] || PLAN_BADGE.free;
  const Icon  = ROLE_ICON[role] || User;
  const firstLetter = (org.name || 'О')[0].toUpperCase();

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-[16px] text-left transition-all duration-200 group ${
        active
          ? 'bg-[#f5f5f5]'
          : 'bg-white hover:bg-[#fafafa]'
      }`}
    >
      {/* Org avatar (Circle) */}
      <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 overflow-hidden border ${
        active ? 'bg-white border-[#e0e0e0] shadow-sm' : 'bg-[#f7f7f7] border-[#f0f0f0] group-hover:bg-white'
      }`}>
        {org.logoUrl ? (
          <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[16px] font-bold text-[#1f1f1f]">{firstLetter}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-bold text-[#1f1f1f] truncate">{org.name || 'Без назви'}</p>
          {active && (
            <span className="shrink-0 text-[10px] font-bold text-[#1f1f1f] bg-white border border-[#e9e9e9] px-2 py-[2px] rounded-full shadow-sm">
              Активна
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-[12px] text-[#9a9a9a] mt-[2px]">
          <span className="capitalize">{role || 'member'}</span>
          {org.members?.length > 0 && (
            <>
              <span className="text-[#e0e0e0]">·</span>
              <span>{org.members.length} учасник{org.members.length === 1 ? '' : 'ів'}</span>
            </>
          )}
        </div>
      </div>

      {/* Active check */}
      <div className="shrink-0 pl-2">
        {active && (
          <Check size={18} className="text-[#1f1f1f]" />
        )}
      </div>
    </button>
  );
}

export default function OrgSwitcherScreen({ onClose }) {
  const { allOrgs, activeOrgId, switchOrg, currentUser } = useAppContext();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSelect = (orgId) => {
    if (orgId === activeOrgId) { onClose?.(); return; }
    switchOrg(orgId);
    onClose?.();
    router.push('/workspace');
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim() || saving) return;
    setSaving(true);
    try {
      const uid = currentUser?.id || currentUser?.uid;
      const newOrgId = `org_${uid?.slice(0, 8)}_${Date.now()}`;
      
      const batch = writeBatch(db);
      
      batch.set(doc(db, 'organizations', newOrgId), {
        id: newOrgId,
        name: newOrgName.trim(),
        plan: 'free',
        limits: { maxProjects: 3, maxMembers: null },
        ownerId: uid,
        onboarded: false,
        createdAt: serverTimestamp(),
      });
      
      batch.set(doc(db, 'orgMemberships', `${newOrgId}_${uid}`), {
        id: `${newOrgId}_${uid}`,
        orgId: newOrgId,
        userId: uid,
        role: 'owner',
        joinedAt: new Date().toISOString(),
        hourlyRate: 0
      });
      
      await batch.commit();
      window.location.href = '/onboarding';
    } catch (err) {
      console.error('[OrgSwitcher] create org error:', err);
    }
    setSaving(false);
  };

  const getRoleInOrg = (org) => {
    return org.id === activeOrgId ? (useAppContext().orgRole || 'member') : 'member';
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl overflow-hidden border border-[#f0f0f0] flex flex-col animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-[24px] pt-[24px] pb-[16px] flex flex-col items-center border-b border-[#f0f0f0]">
          <h1 className="text-[18px] font-bold text-[#1f1f1f]">Ваші організації</h1>
          <p className="text-[13px] text-[#9a9a9a] mt-1">{currentUser?.email}</p>
        </div>

        {/* Orgs list */}
        <div className="p-[16px] flex flex-col gap-1 max-h-[360px] overflow-y-auto custom-scrollbar">
          {allOrgs.map(org => (
            <OrgCard
              key={org.id}
              org={org}
              role={getRoleInOrg(org)}
              active={org.id === activeOrgId}
              onClick={() => handleSelect(org.id)}
            />
          ))}

          {/* Create new org */}
          {!creating ? (
            <button
              onClick={() => setCreating(true)}
              className="mt-2 mx-auto flex items-center justify-center gap-[6px] py-[8px] px-[16px] text-[12px] font-semibold text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f7f7f7] rounded-full transition-colors"
            >
              <Plus size={14} />
              Створити нову організацію
            </button>
          ) : (
            <div className="mt-2 bg-[#f7f7f7] border border-[#e9e9e9] rounded-[16px] p-4 animate-in slide-in-from-top-2 duration-200">
              <p className="text-[11px] font-bold text-[#9a9a9a] mb-2 uppercase tracking-wider">Нова організація</p>
              <input
                autoFocus
                value={newOrgName}
                onChange={e => setNewOrgName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateOrg(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Введіть назву..."
                className="w-full text-[14px] bg-white border border-[#e9e9e9] rounded-[10px] px-3 py-2 outline-none focus:border-[#1f1f1f] transition-colors mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setCreating(false); setNewOrgName(''); }}
                  className="flex-1 py-[8px] rounded-[8px] text-[12px] font-bold text-[#9a9a9a] bg-white border border-[#e9e9e9] hover:bg-[#f0f0f0] transition-colors"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleCreateOrg}
                  disabled={!newOrgName.trim() || saving}
                  className="flex-1 py-[8px] rounded-[8px] text-[12px] font-bold text-white bg-[#1f1f1f] hover:bg-[#303030] disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Створення...' : 'Створити'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Prominent Back Button */}
        {onClose && (
          <div className="p-[16px] border-t border-[#f0f0f0] bg-[#fafafa]">
            <button
              onClick={onClose}
              className="w-full py-[12px] rounded-[14px] text-[14px] font-bold text-[#1f1f1f] bg-white border border-[#e9e9e9] hover:bg-[#f5f5f5] hover:border-[#d0d0d0] shadow-sm transition-all"
            >
              Назад
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
