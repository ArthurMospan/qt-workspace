'use client';

// ─── UI Kit: Data Table ──────────────────────────────────────────────────────
// Rows of figures, on the one screen that is made of them.
//
// Analytics carried three tables and each was written from scratch. «По
// проєктах» ruled its header with #f0f0f0 and its body with #f8f8f8; «Навантаження
// по виконавцях» used --color-line for both; the team overview was not a table
// at all but a six-column CSS grid duplicated in two places, one of which
// declared its column widths twice. Their header labels were 10px bold caps in
// two of the three and something else in the third, their cells were 12px and
// 13px, and each carried its own mobile fallback — one a card grid, one nothing.
//
// One table. It is a real <table>, so a screen reader gets a table; below the
// breakpoint each row folds into a labelled stack, because a six-column grid on
// a phone is a horizontal scrollbar nobody finds.

import React from 'react';

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

/**
 * @typedef {object} DataTableColumn
 * @property {string} id
 * @property {string} header Column label. Also the row label in the stacked layout.
 * @property {(row: object) => React.ReactNode} cell What to draw.
 * @property {'left'|'right'|'center'} align Which edge the value sits on. Figures go right.
 * @property {boolean} lead The identifying column: it leads the stacked card and never gets a label there.
 * @property {string} width A fixed track for this column, where one is needed.
 */

/**
 * A table of figures with a stacked layout below the breakpoint.
 *
 * @param {DataTableColumn[]} props.columns What the table has.
 * @param {object[]} props.rows What it shows.
 * @param {(row: object) => string} props.rowKey Stable key per row.
 * @param {(row: object) => string} props.rowHref Makes the whole row a link, which is what a row in analytics almost always wants to be.
 * @param {string} props.emptyText Shown instead of an empty table.
 * @param {string} props.className Placement in the parent only.
 */
export default function DataTable({
  columns = [],
  rows = [],
  rowKey = row => row.id,
  rowHref,
  emptyText = 'Немає даних',
  className = '',
}) {
  if (rows.length === 0) {
    return <p className={`py-6 text-center text-[12px] text-faint ${className}`}>{emptyText}</p>;
  }

  const leadColumn = columns.find(column => column.lead) || columns[0];
  const restColumns = columns.filter(column => column !== leadColumn);

  return (
    <div className={`min-w-0 ${className}`}>
      {/* ── Table ─────────────────────────────────────────────────────── */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.id}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`ui-type-eyebrow border-b border-[color:var(--color-chart-grid)] pb-2 pr-4 last:pr-0 ${ALIGN[column.align] || ALIGN.left}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const href = rowHref?.(row);
            return (
              <tr
                key={rowKey(row)}
                className="group border-b border-[color:var(--color-chart-grid)] transition-colors last:border-0 hover:bg-canvas/60"
              >
                {columns.map(column => (
                  <td
                    key={column.id}
                    className={`py-3 pr-4 align-middle last:pr-0 ${ALIGN[column.align] || ALIGN.left}`}
                  >
                    {column === leadColumn && href ? (
                      <a href={href} className="block min-w-0 group-hover:underline">
                        {column.cell(row)}
                      </a>
                    ) : column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── The same rows, stacked ────────────────────────────────────── */}
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map(row => {
          const href = rowHref?.(row);
          const lead = (
            <div className="min-w-0 border-b border-[color:var(--color-chart-grid)] pb-2.5">
              {leadColumn.cell(row)}
            </div>
          );
          return (
            <div
              key={rowKey(row)}
              data-ui-surface="compact-bordered-card"
              data-ui-padding="sm"
              className="ui-surface flex min-w-0 flex-col gap-2.5"
            >
              {href ? <a href={href} className="block min-w-0">{lead}</a> : lead}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {restColumns.map(column => (
                  <div key={column.id} className="flex min-w-0 items-baseline justify-between gap-2">
                    <dt className="truncate text-[10px] font-semibold text-muted">{column.header}</dt>
                    <dd className="shrink-0">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
