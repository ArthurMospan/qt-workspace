import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { colors, sizing, spacing } from '@/lib/design/tokens';

/**
 * Pagination Component
 *
 * @component
 * A pagination control for navigating through multiple pages of content.
 *
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-indexed)
 * @param {number} props.totalPages - Total number of pages available
 * @param {Function} props.onPageChange - Callback when page changes: (pageNumber) => void
 * @param {string} [props.className] - Additional CSS classes to apply
 *
 * @example
 * const [page, setPage] = useState(1);
 * <Pagination
 *   currentPage={page}
 *   totalPages={25}
 *   onPageChange={setPage}
 * />
 */
export function Pagination({
  currentPage = 1,
  totalPages = 10,
  onPageChange = () => {},
  className = '',
}) {
  const maxVisiblePages = 10;
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Calculate which page numbers to display
  const pageNumbers = useMemo(() => {
    const pages = [];

    if (totalPages <= maxVisiblePages) {
      // Show all pages if we have 10 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page
      pages.push(1);

      // Calculate start and end for middle pages
      let startPage = Math.max(2, currentPage - 2);
      let endPage = Math.min(totalPages - 1, currentPage + 2);

      // Add ellipsis and adjust range if needed
      if (startPage > 2) {
        pages.push('...');
      }

      for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }

      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // Show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  const handlePageClick = (page) => {
    if (typeof page === 'number' && page !== currentPage) {
      onPageChange(page);
    }
  };

  const PaginationButton = ({ page, isActive, disabled }) => {
    const isEllipsis = page === '...';

    if (isEllipsis) {
      return (
        <span
          style={{
            height: sizing.button.lg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: spacing.sm,
            paddingRight: spacing.sm,
            fontSize: '13px',
            color: colors.text.muted,
          }}
        >
          …
        </span>
      );
    }

    return (
      <button
        onClick={() => handlePageClick(page)}
        disabled={disabled || isActive}
        style={{
          height: sizing.button.lg,
          minWidth: sizing.button.lg,
          backgroundColor: isActive ? colors.dark : 'transparent',
          color: isActive ? colors.surface : colors.text.primary,
          border: `1px solid ${isActive ? colors.dark : colors.border.primary}`,
          borderRadius: sizing.radius.lg,
          fontSize: '13px',
          fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'all 200ms ease-in-out',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !isActive) {
            e.currentTarget.style.backgroundColor = colors.light;
            e.currentTarget.style.borderColor = colors.border.secondary;
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled && !isActive) {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = colors.border.primary;
          }
        }}
      >
        {page}
      </button>
    );
  };

  return (
    <div className={`flex flex-col gap-[${spacing.lg}] ${className}`}>
      {/* Page Numbers */}
      <div className="flex items-center justify-center gap-[6px]">
        {/* Previous Button */}
        <button
          onClick={() => handlePageClick(currentPage - 1)}
          disabled={!canGoPrevious}
          style={{
            height: sizing.button.lg,
            minWidth: sizing.button.lg,
            backgroundColor: colors.light,
            color: colors.text.primary,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: sizing.radius.lg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canGoPrevious ? 'pointer' : 'not-allowed',
            opacity: canGoPrevious ? 1 : 0.5,
            transition: 'all 200ms ease-in-out',
          }}
          onMouseEnter={(e) => {
            if (canGoPrevious) {
              e.currentTarget.style.backgroundColor = colors.hover.light;
            }
          }}
          onMouseLeave={(e) => {
            if (canGoPrevious) {
              e.currentTarget.style.backgroundColor = colors.light;
            }
          }}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Page Numbers */}
        {pageNumbers.map((page, index) => (
          <PaginationButton
            key={index}
            page={page}
            isActive={page === currentPage}
            disabled={page === '...'}
          />
        ))}

        {/* Next Button */}
        <button
          onClick={() => handlePageClick(currentPage + 1)}
          disabled={!canGoNext}
          style={{
            height: sizing.button.lg,
            minWidth: sizing.button.lg,
            backgroundColor: colors.light,
            color: colors.text.primary,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: sizing.radius.lg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            opacity: canGoNext ? 1 : 0.5,
            transition: 'all 200ms ease-in-out',
          }}
          onMouseEnter={(e) => {
            if (canGoNext) {
              e.currentTarget.style.backgroundColor = colors.hover.light;
            }
          }}
          onMouseLeave={(e) => {
            if (canGoNext) {
              e.currentTarget.style.backgroundColor = colors.light;
            }
          }}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Page Info */}
      <div style={{ textAlign: 'center', fontSize: '13px', color: colors.text.muted }}>
        Page {currentPage} of {totalPages}
      </div>
    </div>
  );
}

export default Pagination;
