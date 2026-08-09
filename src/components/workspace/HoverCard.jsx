import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/lib/utils/issueKeys.mjs';

export default function HoverCard({ type, value, children, members }) {
  const { activeOrgId, projects = [] } = useAppContext();
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const openWhenReadyRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    
    // For user, data is usually already in members array
    if (type === 'user') {
      const normalizedValue = decodeURIComponent(String(value || ''))
        .replace(/^@/, '')
        .replace(/_/g, ' ')
        .trim()
        .toLocaleLowerCase('uk-UA');
      const u = (members || []).find(member => {
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
        return matchingDocument
          ? { id: matchingDocument.id, ...matchingDocument.data() }
          : null;
      };
      loadIssue(value).then(async exactMatch => {
        const issue = exactMatch || await loadIssue(
          legacyStoredIssueKey(value, expectedProject),
        );
        if (cancelled) return;
        if (issue) {
          setData(issue);
        } else {
          setData({ notFound: true });
        }
        setLoading(false);
      }).catch(() => {
        if (cancelled) return;
        setData({ notFound: true });
        setLoading(false);
      });
    }
    return () => { cancelled = true; };
  }, [show, type, value, members, activeOrgId, projects]);

  useEffect(() => {
    if (!openWhenReadyRef.current || type !== 'issue' || !data) return;
    if (!data.notFound && data.id && data.projectId) {
      router.push(`/${data.projectId}/issue/${data.id}`);
    }
    openWhenReadyRef.current = false;
  }, [data, router, type]);

  const openIssue = () => {
    if (type !== 'issue') return;
    if (data && !data.notFound && data.id && data.projectId) {
      router.push(`/${data.projectId}/issue/${data.id}`);
      return;
    }
    setShow(true);
    openWhenReadyRef.current = true;
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {type === 'issue' ? (
        <button
          type="button"
          onClick={openIssue}
          title={`Відкрити ${value}`}
          className="rounded-sm bg-[#fdf4ff] px-1 font-medium text-[#c026d3] transition-colors hover:bg-[#fae8ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c026d3]/30"
        >
          {children}
        </button>
      ) : (
        <span className="cursor-pointer rounded-sm bg-canvas px-1 font-medium text-ink">
          {children}
        </span>
      )}

      {show && (
        <div data-ui-surface="local" className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-line rounded-[12px] shadow-xl p-3 text-left">
          {type === 'user' ? (
            data && !data.notFound ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <UserAvatar user={data} size="lg" />
                  <div>
                    <p className="text-[14px] font-bold text-ink leading-tight">{data.name || data.email}</p>
                    <p className="text-[11px] text-muted">{data.role || 'Учасник'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted mt-1">
                  <span className={`w-2 h-2 rounded-full ${data.lastActive && (now - new Date(data.lastActive).getTime() < 15 * 60 * 1000) ? 'bg-[#10b981]' : 'bg-faint'}`} />
                  {data.lastActive && (now - new Date(data.lastActive).getTime() < 15 * 60 * 1000) ? 'Онлайн' : 'Не в мережі'}
                </div>
              </div>
            ) : (
               <div className="text-[12px] text-muted">Користувача не знайдено</div>
            )
          ) : (
            // Issue
            loading ? (
              <div className="text-[12px] text-muted flex items-center justify-center py-2">
                 <div className="w-4 h-4 border-2 border-line border-t-[#c026d3] rounded-full animate-spin" />
              </div>
            ) : data && !data.notFound ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                  <Pill tone="accent" size="sm">{data.issueKey}</Pill>
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
                      {data.dueDate.toDate ? data.dueDate.toDate().toLocaleDateString() : new Date(data.dueDate).toLocaleDateString()}
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
