'use client';
// src/app/workspace/[projectId]/portal/page.js
// Portal tab: real-time chat + materials from client portal
import { use, useState } from 'react';
import { useAppContext }  from '@/lib/context/AppContext';
import { useStagesForProject } from '@/lib/hooks/useStagesForProject';
import { usePortalChat } from '@/lib/hooks/usePortalIntegration';
import { Input, Textarea, Button, Alert, LoadingSpinner, Card, EmptyState, PageHeader } from '@/components/ui';
import { MessageSquare, Image as ImageIcon, FileCheck, Clock, ExternalLink, CheckCircle, XCircle, AlertCircle, Send, LayoutGrid, Users, BarChart2 } from 'lucide-react';

const TABS = (projectId) => [
  { id: 'board',      label: 'Дошка',     icon: LayoutGrid, href: `/workspace/${projectId}` },
  { id: 'team',       label: 'Команда',   icon: Users, href: `/workspace/${projectId}` },
  { id: 'analytics',  label: 'Аналітика', icon: BarChart2, href: `/workspace/${projectId}` },
];

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL || 'https://qt-green.vercel.app';

const STATUS_CFG = {
  approved:  { label: 'Погоджено',     color: '#10b981', Icon: CheckCircle },
  rejected:  { label: 'Відхилено',     color: '#ef4444', Icon: XCircle },
  pending:   { label: 'На погодженні', color: '#f97316', Icon: Clock },
  undefined: { label: 'Не надіслано',  color: '#9a9a9a', Icon: AlertCircle },
};

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'щойно';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} хв тому`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} год тому`;
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export default function PortalPage({ params }) {
  const { projectId } = use(params);
  const { projects, currentUser } = useAppContext();
  const project = projects?.find(p => p.id === projectId);

  const { stages, loading: stagesLoading } = useStagesForProject(projectId);
  const { messages, loading: chatLoading, sendPortalMessage } = usePortalChat(projectId);

  const [replyText, setReplyText] = useState('');
  const [sending,   setSending]   = useState(false);

  const handleSend = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    await sendPortalMessage(replyText, currentUser);
    setReplyText('');
    setSending(false);
  };

  const materials = stages.flatMap(s =>
    (s.materials || []).map(m => ({ ...m, stageName: s.title || s.name }))
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f4f4f5] pt-[56px]">
      {/* Shared project tab bar — Portal tab highlighted */}
      <PageHeader
        variant="alt"
        title={project?.name}
        tabs={TABS(projectId)}
        actions={
          <div className="relative flex items-center gap-[6px] px-[14px] py-[7px] rounded-[10px] text-[12px] font-semibold transition-all whitespace-nowrap bg-[#6366f1]/10 text-[#6366f1]">
            <MessageSquare size={13} />
            QuickTeam+
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">

      <div className="p-7 grid grid-cols-[1fr_360px] gap-5 items-start">

        {/* ── Materials ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-bold text-[#1f1f1f]">
              Матеріали <span className="text-[#9a9a9a] font-normal">({materials.length})</span>
            </h3>
            <a href={PORTAL_URL} target="_blank" rel="noopener"
              className="flex items-center gap-1 text-[11px] text-[#6366f1] hover:underline font-medium">
              <ExternalLink size={11} /> Відкрити в порталі
            </a>
          </div>

          {stagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="md" />
            </div>
          ) : materials.length === 0 ? (
            <Card variant="white" padding="lg">
              <EmptyState
                icon={ImageIcon}
                title="Матеріалів поки немає"
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {stages.map(stage => {
                const stageMats = stage.materials || [];
                if (stageMats.length === 0) return null;
                return (
                  <Card key={stage.id} variant="white" padding="none" className="overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#f0f0f0] flex items-center gap-2">
                      <FileCheck size={13} className="text-[#9a9a9a]" />
                      <p className="text-[12px] font-bold text-[#1f1f1f]">{stage.title || stage.name || 'Без назви'}</p>
                      <span className="text-[10px] text-[#cfcfcf]">· {stageMats.length} матеріал{stageMats.length > 1 ? 'и' : ''}</span>
                    </div>
                    {stageMats.map(mat => {
                      const statusKey = mat.status || (mat.clientApprovalPending ? 'pending' : 'undefined');
                      const cfg = STATUS_CFG[statusKey] || STATUS_CFG.undefined;
                      const StatusIcon = cfg.Icon;
                      return (
                        <div key={mat.id || mat.url} className="flex items-center gap-4 px-5 py-4 border-b border-[#f4f4f5] last:border-0 hover:bg-[#fafafa] transition-colors">
                          {/* Preview */}
                          <div className="w-[48px] h-[48px] bg-[#f4f4f5] rounded-[8px] shrink-0 overflow-hidden flex items-center justify-center">
                            {mat.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(mat.url) ? (
                              <img src={mat.url} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                              <ImageIcon size={18} className="text-[#cfcfcf]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{mat.name || mat.title || 'Без назви'}</p>
                            {mat.description && <p className="text-[11px] text-[#9a9a9a] truncate mt-[2px]">{mat.description}</p>}
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-[5px] shrink-0">
                            <StatusIcon size={13} style={{ color: cfg.color }} />
                            <span className="text-[10px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                          </div>

                          {mat.url && (
                            <a href={mat.url} target="_blank" rel="noopener"
                              className="shrink-0 p-2 text-[#cfcfcf] hover:text-[#6366f1] transition-colors">
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Chat ──────────────────────────────────────────────────── */}
        <Card variant="white" padding="none" className="overflow-hidden sticky top-0">
          <div className="px-5 py-4 border-b border-[#f0f0f0] flex items-center gap-2">
            <MessageSquare size={14} className="text-[#9a9a9a]" />
            <h3 className="text-[13px] font-bold text-[#1f1f1f]">Чат з клієнтом</h3>
          </div>

          <div className="flex flex-col gap-0 max-h-[500px] overflow-y-auto divide-y divide-[#f4f4f5]">
            {chatLoading ? (
              <div className="flex items-center justify-center py-10">
                <LoadingSpinner size="sm" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center py-10">
                <EmptyState
                  icon={MessageSquare}
                  description="Повідомлень поки немає"
                />
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={msg.id || i} className="px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-[3px]">
                    <span className="text-[12px] font-bold text-[#1f1f1f]">{msg.senderName || 'Клієнт'}</span>
                    <span className="text-[10px] text-[#cfcfcf]">{timeAgo(msg.createdAt || msg.timestamp)}</span>
                  </div>
                  <p className="text-[12px] text-[#4a4a4a] leading-relaxed">{msg.text || msg.message}</p>
                </div>
              ))
            )}
          </div>

          {/* Reply input */}
          <div className="px-4 py-3 border-t border-[#f0f0f0] bg-[#f4f4f5] flex gap-2">
            <Input
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Відповісти клієнту..."
              disabled={sending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!replyText.trim() || sending}
              style="primary"
              color="dark"
              size="icon"
            >
              <Send size={13} />
            </Button>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
}
