'use client';

// /ui-decisions — the fourteen questions left in the surfaces pass.
//
// It lives inside the product, not beside it, for one reason: every element is
// shown where it actually sits, drawn by the same components the screen draws.
// A survey about how something looks has to be rendered by the thing that
// decides how it looks.
//
// Temporary by design. When the answers are in, this route, its story file and
// the two guard exceptions that allow it are deleted together.

import { useState, useSyncExternalStore } from 'react';
import { Button, Surface, Pill } from '@/components/ui';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { useDecisions } from './decisions';

const KIND_LABEL = {
  adopt: 'взяти вигляд кіту',
  build: 'зробити компонент у кіті',
  keep: 'лишити як є',
};

const KIND_TONE = { adopt: 'success', build: 'warning', keep: 'neutral' };

const STORE = 'qt-ui-decisions-v1';

// localStorage read through useSyncExternalStore rather than an effect. Reading
// it in an effect means rendering an empty survey and then filling it in, which
// React rightly complains about; a lazy initialiser instead disagrees with the
// server render. This is the one API that handles both: the server snapshot is
// empty, the client's is what was stored, and React swaps them without calling
// it a hydration mismatch.
const listeners = new Set();
let cached = null;

function readStore() {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(STORE) || '{}';
    } catch {
      cached = '{}';
    }
  }
  return cached;
}

function writeStore(value) {
  cached = JSON.stringify(value);
  try {
    window.localStorage.setItem(STORE, cached);
  } catch {
    // A private window still answers questions; it just forgets them.
  }
  listeners.forEach(listener => listener());
}

