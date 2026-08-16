// Chat-specific attachment helpers. What a file *is* is not one of them: that
// answer is shared with the task surface and lives in `attachmentKinds.mjs`,
// because a spreadsheet posted in a channel and the same spreadsheet dropped on
// a task are the same spreadsheet.

import {
  attachmentKind,
  attachmentUrl,
  formatFileSize,
  isMediaKind,
} from './attachmentKinds.mjs';

export function chatAttachmentUrl(attachment) {
  return attachmentUrl(attachment);
}

export function chatAttachmentKind(attachment) {
  return attachmentKind(attachment);
}

export function isChatMediaAttachment(attachment) {
  return isMediaKind(attachmentKind(attachment));
}

export function formatChatFileSize(bytes) {
  return formatFileSize(bytes);
}

export function messageMatchesChatSearch(message, rawSearchTerm) {
  const searchTerm = String(rawSearchTerm || '').trim().toLocaleLowerCase('uk-UA');
  if (!searchTerm) return true;

  const searchable = [
    message?.text,
    message?.user,
    ...(message?.attachments || []).flatMap(attachment => [
      attachment?.name,
      attachment?.type,
      attachment?.resourceType,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('uk-UA');

  return searchable.includes(searchTerm);
}

export function collectChatAttachments(messages) {
  return (messages || []).flatMap(message =>
    (message.attachments || [])
      .filter(attachment => chatAttachmentUrl(attachment))
      .map((attachment, index) => ({
        ...attachment,
        messageId: message.id,
        senderId: message.senderId,
        senderName: message.user,
        messageCreatedAt: message.createdAt,
        chatAttachmentKey: `${message.id}-${index}-${attachment.name || 'attachment'}`,
      })),
  );
}
