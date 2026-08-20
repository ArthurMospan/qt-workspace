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
//
// That stack assumed every value was a short figure. A cell holding a task
// title was 296px wide in a 124px track and drew straight across the column
// beside it, while its own label truncated to nothing — which is why the team
// table read as text on top of text. A value that is not a figure says so with
// `wide` and gets the row to itself; the figures keep the two-column pairing
// they were designed for, and nothing is allowed to overrun its track.

import React from 'react';
import Surface from '@/components/ui/Surface';

const ALIGN = { left: 'text-left', right: 'text-right', center: 'text-center' };

// The chrome is the task table's, and deliberately so. Two tables in one
// product that look like two products is the complaint this answers: the grid
// on a project's «Таблиця» sits in a bordered panel with a canvas header band
// and 36px rows, while this one drew hairlines straight onto the card with
// nothing around it and rows a third taller. The behaviour stays different —
// that is the part `TaskTableView` was built for — but a row of figures is now
// read at the same weight in both places.
const HEADER_CELL = 'h-9 bg-canvas px-[10px] shadow-[inset_0_-1px_0_var(--color-line)]';
const BODY_CELL = 'h-9 px-[10px] py-0 align-middle';

/**
 * @typedef {object} DataTableColumn
 * @property {string} id
 * @property {string} header Column label. Also the row label in the stacked layout.
 * @property {(row: object) => React.ReactNode} cell What to draw.
 * @property {'left'|'right'|'center'} align Which edge the value sits on. Figures go right.
 * @property {boolean} lead The identifying column: it leads the stacked card and never gets a label there.
 * @property {string} width A fixed track for this column, where one is needed.
 * @property {boolean} wide Its value is not a short figure — a title, a bar, a pill. In the stacked layout it takes the row to itself with the label above it, instead of being squeezed into half a phone.
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
      <Surface preset="compact-bordered-card" padding="none" className="hidden min-w-0 overflow-hidden md:block">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.id}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={`ui-type-eyebrow uppercase tracking-wide text-muted ${HEADER_CELL} ${ALIGN[column.align] || ALIGN.left}`}
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
                  className="group border-b border-[#f4f4f5] transition-colors last:border-0 hover:bg-[#fafafa]"
                >
                  {columns.map(column => (
                    <td
                      key={column.id}
                      className={`${BODY_CELL} ${ALIGN[column.align] || ALIGN.left}`}
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
      </Surface>

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
                {restColumns.map(column => (column.wide ? (
                  <div key={column.id} className="col-span-2 flex min-w-0 flex-col gap-1">
                    <dt className="truncate text-[10px] font-semibold text-muted">{column.header}</dt>
                    <dd className="min-w-0">{column.cell(row)}</dd>
                  </div>
                ) : (
                  <div key={column.id} className="flex min-w-0 items-baseline justify-between gap-2">
                    <dt className="shrink-0 text-[10px] font-semibold text-muted">{column.header}</dt>
                    <dd className="min-w-0 truncate text-right">{column.cell(row)}</dd>
                  </div>
                )))}
              </dl>
            </div>
          );
        })}
      </div>
    </div>
  );
}
