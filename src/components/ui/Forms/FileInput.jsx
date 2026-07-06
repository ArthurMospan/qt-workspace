'use client';
import React, { forwardRef, useRef } from 'react';
import { Upload, X } from 'lucide-react';

export const FileInput = forwardRef(({
  value = [],
  onChange,
  error,
  disabled = false,
  multiple = false,
  accept = '*',
  className = '',
  ...props
}, ref) => {
  const inputRef = useRef(null);
  const files = Array.isArray(value) ? value : (value ? [value] : []);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (multiple) {
      onChange?.([...files, ...newFiles]);
    } else {
      onChange?.(newFiles[0] || null);
    }
  };

  const removeFile = (index) => {
    const updated = files.filter((_, i) => i !== index);
    onChange?.(multiple ? updated : null);
  };

  return (
    <div className={`w-full ${className}`}>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        multiple={multiple}
        accept={accept}
        className="hidden"
        {...props}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`
          h-[36px] w-full bg-canvas border border-dashed border-line rounded-[10px]
          text-[13px] text-[#666666] transition-colors flex items-center justify-center gap-2
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#f0f0f0]'}
          ${error ? 'border-red-500 focus:border-red-500 bg-red-50' : ''}
        `}
      >
        <Upload size={14} className="text-muted" />
        <span>Завантажити файл</span>
      </button>

      {files.length > 0 && (
        <div className="mt-2 space-y-1">
          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-canvas px-3 py-2 rounded-[8px] text-[12px]"
            >
              <span className="text-ink truncate">
                {typeof file === 'string' ? file : file.name}
              </span>
              <button
                onClick={() => removeFile(i)}
                className="text-muted hover:text-ink p-1"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

    </div>
  );
});
FileInput.displayName = 'FileInput';
