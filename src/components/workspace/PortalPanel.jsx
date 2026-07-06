'use client';
// src/components/workspace/PortalPanel.jsx
// Right-side panel showing portal chat + client materials
import { useState, useRef, useEffect } from 'react';
import { usePortalChat } from '@/lib/hooks/usePortalIntegration';
import { X, MessageSquare, Image as ImageIcon, ExternalLink, ChevronDown } from 'lucide-react';
import UserAvatar from '@/components/UserAvatar';

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

export default function PortalPanel({ projectId, materials = [], onClose }) {
  const [tab, setTab] = useState('chat');
  const { messages, loading } = usePortalChat(projectId);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (tab === 'chat') bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, tab]);

  return (
    <div className="w-[320px] shrink-0 bg-white border-l border-line flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <div className="flex gap-1">
          {[
            { id: 'chat',      label: 'Чат клієнта',  icon: MessageSquare },
            { id: 'materials', label: 'Матеріали',     icon: ImageIcon },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-[5px] px-3 py-[5px] rounded-[8px] text-[11px] font-semibold transition-all ${
                tab === id ? 'bg-ink text-white' : 'text-muted hover:text-ink hover:bg-canvas'
              }`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="text-muted hover:text-ink p-1">
          <X size={14} />
        </button>
      </div>

      {/* Chat tab */}
      {tab === 'chat' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {loading && (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-line border-t-[#1f1f1f] rounded-full animate-spin" />
            </div>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-[12px] text-faint text-center py-8">Чат порожній</p>
          )}
          {messages.map(msg => {
            const isSystem = msg.type === 'system';
            const time = msg.createdAt?.toDate?.()?.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            const dateStr = msg.createdAt?.toDate?.()?.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

            if (isSystem) return (
              <div key={msg.id} className="text-center text-[10px] text-faint py-1">{msg.text}</div>
            );

            return (
              <div key={msg.id} className="flex gap-2 items-start">
                <div className="w-[26px] h-[26px] rounded-full bg-[#f0f0f0] shrink-0 flex items-center justify-center text-[10px] font-bold text-muted overflow-hidden">
                  {msg.senderAvatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" />
                    : (msg.senderName?.[0] || '?')
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-[2px]">
                    <span className="text-[11px] font-bold text-ink">{msg.senderName || 'Гість'}</span>
                    <span className="text-[9px] text-faint">{dateStr} {time}</span>
                  </div>
                  {msg.text && (
                    <p className="text-[12px] text-ink bg-canvas rounded-[8px] px-2 py-1 leading-relaxed break-words">
                      {msg.text}
                    </p>
                  )}
                  {msg.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.imageUrl} alt="attachment" className="mt-1 rounded-[8px] max-w-full max-h-[200px] object-cover" />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Materials tab */}
      {tab === 'materials' && (
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
          {materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ImageIcon size={32} className="text-line mb-3" />
              <p className="text-[12px] text-faint">Матеріали відсутні</p>
              <a href={`${PORTAL_URL}`} target="_blank" rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1 text-[11px] text-[#6366f1] hover:underline">
                <ExternalLink size={11} /> Відкрити портал
              </a>
            </div>
          ) : (
            materials.map((m, i) => (
              <div key={m.id || i} className="border border-line rounded-[10px] overflow-hidden hover:border-faint transition-all">
                {(m.url || m.imageUrl || m.fileUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url || m.imageUrl || m.fileUrl}
                    alt={m.name || m.title || 'Матеріал'}
                    className="w-full h-[120px] object-cover bg-canvas"
                    onError={e => { e.target.style.display='none'; }}
                  />
                )}
                <div className="px-3 py-2">
                  <p className="text-[12px] font-semibold text-ink truncate">{m.name || m.title || 'Без назви'}</p>
                  {m.status && (
                    <p className="text-[10px] text-muted mt-[2px]">Статус: {m.status}</p>
                  )}
                  {m.clientApprovalPending && (
                    <span className="inline-block mt-1 text-[10px] font-bold text-[#db2777] bg-pink-50 px-2 py-[2px] rounded-full">
                      Очікує затвердження
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer — portal link */}
      <div className="px-3 py-2 border-t border-line shrink-0">
        <a href={`${PORTAL_URL}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[10px] text-muted hover:text-[#6366f1] transition-colors">
          <ExternalLink size={10} /> Відкрити клієнтський портал
        </a>
      </div>
    </div>
  );
}
