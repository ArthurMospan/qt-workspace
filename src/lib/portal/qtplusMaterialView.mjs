/**
 * Чисті view-model хелпери матеріалів QuickTeam+ (Фаза 4a′).
 * Без `server-only` / Firebase — виконується під `node --test`.
 *
 * Схема матеріалу — з РЕАЛЬНОГО порталу (qt/src/components/MaterialsGrid.jsx,
 * qt/src/lib/hooks/useMaterials.js):
 *   previewUrl — файли/зображення/відео/PDF/документи (Cloudinary)
 *   audioUrl   — аудіо (Cloudinary)
 *   url        — ТІЛЬКИ type='link'
 * Фаза 4a читала `url` для всього й тому рендерила файли без посилання.
 */

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'tiff', 'bmp', 'avif'];
const VIDEO_EXT = ['mp4', 'mov', 'avi', 'mkv', 'webm'];
const AUDIO_EXT = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'];
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp'];
const TEXT_EXT = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'html', 'htm', 'json', 'py', 'go', 'php', 'c', 'cpp', 'h', 'java', 'swift', 'kt', 'sql', 'yaml', 'yml', 'xml', 'csv'];

const PASSTHROUGH_KINDS = ['link', 'checklist', 'poll', 'note'];

const BADGE = {
  pdf:    { label: 'PDF',   color: '#ef4444', bg: '#fee2e2' },
  image:  { label: 'IMG',   color: '#3b82f6', bg: '#dbeafe' },
  video:  { label: 'VIDEO', color: '#f97316', bg: '#ffedd5' },
  audio:  { label: 'AUDIO', color: '#1f1f1f', bg: '#f5f5f5' },
  office: { label: 'DOC',   color: '#3b82f6', bg: '#dbeafe' },
  text:   { label: 'TXT',   color: '#64748b', bg: '#f1f5f9' },
  file:   { label: 'FILE',  color: '#9a9a9a', bg: '#f5f5f5' },
};

/** Розширення з назви: 'logo.PNG' -> 'png'. */
export function extOf(title) {
  if (typeof title !== 'string') return '';
  const i = title.lastIndexOf('.');
  if (i <= 0 || i === title.length - 1) return '';
  return title.slice(i + 1).toLowerCase();
}

/**
 * URL матеріалу за правилами порталу. Пропускаємо лише http(s) —
 * javascript:/data: у href дали б XSS через дані порталу.
 */
export function resolveMaterialUrl(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const candidate = [m.audioUrl, m.previewUrl, m.url].find((v) => typeof v === 'string' && v);
  if (!candidate) return null;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? candidate : null;
}

/** Вид матеріалу. Розширення важливіше за `type`: портал кладе відео як type='file'. */
export function kindOf(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  if (PASSTHROUGH_KINDS.includes(m.type)) return m.type;
  // Явний сигнал аудіо перемагає розширення й мусить стояти ПЕРЕД відео: диктофон
  // порталу кодує запис через MediaRecorder у audio/webm або audio/mp4 і зберігає
  // title='audio-recording-*.webm' — а webm/mp4 також у списку відео. Тому на
  // розширення покладатись не можна; type:'audio' та audioUrl однозначні (у відео
  // їх немає — воно приходить як type:'file' з previewUrl).
  if (m.type === 'audio' || (typeof m.audioUrl === 'string' && m.audioUrl)) return 'audio';
  const ext = extOf(m.title);
  if (AUDIO_EXT.includes(ext)) return 'audio';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  if (OFFICE_EXT.includes(ext)) return 'office';
  if (TEXT_EXT.includes(ext)) return 'text';
  if (m.type === 'image') return 'image';
  return 'file';
}

/** Бейдж типу: підпис + кольори. Єдине місце з сирим hex — це не бренд-палітра. */
export function badgeFor(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const kind = kindOf(m);
  const ext = extOf(m.title);
  const base = BADGE[kind] || BADGE.file;
  if (kind === 'office' || kind === 'text' || kind === 'file') {
    return { ...base, label: ext ? ext.toUpperCase() : base.label };
  }
  return base;
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Сирий док матеріалу -> готова до рендеру модель. */
export function toMaterialView(raw) {
  const m = raw && typeof raw === 'object' ? raw : {};
  const kind = kindOf(m);
  const url = resolveMaterialUrl(m);
  const title = (typeof m.title === 'string' && m.title.trim()) || 'Без назви';

  let checklist = null;
  if (kind === 'checklist') {
    const items = Array.isArray(m.items) ? m.items : [];
    const checkedItems = Array.isArray(m.checkedItems) ? m.checkedItems : [];
    const total = items.length;
    const done = checkedItems.length;
    checklist = { items, checkedItems, done, total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  let poll = null;
  if (kind === 'poll') {
    const options = Array.isArray(m.options) ? m.options : [];
    const votes = Array.isArray(m.votes) ? m.votes : [];
    const total = votes.reduce((a, b) => a + (Number(b) || 0), 0);
    poll = {
      total,
      results: options.map((option, i) => {
        const count = Number(votes[i]) || 0;
        return { option, count, percent: total ? Math.round((count / total) * 100) : 0 };
      }),
    };
  }

  const note = kind === 'note'
    ? { content: typeof m.content === 'string' ? m.content : '', source: m.source || null }
    : null;

  const link = kind === 'link'
    ? {
        domain: domainOf(typeof m.url === 'string' ? m.url : ''),
        image: m.ogImage || null,
        title: m.ogTitle || title,
        description: m.ogDescription || null,
      }
    : null;

  return {
    id: m.id || null,
    kind,
    title,
    subtitle: m.desc || m.source || null,
    url,
    badge: badgeFor(m),
    checklist,
    poll,
    note,
    link,
  };
}
