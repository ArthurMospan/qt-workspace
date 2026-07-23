export function chatAttachmentUrl(attachment) {
  return attachment?.previewUrl
    || attachment?.url
    || attachment?.downloadUrl
    || attachment?.downloadURL
    || attachment?.audioUrl
    || '';
}

export function chatAttachmentKind(attachment) {
  const declaredType = String(
    attachment?.resourceType || attachment?.mimeType || attachment?.type || '',
  ).toLowerCase();
  const source = `${attachment?.name || ''} ${chatAttachmentUrl(attachment)}`;

  if (
    declaredType === 'image'
    || declaredType.startsWith('image/')
    || /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif|tiff?)(?:[?#]|$)/i.test(source)
  ) return 'image';
  if (
    declaredType === 'video'
    || declaredType.startsWith('video/')
    || /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source)
  ) return 'video';
  if (
    declaredType === 'audio'
    || declaredType.startsWith('audio/')
    || /\.(mp3|wav|ogg|m4a)(?:[?#]|$)/i.test(source)
  ) return 'audio';
  if (declaredType === 'application/pdf' || /\.pdf(?:[?#]|$)/i.test(source)) return 'pdf';
  return 'file';
}

export function isChatMediaAttachment(attachment) {
  return ['image', 'video', 'audio'].includes(chatAttachmentKind(attachment));
}

export function formatChatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex > 0 && value < 10 ? 1 : 0)} ${units[unitIndex]}`;
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
