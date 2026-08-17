import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Clock, Hash } from 'lucide-react';
import { TaskIcon } from '@/lib/design/icons';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';
import { useAppContext } from '@/lib/context/AppContext';
import Pill from '@/components/ui/DataDisplay/Pill';
import {
  legacyStoredIssueKey,
  normalizeIssuePrefix,
  projectIssuePrefix,
  taskDisplayKey,
} from '@/lib/utils/issueKeys.mjs';
import { toLocalDateInput } from '@/lib/utils/date';
import { organizationTimeZone } from '@/lib/utils/timeZone.mjs';
import { useLocalization } from '@/lib/hooks/useLocalization';
import { formatLastSeenUk, isPresenceOnline } from '@/lib/utils/presence.mjs';
import useWorkspaceStore from '@/store/useWorkspaceStore';

// The one shape a mention has, whoever it names.
const MENTION_CHIP = 'inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full bg-black/[0.07] px-1.5 py-0.5 align-middle font-semibold text-ink transition-colors hover:bg-black/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20';

const ORGANIZATION_ROLE_LABELS = {
  owner: 'Власник',
  admin: 'Адміністратор',
  member: 'Учасник',
};

function findMember(members, value) {
  const normalizedValue = decodeURIComponent(String(value || ''))
    .replace(/^@/, '')
    .replace(/_/g, ' ')
    .trim()
    .toLocaleLowerCase('uk-UA');

  return (members || []).find(member => {
    const candidates = [
      member.id,
      member.uid,
      member.name,
      member.displayName,
      member.email,
    ].filter(Boolean);
    return candidates.some(candidate =>
      String(candidate).replace(/_/g, ' ').trim().toLocaleLowerCase('uk-UA') === normalizedValue
    );
  });
}

