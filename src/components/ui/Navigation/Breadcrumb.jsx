import React from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { HeaderSearch } from '../Forms/HeaderSearch';

export function Breadcrumb({
  items = [],
  className = '',
  // Search toggle configuration (Project mode)
  showSearchButton = false,
  isSearchActive = false,
  onSearchToggle = () => {},
  searchValue = '',
  onSearchChange = () => {},
  onSearchClear = () => {},
  searchPlaceholder = 'Пошук...',
}) {
  if (!items || items.length === 0) {
    return null;
  }

  if (isSearchActive) {
    return (
      <div className={`flex items-center min-w-0 ${className}`}>
        <HeaderSearch
          autoFocus
          value={searchValue}
          onChange={onSearchChange}
          onClear={onSearchClear}
          placeholder={searchPlaceholder}
          className="border-[#1f1f1f] w-[300px]"
        />
      </div>
    );
  }

  return (
    <nav className={`flex items-center gap-[6px] min-w-0 text-[13px] ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-[6px] min-w-0">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isClickable = item.href && !isLast;

          return (
            <React.Fragment key={index}>
              {index > 0 && (
                <ChevronRight size={13} className="text-[#cfcfcf] shrink-0" />
              )}
              
              {showSearchButton && isLast && (
                <button
                  onClick={onSearchToggle}
                  className="p-[4px] text-[#9a9a9a] hover:bg-[#f4f4f5] hover:text-[#1f1f1f] rounded-[6px] transition-all shrink-0 mr-[2px]"
                  title="Пошук"
                >
                  <Search size={14} />
                </button>
              )}

              <li className="flex items-center min-w-0">
                {isClickable ? (
                  <a
                    href={item.href}
                    className="text-[#9a9a9a] hover:text-[#1f1f1f] font-normal truncate transition-colors max-w-[140px]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <span
                    className={`truncate max-w-[260px] ${
                      isLast ? 'font-medium text-[#1f1f1f]' : 'text-[#9a9a9a] font-normal'
                    }`}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
