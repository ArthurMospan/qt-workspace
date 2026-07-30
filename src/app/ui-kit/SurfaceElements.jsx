'use client';

// One product surface and the elements it is built from.
//
// These 145 controls used to be one flat "bypassing the kit" list, which was
// unreadable: no icons, no backdrop, a stray word of text, and no clue which
// screen anything came from. They are not strays — they are the working parts
// of Calendar, Tasks, the shell and the rest. Each surface now gets a section
// of its own, the way chat does, so a control is seen next to the ones it
// works with.
//
// The classification says what each should become in the kit, and it defaults
// to the surface itself: a calendar control most likely becomes a calendar
// element, not a generic one.

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, Counter, Surface } from '@/components/ui';
import LiveControl, { backdropFor, controlIdentity } from './LiveControl';
import audit from './fidelity-audit.generated.json';

const STORAGE_KEY = 'qt-kit-surface-elements-v1';
const CONTROLS = audit.nativeControls || [];

const CHOICES = [
  { id: 'surface', label: 'Елемент цієї поверхні', hint: 'Оформити як компонент саме цієї структури, поруч із її іншими елементами', tone: '#0369a1', bg: '#f0f9ff' },
  { id: 'duplicate', label: 'Дублікат кіту', hint: 'Те саме вже є у кіті — замінити на наявний компонент', tone: '#b91c1c', bg: '#fef2f2' },
  { id: 'shared', label: 'Спільний компонент', hint: 'Трапляється на кількох поверхнях — виносити в загальний кіт', tone: '#7c3aed', bg: '#f5f3ff' },
  { id: 'exception', label: 'Виняток', hint: 'Службовий, нативний або одноразовий — у кіт не йде', tone: '#71717a', bg: '#f4f4f5' },
];

const DYNAMIC_ROUTES = {
  '/[projectId]': '/',
  '/[projectId]/issue/[issueId]': '/',
  '/[projectId]/portal': '/',
  '/analytics/team/[memberId]': '/analytics',
  '/calendar/event/[eventId]': '/calendar',
};

export default function SurfaceElements({ structure }) {
  const [answers, setAnswers] = useState({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration-safe restore
      if (saved) setAnswers(JSON.parse(saved));
    } catch { /* a blocked store just means starting fresh */ }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch { /* storage is a convenience, never a requirement */ }
  }, [answers]);

  const label = audit.structureLabels?.[structure] || structure;
  const controls = useMemo(
    () => CONTROLS.filter(control => control.structure === structure),
    [structure],
  );

  const byFile = useMemo(() => {
    const groups = new Map();
    for (const control of controls) {
      const file = control.location.split(':')[0];
      if (!groups.has(file)) groups.set(file, []);
      groups.get(file).push(control);
    }
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [controls]);

  const routes = useMemo(
    () => [...new Set(controls.flatMap(control => control.routes))].sort(),
    [controls],
  );

  const answered = controls.filter(control => answers[control.location]).length;
  const setAnswer = (location, id) => setAnswers(current => ({ ...current, [location]: id }));
  const answerAll = id => setAnswers(current => {
    const next = { ...current };
    for (const control of controls) next[control.location] = id;
    return next;
  });

  const copyPrompt = async () => {
    const lines = [
      `# ${label} — власні елементи`,
      '',
      'Джерело: src/app/ui-kit/fidelity-audit.generated.json (npm run kit:audit).',
      `${controls.length} контролів цієї поверхні написані власною розміткою.`,
      `Екрани: ${routes.join(', ') || 'спільні'}`,
      '',
    ];
    for (const choice of CHOICES) {
      const items = controls.filter(control => answers[control.location] === choice.id);
      if (!items.length) continue;
      lines.push(`## ${choice.label} (${items.length})`);
      lines.push(`_${choice.hint}_`);
      for (const control of items) {
        lines.push(`- \`${control.tag}\` ${control.location} — ${controlIdentity(control)}`);
      }
      lines.push('');
    }
    lines.push('## Кроки');
    lines.push(`- Компоненти цієї поверхні класти поруч, як зроблено для чату (chat-* токени у Button/UserAvatar/globals.css)`);
    lines.push('- Кожен новий компонент: src/components/ui, експорт у index.js, preview в /ui-kit — в одній зміні');
    lines.push('- npm run kit:scan, npm run kit:audit, npm run lint, npm run test:unit');
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (controls.length === 0) {
    return <p className="text-[12px] text-muted">Ця поверхня не має власних нативних контролів.</p>;
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Surface preset="bordered-panel" padding="lg">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-[780px]">
            <h2 className="text-[18px] font-bold text-ink">{label} — власні елементи</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {controls.length} інтерактивних елементів цієї поверхні написані власною розміткою,
              а не компонентом кіту. Кожен показаний живим — своїми класами та своєю іконкою.
              Це не «сміття до прибирання»: так само, як чат, ця поверхня може мати власні
              компоненти в кіті.
            </p>
            {routes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {routes.map(route => (
                  <a
                    key={route}
                    href={DYNAMIC_ROUTES[route] || route}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-[5px] bg-white px-[6px] py-[2px] font-mono text-[10px] font-semibold text-ink hover:bg-ink hover:text-white"
                  >
                    {route}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-white px-3 py-2">
            <Counter value={answered} size="sm" status={answered === controls.length ? 'success' : 'info'} />
            <span className="text-[11px] font-bold text-ink">з {controls.length}</span>
          </div>
        </div>
      </Surface>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold text-muted">Усій поверхні:</span>
        {CHOICES.map(choice => (
          <button
            key={choice.id}
            type="button"
            onClick={() => answerAll(choice.id)}
            title={choice.hint}
            className="cursor-pointer rounded-[6px] px-2 py-1 text-[10px] font-bold"
            style={{ color: choice.tone, backgroundColor: choice.bg }}
          >
            {choice.label}
          </button>
        ))}
      </div>

      {byFile.map(([file, items]) => (
        <section key={file} className="rounded-[14px] border border-line bg-white">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="font-mono text-[11px] font-bold text-ink">{file.replace('src/', '')}</span>
            <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted">{items.length}</span>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {items.map(control => {
              const answer = answers[control.location];
              return (
                <div key={control.location} className="rounded-[10px] border border-line p-2.5">
                  <div className={`relative isolate mb-2 flex min-h-[52px] items-center justify-center gap-2 overflow-hidden rounded-[8px] p-3 ${backdropFor(control)}`}>
                    <LiveControl control={control} />
                  </div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-1.5">
                    <span className="text-[11px] font-bold text-ink">{controlIdentity(control)}</span>
                    <span className="font-mono text-[9px] text-faint">
                      {control.tag} · :{control.location.split(':')[1]}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CHOICES.map(choice => (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setAnswer(control.location, choice.id)}
                        aria-pressed={answer === choice.id}
                        title={choice.hint}
                        className={`flex cursor-pointer items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold transition-all ${
                          answer === choice.id ? 'ring-2 ring-ink/20' : 'opacity-55 hover:opacity-100'
                        }`}
                        style={{ color: choice.tone, backgroundColor: choice.bg }}
                      >
                        {answer === choice.id && <Check size={8} strokeWidth={3} />}
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex justify-end">
        <Button style="primary" size="md" icon={copied ? Check : Copy} onClick={copyPrompt}>
          {copied ? 'Скопійовано' : `Скопіювати промпт (${answered}/${controls.length})`}
        </Button>
      </div>
    </div>
  );
}
