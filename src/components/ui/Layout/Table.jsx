'use client';

import { useState } from 'react';

export default function Table({
  headers = [],
  rows = [], // can be arrays of cells, or objects/React elements. Let's make it flexible.
  striped = true,
  hoverable = true,
  stickyHeader = false,
  variant = 'default', // 'default' or 'backlog' (separated spacing, rounded rows)
  className = '',
}) {
  const [hoveredRow, setHoveredRow] = useState(null);

  if (variant === 'backlog') {
    return (
      <div className="w-full overflow-x-auto bg-transparent">
        <table className={`w-full relative border-separate border-spacing-y-2 table-fixed min-w-[700px] ${className}`}>
          {/* Header */}
          <thead className={stickyHeader ? 'sticky top-0 z-[20] bg-transparent' : 'bg-transparent'}>
            <tr>
              {headers.map((header, idx) => (
                <th
                  key={idx}
                  className="text-left text-[10px] font-bold text-muted uppercase tracking-wide px-4 py-3 select-none"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={`
                  bg-white cursor-pointer transition-all duration-200 group
                  hover:bg-[#fcfcfc] hover:ring-4 hover:ring-ink/5
                `}
              >
                {row.map((cell, cellIdx) => (
                  <td
                    key={cellIdx}
                    className={`
                      px-4 py-3 text-[13px] font-semibold text-ink
                      border-y border-[#efefef]
                      first:border-l first:rounded-l-[16px]
                      last:border-r last:rounded-r-[16px]
                    `}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="py-[32px] text-center text-[12px] font-bold text-faint">
            Задач не знайдено в цьому списку
          </div>
        )}
      </div>
    );
  }

  // Default standard table layout
  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>
        {/* Header */}
        <thead className={stickyHeader ? 'sticky top-0 z-[20]' : ''}>
          <tr className="bg-canvas">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-[16px] py-[12px] text-left text-[13px] font-[700] text-ink"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        {/* Body */}
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={`
                border-b border-line
                ${striped && rowIdx % 2 === 1 ? 'bg-[#fafafa]' : ''}
                ${
                  hoverable
                    ? hoveredRow === rowIdx
                      ? 'bg-[#ebebeb]'
                      : ''
                    : ''
                }
                ${hoverable ? 'cursor-pointer transition-colors duration-200' : ''}
              `}
              onMouseEnter={() => hoverable && setHoveredRow(rowIdx)}
              onMouseLeave={() => hoverable && setHoveredRow(null)}
            >
              {row.map((cell, cellIdx) => (
                <td
                  key={cellIdx}
                  className="px-[16px] py-[12px] text-[14px] font-[600] text-ink"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="py-[32px] text-center text-[14px] font-[600] text-muted">
          No data available
        </div>
      )}
    </div>
  );
}
