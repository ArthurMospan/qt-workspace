'use client';

// Invite-link landing: /invite/<token>. Not under the (app) group on purpose —
// the visitor may have no organization yet, and the workspace shell assumes
// one. Unauthenticated visitors go to /login and come back via ?next=.
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { auth } from '@/lib/firebase';

export default function InvitePage() {
  const { token } = useParams();
  const router = useRouter();
  const { currentUser, authLoading, switchOrg } = useAppContext();
  const [state, setState] = useState({ phase: 'working' }); // working | done | error
  const requested = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      router.replace(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    if (requested.current) return;
    requested.current = true;

    const accept = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const response = await fetch('/api/invitations/link/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ token }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Посилання недійсне або протерміноване');
        setState({ phase: 'done', orgName: result.organizationName, alreadyMember: result.alreadyMember });
        try { switchOrg?.(result.organizationId); } catch {}
        setTimeout(() => router.replace('/'), 1800);
      } catch (error) {
        setState({ phase: 'error', message: error.message });
      }
    };
    accept();
  }, [authLoading, currentUser, token, router, switchOrg]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101010] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
        {state.phase === 'working' && (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#6366f1]" />
            <h1 className="text-lg font-black text-ink">Приєднуємо вас до команди…</h1>
            <p className="mt-2 text-sm text-muted">Перевіряємо запрошення.</p>
          </>
        )}
        {state.phase === 'done' && (
          <>
            <CheckCircle2 className="mx-auto mb-4 h-8 w-8 text-emerald-500" />
            <h1 className="text-lg font-black text-ink">
              {state.alreadyMember ? 'Ви вже в цій команді' : 'Вітаємо в команді!'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {state.orgName ? `Організація «${state.orgName}». ` : ''}Переносимо у воркспейс…
            </p>
          </>
        )}
        {state.phase === 'error' && (
          <>
            <XCircle className="mx-auto mb-4 h-8 w-8 text-red-500" />
            <h1 className="text-lg font-black text-ink">Не вдалося приєднатися</h1>
            <p className="mt-2 text-sm text-muted">{state.message}</p>
            <button
              onClick={() => router.replace('/')}
              className="mt-6 w-full rounded-xl bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-black"
            >
              На головну
            </button>
          </>
        )}
      </div>
    </div>
  );
}
