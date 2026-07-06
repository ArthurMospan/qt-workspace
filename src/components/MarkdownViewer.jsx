import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownViewer({ content, className = '' }) {
  if (!content) return null;

  return (
    <div className={`markdown-body text-[14px] text-ink leading-relaxed break-words ${className}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({node, ...props}) => <h1 className="text-[24px] font-bold mt-6 mb-4 pb-2 border-b border-[#f0f0f0]" {...props} />,
          h2: ({node, ...props}) => <h2 className="text-[20px] font-bold mt-6 mb-4 pb-2 border-b border-[#f0f0f0]" {...props} />,
          h3: ({node, ...props}) => <h3 className="text-[16px] font-bold mt-6 mb-3" {...props} />,
          p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="" {...props} />,
          a: ({node, ...props}) => <a className="text-[#6366f1] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-line pl-4 italic text-[#4a4a4a] mb-4" {...props} />,
          pre: ({node, ...props}) => (
            <pre className="bg-ink text-white p-4 rounded-[8px] overflow-x-auto mb-4 text-[13px] font-mono [&>code]:!bg-transparent [&>code]:!p-0 [&>code]:!text-inherit" {...props} />
          ),
          code: ({node, className, children, ...props}) => (
            <code className={`bg-[#f0f0f0] px-[6px] py-[2px] rounded-[4px] text-[13px] font-mono ${className || ''}`} {...props}>
              {children}
            </code>
          ),
          table: ({node, ...props}) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full border-collapse border border-line" {...props} />
            </div>
          ),
          th: ({node, ...props}) => <th className="border border-line px-4 py-2 bg-canvas font-bold" {...props} />,
          td: ({node, ...props}) => <td className="border border-line px-4 py-2" {...props} />,
          input: ({node, type, checked, ...props}) => {
            if (type === 'checkbox') {
              return <input type="checkbox" checked={checked} readOnly className="mr-2 mt-1 w-4 h-4 rounded-[4px] text-[#6366f1] focus:ring-[#6366f1]" {...props} />;
            }
            return <input type={type} {...props} />;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
