'use client';

// src/app/errors/page.js — what broke for somebody, and what they said.
//
// The other end of the «Повідомити про помилку» button on a failure toast.
// Before it existed a failure was a sentence on screen for a few seconds and
// then nothing: whatever the browser knew went to a console nobody had open,
// and the only channel back was the person retyping it into a chat.
//
// Deliberately outside the workspace — outside `(app)`, out of the navigation,
// with no organization and no session. It used to live inside and be shown to
// «власник організації», which reads as the right person only while there is
// one organization and it is ours: the owner of a customer's workspace is not
// the person who fixes anything, and the person who does would have had to walk
// every workspace to find their own bug list.
//
// So the door is a password, checked on the server (`ERROR_REPORTS_PASSWORD`)
// and never shipped here. Nothing on this page is readable before it is
// answered, because the reports are never fetched until it is.

import { useState } from 'react';
import { AlertCircle, KeyRound, RefreshCw } from 'lucide-react';
import { fetchErrorReports } from '@/lib/services/errorReports';
import { Button, EmptyState, Input, Pill, Surface } from '@/components/ui';

function whenLabel(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('uk-UA', {
    day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });
}

export default function ErrorReportsPage() {
  const [password, setPassword] = useState('');
  // One piece of state, because «loading» and «error» and «reports» are three
  // facets of one answer and three separate updates could disagree about it.
  const [answer, setAnswer] = useState({ status: 'locked', reports: [], error: '' });
  const { status, reports, error } = answer;

  const load = async (candidate) => {
    if (!candidate) return;
    setAnswer(current => ({ ...current, status: 'loading', error: '' }));
    try {
      setAnswer({ status: 'ready', reports: await fetchErrorReports(candidate), error: '' });
    } catch (loadError) {
      setAnswer({ status: 'locked', reports: [], error: loadError.message || 'Не вдалося прочитати звіти' });
    }
  };

  // The password is never written anywhere — not a cookie, not storage. It
  // lives in this component for as long as the tab is open on this page, which
  // is the whole visit, and a refresh asks again.

  if (status !== 'ready') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas p-6">
        <Surface preset="card" padding="lg" className="w-full max-w-[360px]">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound size={16} className="text-muted" />
            <h1 className="ui-type-section-title text-ink">Звіти про помилки</h1>
          </div>
          <p className="mb-4 text-[12px] text-muted">
            Службова сторінка. Введіть пароль, щоб побачити, що надсилали з тостів.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={event => { event.preventDefault(); void load(password); }}
          >
            <Input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Пароль"
              aria-label="Пароль"
              autoFocus
              error={Boolean(error)}
            />
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <Button
              style="primary"
              size="md"
              type="submit"
              loading={status === 'loading'}
              disabled={!password.trim() || status === 'loading'}
            >
              Відкрити
            </Button>
          </form>
        </Surface>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[880px] flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="ui-type-section-title text-ink">Звіти про помилки</h1>
        <Button style="ghost" size="md" icon={RefreshCw} onClick={() => void load(password)}>
          Оновити
        </Button>
      </div>

      <p className="text-[12px] text-muted">
        Надіслані з тоста «Повідомити про помилку», з усіх робочих просторів. Сто найновіших.
      </p>

      {reports.length === 0 ? (
        <EmptyState
          icon={AlertCircle}
          title="Порожньо"
          description="Нічого не зламалось, або ніхто ще не натиснув «Повідомити про помилку»."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map(report => (
            <Surface key={report.id} padding="md">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-semibold text-ink">{report.message}</span>
                {report.context && <Pill size="sm">{report.context}</Pill>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                <span>{report.reportedByName || 'Учасник'}</span>
                {report.organizationName && (
                  <>
                    <span>·</span>
                    <span>{report.organizationName}</span>
                  </>
                )}
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
    </main>
  );
}
