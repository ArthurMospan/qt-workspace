'use client';

import Image from 'next/image';
import { Button, Card, ToggleSwitch } from '@/components/ui';

// «Підключено» — стан, а не успіх.
//
// Увімкнена інтеграція носила зелений — єдиний теплий колір на екрані, — і
// голосніше за неї на картці не було нічого, включно з назвою сервісу. Гама
// продукту темна, тож увімкнений стан бере її: біле на ink. Три інші лишаються
// кольоровими, бо вони справді щось повідомляють: «зачекайте», «зламалося»,
// «вимкнено». Зелене в продукті означає «вийшло», а не «увімкнено».
const STATUS_STYLES = {
  connected: 'bg-ink text-white',
  pending: 'bg-warning-soft text-warning',
  error: 'bg-danger-soft text-danger',
  unavailable: 'bg-canvas text-muted',
  off: 'bg-canvas text-muted',
};

const STATUS_DOTS = {
  connected: 'bg-white',
  pending: 'bg-warning-solid',
  error: 'bg-danger-solid',
  unavailable: 'bg-faint',
  off: 'bg-faint',
};

// The grey panel every integration explains itself in. It was written out four
// times with four different radii, paddings, title sizes and body colours, so
// the same kind of instruction looked like a different kind of thing depending
// on which service you were reading. The contents stay per-service; the chrome
// does not.
//
// The chrome was one size too small for what grew inside it. 11px body under a
// 12px title is a footnote, and it was carrying a staff roster, a brand editor
// and a form — every one of which then had to shout over its own container with
// a `text-[13px]` of its own. It reads at the scale the rest of settings does:
// a 13px title matching `Row`'s label, 12px body matching its description.
export function IntegrationNote({ title, children, className = '' }) {
  return (
    <div data-ui-surface="local" className={`rounded-[12px] border border-line bg-canvas p-4 ${className}`}>
      {title && <p className="mb-3 text-[13px] font-semibold leading-snug text-ink">{title}</p>}
      <div className="space-y-2 text-[12px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

// A literal inside an IntegrationNote: a bot command, an API token, an org id.
export function IntegrationCode({ children, className = '' }) {
  return (
    <code className={`rounded border border-line bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink ${className}`}>
      {children}
    </code>
  );
}

export function IntegrationSteps({ steps }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, index) => (
        <li key={step.title || index} className="flex gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">
            {index + 1}
          </span>
          <div className="min-w-0 pt-px">
            {step.title && <p className="text-[12px] font-semibold leading-snug text-ink">{step.title}</p>}
            {step.description && <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{step.description}</p>}
            {step.content}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function IntegrationCard({
  title,
  description,
  logoSrc,
  logoAlt = '',
  enabled,
  onToggle,
  toggleDisabled = false,
  actionLabel,
  onAction,
  actionIcon,
  actionStyle = 'secondary',
  actionAriaLabel,
  status = enabled ? 'connected' : 'off',
  statusLabel = enabled ? 'Підключено' : 'Вимкнено',
  statusMeta,
  children,
}) {
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.off;
  const dotStyle = STATUS_DOTS[status] || STATUS_DOTS.off;

  return (
    <Card preset="borderless" padding="lg">
      {/* The header is a header. Everything an integration has to say used to
          live inside the 40px logo's own column — indented past it, and that
          much narrower than the card it sits in — because the logo, the title
          and the body were all one flex row. That is right for the row on the
          list, where a logo introduces one line of text, and wrong for the
          screen behind it, where the same column had to hold a staff roster
          with a name, an email, a badge and a role picker on every line. The
          logo introduces the title; the body starts at the card's own edge. */}
      <div className="flex items-start gap-4">
        <div data-ui-surface="local" className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white">
          <Image src={logoSrc} alt={logoAlt} width={30} height={30} className="h-[30px] w-[30px] object-contain" />
        </div>

        <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold leading-snug text-ink">{title}</p>
            <p className="mt-[2px] text-[12px] leading-relaxed text-muted">{description}</p>
          </div>
          {actionLabel ? (
            <Button
              style={actionStyle}
              size="sm"
              icon={actionIcon}
              onClick={onAction}
              disabled={toggleDisabled}
              aria-label={actionAriaLabel || `${actionLabel}: ${title}`}
            >
              {actionLabel}
            </Button>
          ) : (
            <ToggleSwitch
              checked={enabled}
              onChange={onToggle}
              disabled={toggleDisabled}
              ariaLabel={`${enabled ? 'Вимкнути' : 'Увімкнути'} інтеграцію ${title}`}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[4px] text-[12px] font-semibold ${statusStyle}`}>
          <span className={`h-[5px] w-[5px] rounded-full ${dotStyle}`} />
          {statusLabel}
        </span>
        {statusMeta}
      </div>

      {/* One rhythm for the blocks below, held here rather than by whoever
          remembered. Telegram wrapped its own children in a `space-y-3`;
          qTicket stacked six blocks with nothing between them at all, so an
          alert, a roster and a brand editor were flush against each other. */}
      {children && <div className="mt-5 flex flex-col gap-4">{children}</div>}
    </Card>
  );
}
