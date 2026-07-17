/**
 * Pure, dependency-free view-model helpers for the QuickTeam+ stages/materials
 * (Phase 4a). No `server-only`/Firebase import — runs under plain `node --test`.
 */

const FILE_ICON = { file: 'file', audio: 'audio', image: 'image' };

function sum(arr) {
  return (Array.isArray(arr) ? arr : []).reduce((a, b) => a + (Number(b) || 0), 0);
}

/** Normalize a raw QuickTeam+ material doc into a render-ready view model. */
export function toMaterialView(m) {
  const raw = m && typeof m === 'object' ? m : {};
  const type = typeof raw.type === 'string' ? raw.type : '';
  const title = (typeof raw.title === 'string' && raw.title.trim()) || 'Без назви';
  const subtitle = raw.desc || raw.source || null;
  const href = raw.url || null;

  let kind = 'unknown';
  let icon = 'unknown';
  if (type === 'link') { kind = 'link'; icon = 'link'; }
  else if (type === 'checklist') { kind = 'checklist'; icon = 'checklist'; }
  else if (type === 'poll') { kind = 'poll'; icon = 'poll'; }
  else if (type === 'note') { kind = 'note'; icon = 'note'; }
  else if (Object.prototype.hasOwnProperty.call(FILE_ICON, type)) { kind = 'file'; icon = FILE_ICON[type]; }

  return {
    id: raw.id || null,
    type,
    kind,
    icon,
    title,
    subtitle,
    href,
    checklist: kind === 'checklist'
      ? {
          items: Array.isArray(raw.items) ? raw.items : [],
          checkedItems: Array.isArray(raw.checkedItems) ? raw.checkedItems : [],
        }
      : null,
    poll: kind === 'poll'
      ? {
          options: Array.isArray(raw.options) ? raw.options : [],
          votes: Array.isArray(raw.votes) ? raw.votes : [],
          total: sum(raw.votes),
        }
      : null,
    note: kind === 'note'
      ? { content: typeof raw.content === 'string' ? raw.content : '', source: raw.source || null }
      : null,
  };
}

/** Overall progress across a project's stages. */
export function stageProgress(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const total = list.length;
  const done = list.filter((s) => s && s.status === 'done').length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  return { done, total, percent };
}

/** UA label + tone key for a stage status. */
export function stageStatusMeta(status) {
  if (status === 'todo') return { label: 'Заплановано', tone: 'muted' };
  if (status === 'in-progress') return { label: 'В роботі', tone: 'active' };
  if (status === 'done') return { label: 'Завершено', tone: 'done' };
  return { label: '—', tone: 'muted' };
}