export default function HoverCard({ type, value, children, members }) {
  const { activeOrgId, activeOrg, currentUser, projects = [] } = useAppContext();
  const timeZone = organizationTimeZone(activeOrg);
  const { formatDate } = useLocalization();
  const router = useRouter();
  const openIssueQuickView = useWorkspaceStore(state => state.openIssueQuickView);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [show, setShow] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const openWhenReadyRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // A click starts the lookup and then the pointer leaves the chip, which used
  // to unmount the request mid-flight: `show` went false, the effect cleaned up,
  // and the answer was thrown away — so the click did nothing at all.
  useEffect(() => {
    if (!show && !openWhenReadyRef.current) return;
    let cancelled = false;
    
    // For user, data is usually already in members array
    if (type === 'user') {
      const u = findMember(members, value);
      queueMicrotask(() => {
        if (!cancelled) setData(u || { notFound: true });
      });
      return;
    }

    // For issue, fetch from firestore if not loaded
    if (type === 'issue' && activeOrgId) {
      queueMicrotask(() => { if (!cancelled) setLoading(true); });
      const keyPrefix = String(value || '').match(/^([\p{L}\p{N}]+)-\d+$/u)?.[1] || '';
      const expectedProject = projects.find(project => (
        projectIssuePrefix(project) === normalizeIssuePrefix(keyPrefix)
      ));
      const loadIssue = async issueKey => {
        if (!issueKey) return null;
        const snap = await getDocs(query(
          collection(db, 'issues'),
          where('organizationId', '==', activeOrgId),
          where('issueKey', '==', issueKey),
          limit(10),
        ));
        const matchingDocument = expectedProject
          ? snap.docs.find(document => document.data().projectId === expectedProject.id)
          : snap.docs[0];
        // The document id last: a stored `id` field would otherwise shadow it,
        // and the panel opens by document id.
        return matchingDocument
          ? { ...matchingDocument.data(), id: matchingDocument.id }
          : null;
      };

      // What is written in a message is the *display* key, and a project whose
      // prefix has ever changed does not store that string: `QT-12` sits in
      // Firestore as `WS-12`. `legacyStoredIssueKey` covers the one rename the
      // migration knows about; this covers the rest by asking the project the
      // prefix points at for the task whose displayed key is the one written.
      // It only runs when the direct hit misses, and it is one project's worth
      // of documents — the same set its own board loads.
      const loadByDisplayKey = async () => {
        if (!expectedProject) return null;
        const snap = await getDocs(query(
          collection(db, 'issues'),
          where('organizationId', '==', activeOrgId),
          where('projectId', '==', expectedProject.id),
        ));
        const wanted = String(value || '').trim().toLocaleUpperCase('uk-UA');
        const matchingDocument = snap.docs.find(document => {
          const stored = { id: document.id, ...document.data() };
          return taskDisplayKey(stored, expectedProject).toLocaleUpperCase('uk-UA') === wanted;
        });
        return matchingDocument
          ? { ...matchingDocument.data(), id: matchingDocument.id }
          : null;
      };

      loadIssue(value).then(async exactMatch => {
        const issue = exactMatch
          || await loadIssue(legacyStoredIssueKey(value, expectedProject))
          || await loadByDisplayKey();
        if (cancelled) return;
        setData(issue || { notFound: true });
        setLoading(false);
      }).catch(error => {
        if (cancelled) return;
        // «Not found» and «could not look» are different answers, and saying
        // the first when the second happened is what makes a lookup failure
        // impossible to report. The console keeps the cause; the card says
        // which of the two it was.
        console.error('[HoverCard] issue lookup failed', value, error);
        setData({ lookupFailed: true });
        setLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [show, type, value, members, activeOrgId, projects]);

  // A mention is read where it was written. Following one out of a conversation
  // used to cost the conversation: you came back to the chat scrolled somewhere
  // else, if you came back. The panel carries «на повній сторінці» for the
  // times the mention really was the start of a longer errand.
  useEffect(() => {
    if (!openWhenReadyRef.current || type !== 'issue' || !data) return;
    if (data.id && data.projectId) openIssueQuickView(data);
    openWhenReadyRef.current = false;
  }, [data, openIssueQuickView, type]);

  const openIssue = () => {
    if (type !== 'issue') return;
    if (data?.id && data?.projectId) {
      openIssueQuickView(data);
      return;
    }
    setShow(true);
    openWhenReadyRef.current = true;
  };

  const openUser = () => {
    if (type !== 'user') return;
    const user = data && !data.notFound ? data : findMember(members, value);
    const userId = user?.id || user?.uid;
    if (!userId) {
      setShow(true);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('member', userId);
    setShow(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  const currentUserId = currentUser?.id || currentUser?.uid;
  const hoveredUserId = data?.id || data?.uid;
  const isOnline = Boolean(
    data
    && !data.notFound
    && (
      hoveredUserId === currentUserId
      || data.online === true
      || isPresenceOnline(data.lastActive, now)
    )
  );
  const userSubtitle = data?.positionName
    || data?.title
    || ORGANIZATION_ROLE_LABELS[data?.role]
    || 'Учасник';

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {/* One chip, drawn here and nowhere else. A mentioned task and a
          mentioned person are the same kind of thing in a sentence — a name
          that opens something — so they read the same. The caller passes the
          contents (a face, or nothing) and never a second capsule around
          them, which is what put two of them around every @name. */}
      <button
        type="button"
        onClick={type === 'issue' ? openIssue : openUser}
        title={type === 'issue'
          ? `Переглянути ${value}`
          : `Відкрити профіль ${data?.name || value}`}
        className={MENTION_CHIP}
      >
        {type === 'issue' && <TaskIcon size={11} className="shrink-0 text-muted" />}
        {children}
      </button>

      {show && (
        <div data-ui-surface="local" className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-line rounded-[12px] shadow-xl p-3 text-left">
          {type === 'user' ? (
            data && !data.notFound ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <UserAvatar user={data} size="lg" />
                  <div>
                    <p className="text-[14px] font-bold text-ink leading-tight">{data.name || data.email}</p>
                    <p className="text-[11px] text-muted">{userSubtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted mt-1">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-[#10b981]' : 'bg-faint'}`} />
                  {formatLastSeenUk(data.lastActive, { now, online: isOnline })}
                </div>
              </div>
            ) : (
               <div className="text-[12px] text-muted">Користувача не знайдено</div>
            )
          ) : (
            // Issue
            loading ? (
              <div className="text-[12px] text-muted flex items-center justify-center py-2">
                 <div className="w-4 h-4 border-2 border-line border-t-ink rounded-full animate-spin" />
              </div>
            ) : data && !data.notFound ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[11px] font-bold text-muted">{data.issueKey}</span>
                  <Pill tone="neutral" size="sm">{data.status || data.columnId}</Pill>
                </div>
                <p className="text-[14px] font-bold text-ink leading-tight line-clamp-2">{data.title}</p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#f0f0f0]">
                  <div className="flex items-center gap-1">
                    <TaskIcon size={12} className="text-muted" />
                    <span className="text-[11px] font-medium text-ink">{data.type || 'Завдання'}</span>
                  </div>
                  {data.dueDate && (
                    <div className="flex items-center gap-1 text-[11px] text-muted">
                      <Clock size={12} />
                      {formatDate(toLocalDateInput(data.dueDate, { timeZone }))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[12px] text-muted">Задачу не знайдено</div>
            )
          )}
        </div>
      )}
    </div>
  );
}