function subscribeStore(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function Column({ label, muted = false, children }) {
  return (
    <div className="min-w-0 flex-1">
      <p className={`mb-2 font-mono text-[10px] font-bold uppercase tracking-wider ${muted ? 'text-faint' : 'text-ink'}`}>
        {label}
      </p>
      <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-white p-3">
        {children}
      </div>
    </div>
  );
}

export default function UiDecisionsPage() {
  const decisions = useDecisions();
  const [copied, setCopied] = useState(false);
  const raw = useSyncExternalStore(subscribeStore, readStore, () => '{}');
  let answers = {};
  try {
    answers = JSON.parse(raw);
  } catch {
    answers = {};
  }
  const store = writeStore;

  const choose = (id, title) => {
    const next = { ...answers };
    if (next[id] === title) delete next[id];
    else next[id] = title;
    store(next);
  };

  const kindOf = (decision, title) =>
    (decision.options.find(option => option.title === title) || {}).kind;

  const decided = decisions.filter(decision => answers[decision.id]);
  const covered = decided.reduce((sum, decision) => sum + decision.count, 0);

  const prompt = (() => {
    if (decided.length === 0) return 'Ще нічого не обрано.';
    const lines = [
      'Продовжуємо хвіст дизайн-системи QuickTeam — 56 елементів, що малюють UI повз кіт.',
      'Ось мої рішення. Роби по черзі, кожне окремим комітом, із заміром computed-стилів',
      'до і після там, де вигляд змінюється.',
      '',
      `ОБРАНО: ${decided.length} із ${decisions.length} рішень, ${covered} із 56 елементів.`,
      '',
    ];
    for (const [kind, heading] of [
      ['adopt', 'ВЗЯТИ ВИГЛЯД КІТУ'],
      ['build', 'ЗРОБИТИ КОМПОНЕНТ У КІТІ'],
      ['keep', 'ЛИШИТИ ЯК Є'],
    ]) {
      const group = decided.filter(decision => kindOf(decision, answers[decision.id]) === kind);
      if (group.length === 0) continue;
      lines.push(`${heading}:`);
      for (const decision of group) {
        lines.push(`- ${decision.title} (${decision.count}) — ${answers[decision.id]}`);
        lines.push(`  ${decision.where}`);
      }
      lines.push('');
    }
    const undecided = decisions.filter(decision => !answers[decision.id]);
    if (undecided.length) {
      lines.push('ЩЕ НЕ ВИРІШИВ (не чіпай):');
      for (const decision of undecided) lines.push(`- ${decision.title} (${decision.count})`);
      lines.push('');
    }
    lines.push('Починай з того, що прибирає найбільше елементів.');
    lines.push('Після кожного: повний гейт і опустити стелю nativeControls у tests/kit-usage.test.mjs.');
    lines.push('Якщо якесь рішення виявиться гіршим, ніж виглядало на екрані — скажи, не роби.');
    return lines.join('\n');
  })();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      document.getElementById('decisions-prompt')?.select();
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto bg-canvas">
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-4 py-8 md:px-8">

        <header className="flex flex-col gap-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-faint">
            Internal · not in nav · /ui-decisions
          </p>
          <h1 className="ui-type-page-title text-ink">56 місць, які малюють інтерфейс повз кіт</h1>
          <p className="max-w-[70ch] text-[13px] leading-relaxed text-muted">
            Було 145. Усе, що було дублем, уже зведено — там є об’єктивно правильна відповідь.
            Те, що лишилось, — питання смаку. Кожне питання починається{' '}
            <span className="font-semibold text-ink">скріншотом справжнього екрана</span> з обведеним
            елементом, далі — той самий елемент зблизька, а під ним «зараз» і «стане».
            Обидві половини намальовані справжніми компонентами, не приблизно.
          </p>
          <div className="flex flex-wrap gap-2">
            <Pill tone="neutral" size="md">{decisions.length} рішень</Pill>
            <Pill tone="neutral" size="md">56 елементів</Pill>
            <Pill tone={decided.length ? 'success' : 'neutral'} size="md">
              обрано {decided.length}
            </Pill>
          </div>
        </header>

        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">

          {/* ── Questions ───────────────────────────────────────────── */}
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {decisions.map((decision, index) => (
              <Surface
                key={decision.id}
                preset="bordered-card"
                padding="lg"
                className={answers[decision.id] ? '!border-ink/25' : ''}
              >
                <div className="flex flex-col gap-4">

                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-mono text-[11px] font-bold tabular-nums text-faint">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h2 className="ui-type-feature-title text-ink">{decision.title}</h2>
                    <span className="ml-auto shrink-0">
                      <Pill tone="neutral" size="sm">{decision.count} шт</Pill>
                    </span>
                  </div>

                  <p className="max-w-[72ch] text-[13px] leading-relaxed text-muted">{decision.why}</p>

                  {/* Where it lives: the live screen first, then the same
                      element large enough to actually judge. */}
                  {decision.shot}
                  {decision.context}

                  {/* Now against after, side by side. */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Column label="зараз" muted>{decision.now}</Column>
                    {decision.after ? (
                      <Column label="стане">{decision.after}</Column>
                    ) : (
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-ink">стане</p>
                        <div className="flex h-full items-center rounded-[12px] border border-dashed border-faint bg-white p-4 text-[12px] leading-relaxed text-muted">
                          {decision.afterNote}
                        </div>
                      </div>
                    )}
                  </div>

                  {decision.after && decision.afterNote && (
                    <p className="font-mono text-[10px] leading-relaxed text-faint">{decision.afterNote}</p>
                  )}

                  <p className="overflow-x-auto whitespace-nowrap font-mono text-[10px] text-faint">
                    {decision.where}
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {decision.options.map(option => {
                      const active = answers[decision.id] === option.title;
                      return (
                        <button
                          key={option.title}
                          type="button"
                          aria-pressed={active}
                          onClick={() => choose(decision.id, option.title)}
                          className={`flex items-start gap-2.5 rounded-[14px] border-2 p-3 text-left transition-all ${
                            active ? 'border-ink bg-canvas' : 'border-transparent bg-canvas hover:bg-[#efefef]'
                          }`}
                        >
                          <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${
                            active ? 'bg-ink text-white' : 'border border-faint'
                          }`}>
                            {active && <Check size={11} />}
                          </span>
                          <span className="min-w-0">
                            <span className="mb-1 block">
                              <Pill tone={KIND_TONE[option.kind]} size="sm">{KIND_LABEL[option.kind]}</Pill>
                            </span>
                            <span className="block text-[13px] font-bold text-ink">{option.title}</span>
                            <span className="mt-0.5 block text-[11px] leading-4 text-muted">{option.note}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Surface>
            ))}
          </div>

          {/* ── Result ──────────────────────────────────────────────── */}
          <div className="w-full shrink-0 lg:sticky lg:top-8 lg:w-[330px]">
            <Surface preset="bordered-card" padding="lg">
              <div className="flex flex-col gap-3">
                <h3 className="ui-type-card-title text-ink">Ваші відповіді</h3>

                <div className="h-1.5 overflow-hidden rounded-full bg-canvas">
                  <div
                    className="h-full bg-ink transition-all duration-300"
                    style={{ width: `${(decided.length / decisions.length) * 100}%` }}
                  />
                </div>
                <p className="font-mono text-[11px] tabular-nums text-muted">
                  {decided.length} / {decisions.length} · {covered} з 56 елементів
                </p>

                <div className="flex flex-col gap-1.5">
                  {['adopt', 'build', 'keep'].map(kind => (
                    <div key={kind} className="flex items-center gap-2 text-[12px] text-muted">
                      <span className="font-mono text-[12px] font-bold tabular-nums text-ink">
                        {decided
                          .filter(decision => kindOf(decision, answers[decision.id]) === kind)
                          .reduce((sum, decision) => sum + decision.count, 0)}
                      </span>
                      {KIND_LABEL[kind]}
                    </div>
                  ))}
                </div>

                <textarea
                  id="decisions-prompt"
                  readOnly
                  value={prompt}
                  aria-label="Промпт для копіювання"
                  className="ui-textarea min-h-[150px] w-full resize-y rounded-[10px] border border-transparent bg-canvas p-2.5 font-mono text-[10px] leading-relaxed text-ink outline-none"
                />

                <div className="flex flex-wrap gap-2">
                  <Button size="md" icon={copied ? Check : Copy} onClick={copy}>
                    {copied ? 'Скопійовано' : 'Скопіювати промпт'}
                  </Button>
                  <Button size="md" style="ghost" icon={RotateCcw} onClick={() => store({})}>
                    Скинути
                  </Button>
                </div>

                <p className="text-[11px] leading-relaxed text-faint">
                  Відповіді зберігаються у цьому браузері — можна закрити вкладку й повернутися.
                </p>
              </div>
            </Surface>
          </div>
        </div>

        <p className="border-t border-line pt-4 text-[11px] text-faint">
          Сторінка тимчасова: щойно рішення прийняті, вона видаляється разом із маршрутом.
        </p>
      </div>
    </div>
  );
}
