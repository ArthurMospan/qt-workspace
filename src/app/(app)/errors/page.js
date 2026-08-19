'use client';

// src/app/(app)/errors/page.js — what broke for somebody, and what they said.
//
// Not a workspace feature and deliberately not in the navigation: this is the
// other end of the «Повідомити про помилку» button on a failure toast. Before
// it existed, a failure was a sentence on screen for a few seconds and then
// nothing — whatever the browser knew went to a console nobody had open, and
// the only channel back was the person retyping it into a chat.
//
// Owner only, enforced by the route that serves it. A report carries somebody's
// screen, path and failure, which is not something a workspace shows its members.

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { fetchErrorReports } from '@/lib/services/errorReports';
import { EmptyState, LoadingSpinner, PageHeader, Pill, Surface } from '@/components/ui';
import Button from '@/components/ui/Button';
import useWorkspaceStore from '@/store/useWorkspaceStore';

function whenLabel(iso) {
  if (!iso) return '';
  const at = new Date(iso);
  return at.toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export default function ErrorReportsPage() {
  const { activeOrgId, orgRole } = useAppContext();
  const setBreadcrumbs = useWorkspaceStore(state => state.setBreadcrumbs);
  // One piece of state, because «loading» and «error» and «reports» are three
  // facets of one answer and three separate updates could disagree about it.
  const [answer, setAnswer] = useState({ status: 'loading', reports: [], error: '' });
  const { status, reports, error } = answer;
  const loading = status === 'loading';

  useEffect(() => {
    setBreadcrumbs([{ label: 'Звіти про помилки' }]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs]);

  const load = useCallback(async () => {
    if (!activeOrgId) return;
    setAnswer(current => ({ ...current, status: 'loading' }));
    try {
      setAnswer({ status: 'ready', reports: await fetchErrorReports(activeOrgId), error: '' });
    } catch (loadError) {
      setAnswer({
        status: 'failed',
        reports: [],
        error: loadError.message || 'Не вдалося прочитати звіти',
      });
    }
  }, [activeOrgId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => { if (!cancelled) await load(); })();
    return () => { cancelled = true; };
  }, [load]);

  if (orgRole && orgRole !== 'owner') {
    return (
      <div className="p-6">
        <EmptyState
          icon={AlertCircle}
          title="Сторінка доступна лише власнику"
          description="Звіти про помилки містять шлях і екран конкретної людини."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <PageHeader
        title="Звіти про помилки"
        actions={(
          <Button style="ghost" size="md" icon={RefreshCw} onClick={load} disabled={loading}>
            Оновити
          </Button>
        )}
      />

      <p className="text-[12px] text-muted">
        Надіслані з тоста «Повідомити про помилку». Сто найновіших.
      </p>

      {loading && reports.length === 0 ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState icon={AlertCircle} title="Не вдалося прочитати звіти" description={error} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Порожньо"
          description="Нічого не зламалось, або ніхто ще не натиснув «Повідомити про помилку»."
        />
      ) : (
        <div className="qt-nav-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto custom-scrollbar">
          {reports.map(report => (
            <Surface key={report.id} padding="md">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{report.message}</span>
                {report.context && <Pill size="sm">{report.context}</Pill>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                <span>{report.reportedByName || 'Учасник'}</span>
                <span>·</span>
                <span>{whenLabel(report.createdAt)}</span>
                {report.path && (
                  <>
                    <span>·</span>
                    <code className="font-mono text-[11px] text-ink">{report.path}</code>
                  </>
                )}
              </div>
              {report.note && (
                <p className="mt-2 text-[13px] text-ink">{report.note}</p>
              )}
              {report.detail && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-[10px] bg-canvas p-3 font-mono text-[11px] text-muted">
                  {report.detail}
                </pre>
              )}
              {report.userAgent && (
                <p className="mt-2 truncate text-[11px] text-faint" title={report.userAgent}>
                  {report.userAgent}
                </p>
              )}
            </Surface>
          ))}
        </div>
      )}
    </div>
  );
}
