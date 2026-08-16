'use client';

// ─── UI Kit: Trend Chart ─────────────────────────────────────────────────────
// One line over time, with an optional reference line behind it — the burndown,
// and anything else shaped like "where we are against where we planned to be".
//
// The version this replaces drew its polyline into a `viewBox="0 0 n 100"` with
// `preserveAspectRatio="none"`, which stretches the coordinate system: the line
// was 2px thick at one aspect ratio and a hairline at another, and there was no
// way to hover a point on it at all. Here the points are laid out in the SVG's
// own pixel space, so a stroke is the width it says it is.
//
// The reference line is the one dashed stroke in the product that is allowed to
// be dashed: dashing means "projected, not measured", and this is the one place
// where that is true. Gridlines are never dashed.

import React, { useState } from 'react';

/**
 * A measured series over time, optionally against a reference.
 *
 * @param {{label: string, value: number, reference?: number}[]} props.data One entry per time slot.
 * @param {string} props.valueLabel What the measured line means. Named in the legend and the tooltip.
 * @param {string} props.referenceLabel What the reference line means. Omit it and no reference is drawn.
 * @param {number} props.height Plot height in pixels, excluding the axis band below it.
 * @param {string} props.className Placement in the parent only.
 */
export default function TrendChart({
  data = [],
  valueLabel = 'Фактично',
  referenceLabel,
  height = 130,
  className = '',
}) {
  const [hovered, setHovered] = useState(null);

  if (data.length < 2) {
    return <p className={`py-6 text-center text-[12px] text-faint ${className}`}>Недостатньо даних для тренду</p>;
  }

  const width = 600;
  const padding = 6;
  const hasReference = referenceLabel && data.some(point => Number.isFinite(point.reference));
  const max = Math.max(
    ...data.map(point => Math.max(Number(point.value) || 0, Number(point.reference) || 0)),
    1,
  );
  const x = index => (index / (data.length - 1)) * (width - padding * 2) + padding;
  const y = value => height - padding - ((Number(value) || 0) / max) * (height - padding * 2);

  const linePoints = data.map((point, index) => `${x(index)},${y(point.value)}`).join(' ');
  const referencePoints = data.map((point, index) => `${x(index)},${y(point.reference)}`).join(' ');
  const areaPoints = `${linePoints} ${x(data.length - 1)},${height} ${x(0)},${height}`;
  const active = hovered === null ? null : data[hovered];

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="relative" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`${valueLabel} за ${data.length} точок`}
        >
          {/* The wash under the line is the series hue at a tenth — a wash,
              never a saturated block. */}
          <polygon points={areaPoints} fill="var(--color-chart-1)" fillOpacity="0.1" />
          {hasReference && (
            <polyline
              points={referencePoints}
              fill="none"
              stroke="var(--color-chart-context)"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <polyline
            points={linePoints}
            fill="none"
            stroke="var(--color-chart-1)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {hovered !== null && (
            <circle
              cx={x(hovered)}
              cy={y(data[hovered].value)}
              r="4.5"
              fill="var(--color-chart-1)"
              stroke="#ffffff"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>

        {/* A row of invisible bands over the plot: the nearest point wins, so
            you never have to land on a 2px line. */}
        <div className="absolute inset-0 flex">
          {data.map((point, index) => (
            <div
              key={`${point.label}-${index}`}
              className="h-full flex-1"
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(current => (current === index ? null : current))}
            />
          ))}
        </div>

        {active && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-20 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink px-2 py-1.5 text-[10px] font-semibold text-white shadow-lg"
            style={{ left: `${(hovered / (data.length - 1)) * 100}%` }}
          >
            <span className="block text-white/60">{active.label}</span>
            <span className="mt-0.5 block">{valueLabel}: {active.value}</span>
            {hasReference && Number.isFinite(active.reference) && (
              <span className="block text-white/70">{referenceLabel}: {active.reference}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-faint">{data[0]?.label}</span>
        <span className="text-[10px] text-faint">{data[data.length - 1]?.label}</span>
      </div>

      {hasReference && (
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="inline-block h-[2px] w-5 rounded-full" style={{ background: 'var(--color-chart-1)' }} />
            {valueLabel}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span
              className="inline-block h-0 w-5 border-t-[1.5px] border-dashed"
              style={{ borderColor: 'var(--color-chart-context)' }}
            />
            {referenceLabel}
          </span>
        </div>
      )}
    </div>
  );
}
