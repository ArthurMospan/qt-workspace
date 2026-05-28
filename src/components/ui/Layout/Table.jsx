'use client';

import { useState } from 'react';

export default function Table({
  headers = [],
  rows = [],
  striped = true,
  hoverable = true,
  stickyHeader = false,
  className = '',
}) {
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div className="w-full overflow-x-auto">
      <table className={`w-full border-collapse ${className}`}>
        {/* Header */}
        <thead className={stickyHeader ? 'sticky top-0 z-[20]' : ''}>
          <tr className="bg-[#f7f7f7]">
            {headers.map((header, idx) => (
              <th
                key={idx}
                className="px-[16px] py-[12px] text-left text-[13px] font-[700] text-[#1f1f1f]"
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
                border-b border-[#e9e9e9]
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
                  className="px-[16px] py-[12px] text-[14px] font-[600] text-[#1f1f1f]"
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
        <div className="py-[32px] text-center text-[14px] font-[600] text-[#9a9a9a]">
          No data available
        </div>
      )}
    </div>
  );
}
