'use client';

import Image from 'next/image';
import { Button, Card, ToggleSwitch } from '@/components/ui';

const STATUS_STYLES = {
  connected: 'bg-green-50 text-[#10b981]',
  pending: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-600',
  unavailable: 'bg-[#f5f5f5] text-muted',
  off: 'bg-[#f5f5f5] text-muted',
};

const STATUS_DOTS = {
  connected: 'bg-[#10b981]',
  pending: 'bg-amber-500',
  error: 'bg-red-500',
  unavailable: 'bg-faint',
  off: 'bg-faint',
};

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
    <Card variant="white" padding="lg" className="mb-4 !border-none">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-line bg-white">
          <Image src={logoSrc} alt={logoAlt} width={30} height={30} className="h-[30px] w-[30px] object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
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

          <div className="mt-3 border-t border-[#f0f0f0] pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold ${statusStyle}`}>
                <span className={`h-[5px] w-[5px] rounded-full ${dotStyle}`} />
                {statusLabel}
              </span>
              {statusMeta}
            </div>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>
      </div>
    </Card>
  );
}
