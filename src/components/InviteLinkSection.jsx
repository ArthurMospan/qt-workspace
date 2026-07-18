'use client';

// Secure invite-by-link block used inside both invite dialogs (team page and
// settings). Asks the server to mint a link; the raw token exists only in the
// response and in the clipboard — see /api/invitations/link.
import { useState } from 'react';
import { Link2, Copy, Check } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAppContext } from '@/lib/context/AppContext';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { Button } from '@/components/ui';

export default function InviteLinkSection({ role = 'member' }) {
  const { activeOrgId } = useAppContext();
  const showToast = useWorkspaceStore(s => s.showToast);
  const [link, setLink] = useState(null); // { url, expiresAt, maxUses, role }
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);

  const createLink = async () => {
    if (!activeOrgId) return;
    setCreating(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/invitations/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ organizationId: activeOrgId, role }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не вдалося створити посилання');
      setLink(result);
      setCopied(false);
    } catch (error) {
      showToast(error.message || 'Не вдалося створити посилання', 'error');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      showToast('Посилання скопійовано ✓', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Не вдалося скопіювати', 'error');
    }
  };

  return (
    <div className="border-t border-line pt-4 mt-1">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={14} className="text-muted" />
        <span className="text-[12px] font-bold text-muted">Або поділіться посиланням</span>
      </div>
      {link ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink"
            />
            <Button onClick={copyLink} style="secondary" size="sm" icon={copied ? Check : Copy}>
              {copied ? 'Готово' : 'Копіювати'}
            </Button>
          </div>
          <p className="text-[11px] text-muted">
            Роль: {link.role === 'admin' ? 'адміністратор' : 'учасник'} · діє 7 днів ·
            до {link.maxUses} використань. Посилання можна відкликати, видаливши запрошення.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Button onClick={createLink} loading={creating} disabled={creating} style="secondary" size="sm" icon={Link2}>
            Створити посилання-запрошення
          </Button>
          <p className="text-[11px] text-muted">
            Одноразово згенероване безпечне посилання: роль зафіксована, термін дії обмежений.
          </p>
        </div>
      )}
    </div>
  );
}
