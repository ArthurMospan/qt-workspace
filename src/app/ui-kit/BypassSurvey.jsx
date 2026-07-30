'use client';

// Every interactive element on the site that does not come from the kit.
//
// 145 of them: 124 raw <button>, 15 <input>, 6 <textarea>. This is the real
// reason the site and the catalogue still differ — variants are unified now,
// but a third of the interactive surface never went through the kit at all.
//
// Each row renders the element with its own className, so it looks exactly as
// it looks on the screen it came from. A file:line cannot answer "which button
// is this?"; a live render can. The classification is a judgement call, so it
// is asked rather than guessed — `resembles` is only a hint from the audit.

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Filter } from 'lucide-react';
import { Button, Counter, Surface } from '@/components/ui';
import audit from './fidelity-audit.generated.json';

const STORAGE_KEY = 'qt-kit-bypass-survey-v1';

// Read once at module scope: this is generated data, not state, so deriving it
// inside the component only handed the hooks a new array every render.
const CONTROLS = audit.nativeControls || [];

const CHOICES = [
  { id: 'duplicate', label: 'Дублікат кіту', hint: 'Це те саме, що вже є — замінити на компонент кіту', tone: '#b91c1c', bg: '#fef2f2' },
  { id: 'atom', label: 'Новий атом', hint: 'Простий елемент, якого в кіті немає — додати як атом', tone: '#1d4ed8', bg: '#eff6ff' },
  { id: 'molecule', label: 'Молекула', hint: 'Складається з кількох елементів — додати як молекулу', tone: '#7c3aed', bg: '#f5f3ff' },
  { id: 'organism', label: 'Організм', hint: 'Великий блок зі своєю логікою — додати як організм', tone: '#0f766e', bg: '#f0fdfa' },
  { id: 'chat', label: 'Елемент чату', hint: 'Належить до чат-структури — оформити як чат-only елемент кіту', tone: '#0369a1', bg: '#f0f9ff' },
  { id: 'exception', label: 'Виняток', hint: 'Не входить у кіт: службовий, нативний або одноразовий', tone: '#71717a', bg: '#f4f4f5' },
];

const DYNAMIC_ROUTES = {
  '/[projectId]': { href: '/', hint: 'відкрий проєкт' },
  '/[projectId]/issue/[issueId]': { href: '/', hint: 'проєкт → задача' },
  '/[projectId]/portal': { href: '/', hint: 'проєкт → портал' },
  '/analytics/team/[memberId]': { href: '/analytics', hint: 'аналітика → учасник' },
  '/calendar/event/[eventId]': { href: '/calendar', hint: 'календар → подія' },
};

function RouteLink({ route }) {
  const dynamic = DYNAMIC_ROUTES[route];
  return (
    <a
      href={dynamic ? dynamic.href : route}
      target="_blank"
      rel="noreferrer"
      title={dynamic ? `${route} — ${dynamic.hint}` : `Відкрити ${route}`}
      className="inline-flex items-center gap-1 rounded-[5px] bg-[#f4f4f5] px-[5px] py-[1px] font-mono text-[9px] font-semibold text-[#1f1f1f] hover:bg-[#1f1f1f] hover:text-white"
    >
      {route}<ExternalLink size={8} />
    </a>
  );
}

// Classes that take an element out of the document flow. Rendering them here
// is not a preview, it is a trap: `absolute inset-0` on a file-card overlay
// escaped its row, covered the page and swallowed every click on this screen.
// The chrome that identifies the control — colour, radius, padding, type — is
// kept; only what would let it leave its cell is dropped.
const ESCAPES_ROW = /^(?:fixed|absolute|sticky|inset-|top-|bottom-|left-|right-|z-|translate-|-translate-|w-full|h-full|min-h-screen|w-screen|h-screen)/;

function containedClassName(className) {
  return String(className || '')
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !ESCAPES_ROW.test(token.replace(/^[a-z-]+:/, '')))
    .join(' ');
}

// The element as it actually renders, using the className it carries on the
// site. Icon children cannot be reproduced (the audit only knows their names),
// so a neutral square stands in for them at the right size.
function LiveElement({ control }) {
  const label = control.text || control.ariaLabel || '';
  const className = containedClassName(control.className);
  if (control.tag === 'input') {
    return <input className={className} placeholder={label || 'input'} readOnly />;
  }
  if (control.tag === 'textarea') {
    return <textarea className={className} placeholder={label || 'textarea'} readOnly rows={2} />;
  }
  if (control.tag === 'select') {
    return <select className={className}><option>{label || 'select'}</option></select>;
  }
  return (
    <button type="button" className={className} onClick={event => event.preventDefault()}>
      {control.childElements.length > 0 && (
        <span className="inline-block h-[13px] w-[13px] rounded-[3px] bg-current opacity-40" aria-hidden />
      )}
      {label}
    </button>
  );
}

