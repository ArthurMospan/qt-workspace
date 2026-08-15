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

/**
 * One file on a task: its type glyph, name, size, and the actions available for
 * it. What the actions are depends on where the row is — editing a description
 * offers "insert", an archived task offers only download.
 *
 * @param {object} props.attachment The stored file record.
 * @param {boolean} props.isEditing The description is open for editing, so inserting a link is possible.
 * @param {boolean} props.isArchived Read-only history: nothing may be deleted.
 * @param {() => void} props.onOpen Opens the file in the viewer.
 * @param {() => void} props.onInsert Inserts a markdown link to it into the description.
 * @param {() => void} props.onDelete Removes it from the task.
 * @param {() => void} props.onDownload Downloads it.
 */
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
    <div data-ui-surface="nested-card" data-ui-padding="compact-row" className="ui-surface flex min-w-0 items-center gap-3 transition-colors hover:bg-canvas">
      {/* Thumbnail, text, and the whitespace between them are one target. The
          old split target underlined only the filename, so a large row looked
          clickable in one tiny place even though the preview action was the
          same everywhere. */}
      <button
        type="button"
        onClick={() => onOpen(attachment)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[8px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        aria-label={`Переглянути ${attachment.name}`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white">
          {fileType === 'image' && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : <FileText size={16} className="text-muted" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-ink">{attachment.name}</span>
          <span className="block text-[10px] text-faint">{fmtBytes(attachment.size)}</span>
        </span>
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
