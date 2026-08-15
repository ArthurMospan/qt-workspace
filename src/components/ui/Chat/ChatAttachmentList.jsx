'use client';

import { useEffect, useState } from 'react';
import { Eye, FileText, Film, Image as ImageIcon, Music2, X } from 'lucide-react';
import {
  chatAttachmentKind,
  formatChatFileSize,
} from '@/lib/utils/chatAttachments.mjs';
import { useChatAttachmentAccess } from '@/lib/hooks/useChatAttachmentAccess';

const KIND_ICON = {
  image: ImageIcon,
  video: Film,
  audio: Music2,
  pdf: FileText,
  file: FileText,
};

function AttachmentTile({
  attachment,
  previewUrl,
  onOpen,
  onRemove,
  compact = false,
  dark = false,
}) {
  const privateAccess = useChatAttachmentAccess(attachment);
  const url = previewUrl || privateAccess.url;
  const kind = chatAttachmentKind({ ...attachment, previewUrl: url });
  const name = attachment?.name || 'Файл';
  const sizeLabel = formatChatFileSize(attachment?.size);
  const Icon = KIND_ICON[kind] || FileText;
  const isImage = kind === 'image' && url;

  if (isImage) {
    const content = (
      <>
        <span className={`relative block w-full overflow-hidden bg-canvas ${compact ? 'h-[96px]' : 'h-[140px]'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {!onRemove && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white">
                <Eye size={15} />
              </span>
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Прибрати ${name}`}
              className="absolute right-2 top-2 z-10 rounded-[7px] bg-black/55 p-1.5 text-white hover:bg-black/70"
            >
              <X size={14} />
            </button>
          )}
        </span>
        <span className={`flex items-center gap-2 px-3 py-2 ${dark ? 'bg-white/10' : 'bg-white/90'}`}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold">{name}</span>
            {sizeLabel && <span className={`block text-[10px] ${dark ? 'text-white/55' : 'text-faint'}`}>{sizeLabel}</span>}
          </span>
        </span>
      </>
    );
    const className = `group block w-full overflow-hidden rounded-[10px] border text-left transition-colors ${
      dark
        ? 'border-white/10 text-white hover:border-white/20'
        : 'border-black/[0.06] text-ink hover:border-[#d7d7d7]'
    }`;

    return onRemove
      ? <div className={className}>{content}</div>
      : (
        <button
          type="button"
          onClick={() => onOpen?.({
            ...attachment,
            previewUrl: url,
            secureDownloadUrl: privateAccess.downloadUrl,
          })}
          className={className}
          aria-label={`Переглянути ${name}`}
        >
          {content}
        </button>
      );
  }

  const content = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] ${dark ? 'bg-white/10' : 'bg-canvas'}`}>
        <Icon size={16} className={dark ? 'text-white/65' : 'text-muted'} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold">{name}</span>
        <span className={`block truncate text-[10px] ${dark ? 'text-white/55' : 'text-faint'}`}>
          {sizeLabel || (kind === 'pdf' ? 'PDF' : kind === 'video' ? 'Відео' : kind === 'audio' ? 'Аудіо' : 'Файл')}
        </span>
      </span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Прибрати ${name}`}
          className={`shrink-0 rounded-[6px] p-1 ${dark ? 'text-white/55 hover:bg-white/10 hover:text-white' : 'text-faint hover:bg-canvas hover:text-ink'}`}
        >
          <X size={13} />
        </button>
      ) : null}
    </>
  );
  const className = `flex min-w-0 w-full items-center gap-3 rounded-[8px] border border-transparent px-2 py-2 text-left transition-colors ${
    dark
      ? 'bg-white/10 text-white hover:bg-white/15'
      : 'bg-white/80 text-ink hover:border-[#d7d7d7] hover:bg-white'
  }`;

  return url && !onRemove
    ? (
      <button
        type="button"
        onClick={() => onOpen?.({
          ...attachment,
          previewUrl: url,
          secureDownloadUrl: privateAccess.downloadUrl,
        })}
        className={className}
        aria-label={`Переглянути ${name}`}
      >
        {content}
      </button>
    )
    : <div className={className}>{content}</div>;
}

function PendingAttachment({ file, onRemove, compact }) {
  const [previewUrl] = useState(() => file?.type?.startsWith('image/') ? URL.createObjectURL(file) : '');

  useEffect(() => {
    if (!previewUrl) return undefined;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <AttachmentTile
      attachment={file}
      previewUrl={previewUrl}
      onRemove={onRemove}
      compact={compact}
    />
  );
}

/**
 * The files attached to a sent message, as a grid of tiles.
 *
 * @param {object[]} props.attachments The stored files.
 * @param {(attachment) => void} props.onOpen Opens one in the viewer.
 * @param {boolean} props.compact Denser tiles, for threads and narrow panes.
 * @param {boolean} props.dark Inverted tiles, for a message bubble on a dark surface.
 * @param {string} props.className Placement in the parent only.
 */
export function ChatAttachmentList({
  attachments = [],
  onOpen,
  compact = false,
  dark = false,
  className = '',
}) {
  if (attachments.length === 0) return null;
  return (
    <div className={`mt-2 grid min-w-0 w-full max-w-[560px] grid-cols-1 gap-1.5 sm:min-w-[210px] sm:grid-cols-2 ${className}`}>
      {attachments.map((attachment, index) => (
        <AttachmentTile
          key={`${attachment.chatAttachmentKey || attachment.name || 'file'}-${index}`}
          attachment={attachment}
          onOpen={onOpen}
          compact={compact}
          dark={dark}
        />
      ))}
    </div>
  );
}

/**
 * The same grid, before the message is sent: local files that can still be
 * removed. Separate from `ChatAttachmentList` because a picked `File` and a
 * stored attachment are different things, and only one of them can be dropped.
 *
 * @param {File[]} props.files Files picked but not yet uploaded.
 * @param {(index: number) => void} props.onRemove Drops one from the selection.
 * @param {boolean} props.compact Denser tiles.
 * @param {string} props.className Placement in the parent only.
 */
export function PendingChatAttachments({ files = [], onRemove, compact = true, className = '' }) {
  if (files.length === 0) return null;
  return (
    <div className={`grid grid-cols-1 gap-1.5 sm:grid-cols-2 ${className}`}>
      {files.map((file, index) => (
        <PendingAttachment
          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
          file={file}
          compact={compact}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}