export default function BypassSurvey() {
  const [answers, setAnswers] = useState({});
  const [route, setRoute] = useState('all');
  const [tag, setTag] = useState('all');
  const [structure, setStructure] = useState('all');
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
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

  const controls = CONTROLS;

  const routes = useMemo(() => {
    const counts = new Map();
    for (const control of controls) {
      for (const item of control.routes.length ? control.routes : ['(спільні)']) {
        counts.set(item, (counts.get(item) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [controls]);

  const visible = useMemo(() => controls.filter(control => {
    const inRoute = route === 'all'
      || (route === '(спільні)' ? control.routes.length === 0 : control.routes.includes(route));
    const inTag = tag === 'all' || control.tag === tag;
    const inStructure = structure === 'all'
      || (structure === 'chat' ? control.structure === 'chat' : !control.structure);
    const unanswered = !onlyUnanswered || !answers[control.location];
    return inRoute && inTag && inStructure && unanswered;
  }), [controls, route, tag, structure, onlyUnanswered, answers]);

  // Grouped by file: neighbouring controls in one file are usually the same
  // pattern repeated, which makes them far quicker to classify together.
  const grouped = useMemo(() => {
    const byFile = new Map();
    for (const control of visible) {
      const file = control.location.split(':')[0];
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(control);
    }
    return [...byFile.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [visible]);

  const answeredCount = controls.filter(control => answers[control.location]).length;

  const setAnswer = (location, choiceId) =>
    setAnswers(current => ({ ...current, [location]: choiceId }));

  const chatCount = controls.filter(control => control.structure === 'chat').length;
  const answerStructure = choiceId => setAnswers(current => {
    const next = { ...current };
    for (const control of controls) {
      if (control.structure === 'chat') next[control.location] = choiceId;
    }
    return next;
  });

  const answerFile = (file, choiceId) => setAnswers(current => {
    const next = { ...current };
    for (const control of controls) {
      if (control.location.split(':')[0] === file) next[control.location] = choiceId;
    }
    return next;
  });

  const buildPrompt = () => {
    const lines = [
      '# Елементи, що обходять UI Kit — класифікація',
      '',
      'Джерело: src/app/ui-kit/fidelity-audit.generated.json (npm run kit:audit).',
      `Усього ${controls.length} нативних контролів; класифіковано ${answeredCount}.`,
      '',
    ];
    for (const choice of CHOICES) {
      const items = controls.filter(control => answers[control.location] === choice.id);
      if (items.length === 0) continue;
      lines.push(`## ${choice.label} (${items.length})`);
      lines.push(`_${choice.hint}_`);
      for (const control of items) {
        const where = control.routes.length ? control.routes.join(', ') : 'спільний';
        lines.push(`- \`${control.tag}\` ${control.location} · ${where}`
          + (control.resembles ? ` · схоже на ${control.resembles}` : '')
          + (control.text || control.ariaLabel ? ` · «${control.text || control.ariaLabel}»` : ''));
      }
      lines.push('');
    }
    const left = controls.filter(control => !answers[control.location]);
    if (left.length) {
      lines.push(`## Не класифіковано (${left.length})`);
      for (const control of left.slice(0, 40)) lines.push(`- ${control.location}`);
      lines.push('');
    }
    lines.push('## Кроки після змін');
    lines.push('- Дублікати замінити на компонент кіту, не створюючи новий варіант');
    lines.push('- Нові атоми/молекули/організми: у src/components/ui, експорт у index.js, preview в /ui-kit — в одній зміні');
    lines.push('- Винятки позначити data-ui-control="<назва>" і описати в docs/UI_KIT_CONTRACT.md');
    lines.push('- npm run kit:scan, npm run kit:audit, npm run lint, npm run test:unit');
    return lines.join('\n');
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(buildPrompt());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Surface preset="bordered-panel" padding="lg">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="max-w-[820px]">
            <h2 className="text-[18px] font-bold text-ink">Обходять кіт</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              {controls.length} інтерактивних елементів написані сирим HTML, а не компонентом кіту:{' '}
              <b className="text-ink">{audit.nativeByTag.button} button</b>,{' '}
              <b className="text-ink">{audit.nativeByTag.input} input</b>,{' '}
              <b className="text-ink">{audit.nativeByTag.textarea} textarea</b>. Кожен рядок
              відрендерений з його власним className — тобто виглядає так, як на сторінці, звідки
              він узятий. Признач кожному тип; можна одним кліком призначити цілому файлу.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-[10px] bg-white px-3 py-2">
            <Counter value={answeredCount} size="sm" status={answeredCount === controls.length ? 'success' : 'info'} />
            <span className="text-[11px] font-bold text-ink">з {controls.length}</span>
          </div>
        </div>
      </Surface>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-muted" />
        <select
          value={route}
          onChange={event => setRoute(event.target.value)}
          aria-label="Екран"
          className="ui-control h-[32px] rounded-[8px] border border-line bg-white px-2 text-[12px] font-semibold text-ink"
        >
          <option value="all">Усі екрани ({controls.length})</option>
          {routes.map(([item, count]) => <option key={item} value={item}>{item} ({count})</option>)}
        </select>
        <select
          value={tag}
          onChange={event => setTag(event.target.value)}
          aria-label="Тег"
          className="ui-control h-[32px] rounded-[8px] border border-line bg-white px-2 text-[12px] font-semibold text-ink"
        >
          <option value="all">Усі теги</option>
          {Object.entries(audit.nativeByTag).filter(([, n]) => n > 0)
            .map(([item, count]) => <option key={item} value={item}>{item} ({count})</option>)}
        </select>
        <select
          value={structure}
          onChange={event => setStructure(event.target.value)}
          aria-label="Структура"
          className="ui-control h-[32px] rounded-[8px] border border-line bg-white px-2 text-[12px] font-semibold text-ink"
        >
          <option value="all">Усі структури</option>
          <option value="chat">Чат ({chatCount})</option>
          <option value="other">Поза чатом ({controls.length - chatCount})</option>
        </select>
        <button
          type="button"
          onClick={() => answerStructure('chat')}
          title={`Позначити всі ${chatCount} чатових контролів як елементи чату`}
          className="cursor-pointer rounded-[8px] px-3 py-1.5 text-[11px] font-bold"
          style={{ color: '#0369a1', backgroundColor: '#f0f9ff' }}
        >
          Уся чат-структура → елемент чату
        </button>
        <button
          type="button"
          onClick={() => setOnlyUnanswered(value => !value)}
          aria-pressed={onlyUnanswered}
          className={`cursor-pointer rounded-[8px] px-3 py-1.5 text-[11px] font-bold ${
            onlyUnanswered ? 'bg-ink text-white' : 'bg-white text-muted hover:text-ink'
          }`}
        >
          Лише некласифіковані
        </button>
        <span className="ml-auto text-[11px] text-faint">показано {visible.length}</span>
      </div>

      <div className="flex flex-col gap-[16px]">
        {grouped.map(([file, items]) => (
          <section key={file} className="rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
              <span className="font-mono text-[11px] font-bold text-ink">{file.replace('src/', '')}</span>
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-bold text-muted">
                {items.length}
              </span>
              <span className="ml-auto flex items-center gap-1">
                <span className="mr-1 text-[10px] text-faint">усьому файлу:</span>
                {CHOICES.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => answerFile(file, choice.id)}
                    title={`${choice.label} — усім ${items.length} у цьому файлі`}
                    className="cursor-pointer rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ color: choice.tone, backgroundColor: choice.bg }}
                  >
                    {choice.label}
                  </button>
                ))}
              </span>
            </div>

            <div className="flex flex-col divide-y divide-line">
              {items.map(control => {
                const answer = answers[control.location];
                const chosen = CHOICES.find(choice => choice.id === answer);
                return (
                  <div key={control.location} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-[4px] bg-canvas px-1.5 py-0.5 font-mono text-[9px] font-bold text-ink">
                        {control.tag}
                      </span>
                      {control.resembles && (
                        <span className="rounded-[4px] bg-[#fffbeb] px-1.5 py-0.5 text-[9px] font-semibold text-[#b45309]">
                          схоже на {control.resembles}
                        </span>
                      )}
                      {control.structure === 'chat' && (
                        <span className="rounded-[4px] bg-[#f0f9ff] px-1.5 py-0.5 text-[9px] font-bold text-[#0369a1]">
                          чат
                        </span>
                      )}
                      {control.reviewed && (
                        <span className="rounded-[4px] bg-[#ecfdf5] px-1.5 py-0.5 text-[9px] font-semibold text-[#047857]">
                          reviewed: {control.reviewed}
                        </span>
                      )}
                      {(control.routes.length ? control.routes : []).map(item => (
                        <RouteLink key={item} route={item} />
                      ))}
                      <span className="ml-auto font-mono text-[9px] text-faint">
                        :{control.location.split(':')[1]}
                      </span>
                    </div>

                    <div className="relative isolate flex flex-wrap items-center gap-3 overflow-hidden rounded-[10px] bg-canvas p-3">
                      <LiveElement control={control} />
                      {!control.text && !control.ariaLabel && (
                        <span className="text-[10px] text-faint">без підпису</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {CHOICES.map(choice => {
                        const selected = answer === choice.id;
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => setAnswer(control.location, choice.id)}
                            aria-pressed={selected}
                            title={choice.hint}
                            className={`flex cursor-pointer items-center gap-1 rounded-[6px] px-2 py-1 text-[10px] font-bold transition-all ${
                              selected ? 'ring-2 ring-ink/20' : 'opacity-60 hover:opacity-100'
                            }`}
                            style={{ color: choice.tone, backgroundColor: choice.bg }}
                          >
                            {selected && <Check size={9} strokeWidth={3} />}
                            {choice.label}
                          </button>
                        );
                      })}
                      {chosen && <span className="ml-1 text-[10px] text-faint">{chosen.hint}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {grouped.length === 0 && (
          <p className="text-[12px] text-muted">Нічого не знайдено за цим фільтром.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {answeredCount > 0 && (
          <Button style="secondary" size="md" onClick={() => setAnswers({})}>Скинути</Button>
        )}
        <Button style="primary" size="md" icon={copied ? Check : Copy} onClick={copyPrompt} className="ml-auto">
          {copied ? 'Скопійовано' : `Скопіювати промпт (${answeredCount}/${controls.length})`}
        </Button>
      </div>
    </div>
  );
}
