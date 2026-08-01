'use client';

// ─── UI Kit: Attachment Row ──────────────────────────────────────────────────
// One attachment on a task, as a list row: thumbnail, name and size, and the
// actions that apply to it.
//
// Four hand-written controls in one row — thumbnail, name, download, delete —
// which is why this was the densest patch of native markup on the task surface.
// It lived in IssueDetail, so /ui-kit had no way to draw an attachment and no
// way to notice the row drifting from the card beside it.
//
// The markup below is the row's own, moved without a class changing. Downloading
// is a callback rather than an import so the kit stays clear of the portal's
// transfer code: the row decides how the control looks, the page decides what
// the click does.

import React from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { detectFileType, fmtBytes, getMatFileUrl } from '@/lib/utils/issueAttachments.mjs';

export default function AttachmentRow({
  attachment,
  isEditing = false,
  isArchived = false,
  onOpen,
  onInsert,
  onDelete,
  onDownload,
}) {
  const url = getMatFileUrl(attachment);
  const fileType = detectFileType(attachment);

  return (
    <div data-ui-surface="nested-card" data-ui-padding="compact-row" className="ui-surface group flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-canvas"
        aria-label={`Переглянути ${attachment.name}`}
      >
        {fileType === 'image' && url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : <FileText size={16} className="text-muted" />}
      </button>
      {/* The name opens the preview — the obvious target, and what the
          thumbnail beside it already did. The row used to spend a slot
          on an "open in a new tab" link instead, which is the one thing
          the preview makes unnecessary; downloading is what was missing. */}
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className="min-w-0 flex-1 text-left"
        aria-label={`Переглянути ${attachment.name}`}
      >
        <p className="truncate text-[12px] font-semibold text-ink group-hover:underline">{attachment.name}</p>
        <p className="text-[10px] text-faint">{fmtBytes(attachment.size)}</p>
      </button>
      {isEditing && url && (
        <Button style="ghost" size="sm" onClick={() => onInsert(attachment, fileType, url)}>
          Вставити в опис
        </Button>
      )}
      {url && (
        <button
          type="button"
          onClick={() => onDownload(url, attachment.name)}
          className="p-2 text-faint hover:text-ink"
          aria-label={`Завантажити ${attachment.name}`}
          title="Завантажити"
        >
          <Download size={14} />
        </button>
      )}
      {!isArchived && (
        <button
          type="button"
          onClick={() => onDelete(attachment.id)}
          className="p-2 text-faint hover:text-red-500"
          aria-label={`Видалити ${attachment.name}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
