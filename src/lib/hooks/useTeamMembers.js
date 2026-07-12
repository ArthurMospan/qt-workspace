'use client';

// src/lib/hooks/useTeamMembers.js — Fetch user profiles for a list of UIDs
import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { fetchOrganizationMembers } from '@/lib/services/members';
export function useTeamMembers(teamUids) {
  const { activeOrgId } = useAppContext();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = teamUids?.join(',') ?? '';
  useEffect(() => {
    if (!key || !activeOrgId) {
      queueMicrotask(() => {
        setMembers([]);
        setLoading(false);
      });
      return;
    }
    const uids = key ? key.split(',') : [];
    let active = true;
    queueMicrotask(() => setLoading(true));
    fetchOrganizationMembers(activeOrgId)
      .then(results => {
        if (active) setMembers(results.filter(member => uids.includes(member.id || member.uid)));
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [activeOrgId, key]);
  return {
    members,
    loading
  };
}
