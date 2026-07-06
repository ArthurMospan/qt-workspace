'use client';
import React, { forwardRef, useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocalization } from '@/lib/hooks/useLocalization';

// Utility: Get days in month
const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

// Utility: Format date to YYYY-MM-DD
const formatDate = (date) => {
  if (!date) return '';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return '';
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

// Utility: Parse to Date
const parseDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string' && val.includes('-')) {
    const [year, month, day] = val.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return val.toDate ? val.toDate() : new Date(val);
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const DatePicker = forwardRef(({
  value = '',
  onChange,
  error,
  disabled = false,
  placeholder = 'Select date',
  className = '',
  mode = 'single', // 'single' or 'range'
  startDate = '',
  endDate = '',
  onDateRangeChange,
  inputClassName,
  hideIcon,
  ...props
}, ref) => {
  const { formatDate: formatLocal, getWeekdays, getFirstDayOffset } = useLocalization();
  const WEEKDAYS = getWeekdays();
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(value ? parseDate(value) : null);
  const [rangeStart, setRangeStart] = useState(startDate ? parseDate(startDate) : null);
  const [rangeEnd, setRangeEnd] = useState(endDate ? parseDate(endDate) : null);
  const containerRef = useRef(null);

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDateClick = (day) => {
    if (mode === 'single') {
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      setSelectedDate(newDate);
      onChange?.(formatDate(newDate));
      setIsOpen(false);
    } else if (mode === 'range') {
      const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(newDate);
        setRangeEnd(null);
      } else if (newDate < rangeStart) {
        setRangeEnd(rangeStart);
        setRangeStart(newDate);
      } else {
        setRangeEnd(newDate);
      }
      if (rangeStart && rangeEnd) onDateRangeChange?.(formatDate(rangeStart), formatDate(rangeEnd));
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOffset(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const displayValue = mode === 'single' ?
    (selectedDate ? formatLocal(selectedDate) : '') :
    (rangeStart && rangeEnd ? `${formatLocal(rangeStart)} - ${formatLocal(rangeEnd)}` :
     rangeStart ? formatLocal(rangeStart) : '');

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input Field */}
      <div className="relative">
        {!hideIcon && (
          <Calendar
            size={14}
            className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
        )}
        <input
          ref={ref}
          type="text"
          value={displayValue}
          placeholder={placeholder}
          disabled={disabled}
          readOnly
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={inputClassName || `
            h-[36px] w-full bg-canvas border border-transparent rounded-[10px]
            text-[13px] text-ink focus:border-ink outline-none
            transition-colors placeholder:text-[#a3a3a3]
            pl-[36px] pr-[12px] cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
          `}
          {...props}
        />
        {(selectedDate || rangeStart) && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedDate(null);
              setRangeStart(null);
              setRangeEnd(null);
              onChange?.('');
              onDateRangeChange?.('', '');
            }}
            className="absolute right-[8px] top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Calendar Popup */}
      {isOpen && !disabled && (
        <div className="absolute top-[44px] left-0 z-50 bg-white border border-line rounded-[12px] shadow-lg p-4 w-[320px]">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              className="p-1 hover:bg-canvas rounded-[6px] transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h3 className="text-[14px] font-bold text-ink">
              {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <button
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              className="p-1 hover:bg-canvas rounded-[6px] transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-[11px] font-bold text-muted py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map(day => {
              const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
              const isSelected = selectedDate && formatDate(date) === formatDate(selectedDate);
              const isRangeStart = rangeStart && formatDate(date) === formatDate(rangeStart);
              const isRangeEnd = rangeEnd && formatDate(date) === formatDate(rangeEnd);
              const isInRange = rangeStart && rangeEnd && date >= rangeStart && date <= rangeEnd;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`
                    p-1 text-[12px] font-semibold rounded-[6px] transition-all
                    ${isSelected || isRangeStart || isRangeEnd
                      ? 'bg-ink text-white'
                      : isInRange
                      ? 'bg-line text-ink'
                      : 'text-ink hover:bg-canvas'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick select presets */}
          <div className="border-t border-line mt-4 pt-3">
            <p className="text-[10px] font-bold text-muted uppercase mb-2">Quick select</p>
            <div className="grid grid-cols-2 gap-2">
              {['Today', 'This Week', 'This Month', 'Last 30 Days'].map(preset => (
                <button
                  key={preset}
                  onClick={() => {
                    const today = new Date();
                    let start, end;
                    switch (preset) {
                      case 'Today':
                        start = end = today;
                        break;
                      case 'This Week':
                        start = new Date(today.setDate(today.getDate() - today.getDay()));
                        end = new Date(today.setDate(today.getDate() + 6));
                        break;
                      case 'This Month':
                        start = new Date(today.getFullYear(), today.getMonth(), 1);
                        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                        break;
                      case 'Last 30 Days':
                        end = new Date();
                        start = new Date(end.setDate(end.getDate() - 30));
                        break;
                      default:
                        break;
                    }
                    if (mode === 'range') {
                      setRangeStart(start);
                      setRangeEnd(end);
                      onDateRangeChange?.(formatDate(start), formatDate(end));
                    }
                    setIsOpen(false);
                  }}
                  className="text-[11px] font-bold text-[#6366f1] hover:bg-[#eef2ff] rounded-[6px] py-1 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
});
DatePicker.displayName = 'DatePicker';
export default DatePicker;
