// Attachment presentation helpers.
//
// These three decide what an attachment *looks* like — which preview to draw,
// where the file lives and how to say its size. They sat inside IssueDetail,
// which is why the attachment card and the attachment row could not move to the
// kit: the markup was portable, the three functions under it were not.
//
// Pure and free of React on purpose, so the kit component and the page that
// feeds it read the same rules instead of each keeping a copy.

export function getMatFileUrl(mat) {
  return mat.previewUrl || mat.url || mat.downloadUrl || mat.downloadURL || mat.audioUrl || '';
}

// Detect file type from name or URL
export function detectFileType(mat) {
  const name = (mat.title || mat.name || '').toLowerCase();
  const url  = getMatFileUrl(mat).toLowerCase();
  const declaredType = (mat.resourceType || mat.mimeType || mat.type || '').toLowerCase();
  const src  = `${name} ${url}`;
  if (declaredType === 'image' || declaredType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|avif|svg|heic|heif|bmp|tiff?)(?:[?#]|$)/.test(src)) return 'image';
  if (declaredType === 'video' || declaredType.startsWith('video/')) return 'video';
  if (declaredType === 'audio' || declaredType.startsWith('audio/')) return 'audio';
  if (declaredType === 'application/pdf') return 'pdf';
  if (/\.pdf/.test(src))                                    return 'pdf';
  if (/\.(mp4|mov|avi|webm|mkv)/.test(src))                return 'video';
  if (/\.(mp3|wav|m4a|ogg|aac)/.test(src))                 return 'audio';
  if (/^https?:\/\//.test(mat.url || '') && mat.type === 'link') return 'link';
  if (mat.type) return mat.type; // note, checklist, poll
  return 'file';
}

export function fmtBytes(bytes) {
  if (!bytes || bytes < 0) return '';
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let n = bytes, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i > 0 && n < 10 ? 1 : 0)} ${units[i]}`;
}
