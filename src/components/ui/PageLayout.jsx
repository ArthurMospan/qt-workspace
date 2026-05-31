'use client';

export default function PageLayout({
  header,
  children,
  className = '',
}) {
  return (
    <div className={`flex-1 flex flex-col overflow-hidden bg-[#f4f4f5] ${className}`}>
      {/* Header section - white background, border */}
      {header && (
        <div className="bg-white border-b border-[#f0f0f0] shrink-0">
          {header}
        </div>
      )}

      {/* Content section - white background with px-8 padding, scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white px-[32px] py-[20px] min-h-full">
          {children}
        </div>
      </div>
    </div>
  );
}
