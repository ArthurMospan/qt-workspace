'use client';

import React from 'react';
import { ArrowLeft, Hash, Info, Pin } from 'lucide-react';
import IconAction from '../IconAction';
import UserAvatar from '../DataDisplay/UserAvatar';

// ─── UI Kit: Chat Conversation Header ────────────────────────────────────────
// The bar above a conversation: who you are talking to, how many messages are
// pinned, and the way back out on a phone.
//
// /ui-kit already showed this header — as a hand-typed copy inside the composer
// preview, with a plain `<Info>` glyph where the product has a real toggle and
// no pinned counter at all. That copy is gone; the preview renders this.
export default function ChatConversationHeader({
  type = 'channel',
  title,
  subtitle,
  statusEmoji,
  statusTitle,
  user,
  online = false,
  pinnedCount = 0,
  onOpenPinned,
  infoLabel,
  infoActive = false,
  onToggleInfo,
  onBack,
}) {
  return (
    <div className="relative z-10 flex min-h-[64px] shrink-0 items-center gap-2 border-b border-line/70 bg-canvas/90 px-4 py-3 backdrop-blur-xl">
      {/* A 26px box: an 18px glyph with 4px around it, which is not on the
          IconAction scale (20/24/28/30/32/36). Inventing a size for one caller
          is what the variant budget exists to stop, so the geometry stays here
          in the component that owns it — the same treatment the pinned counter
          below gets. When Settings and Team adopt this back control, it earns a
          shared component of its own. */}
      <button
        type="button"
        onClick={onBack}
        className="md:hidden -ml-1 p-1 text-muted hover:text-ink transition-colors shrink-0"
        title="До списку чатів"
      >
        <ArrowLeft size={18} />
      </button>
      {type === 'channel' ? (
        <Hash size={17} className="text-ink shrink-0" />
      ) : (
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden">
            <UserAvatar user={user} size={32} />
          </div>
          {online && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#10b981] border-2 border-canvas" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h2 className="ui-type-compact-title text-ink truncate flex items-center gap-1.5">
          {title}
          {statusEmoji && (
            <span className="cursor-help" title={statusTitle || 'Статус користувача'}>
              {statusEmoji}
            </span>
          )}
        </h2>
        {subtitle && <p className="text-[11px] text-muted truncate">{subtitle}</p>}
      </div>

      {/* Pinned message count */}
      {pinnedCount > 0 && (
        <button
          type="button"
          onClick={onOpenPinned}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:border-[#cfcfcf]"
        >
          <Pin size={12} />
          <span>{pinnedCount} закріплено</span>
        </button>
      )}

      {/* Conversation info */}
      <IconAction
        onClick={onToggleInfo}
        icon={Info}
        label={infoLabel}
        appearance={infoActive ? 'soft' : 'quiet'}
        composition="chat-panel-action"
      />
    </div>
  );
}
