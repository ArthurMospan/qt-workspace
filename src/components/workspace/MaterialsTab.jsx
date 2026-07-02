'use client';
// src/components/workspace/MaterialsTab.jsx — Internal project files (NOT QT portal)
// Portal chat + QT materials live in /workspace/[projectId]/portal page
import { useState, useRef } from 'react';
import {
  File, FileText, FileImage, Link as LinkIcon, Plus, Trash2,
  ExternalLink, Upload, FolderOpen, Calendar,
} from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { db } from '@/lib/firebase';
import {
  collection, addDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useConfirm } from '@/components/ui';

const FILE_ICONS = {
  image:    FileImage,
  pdf:      FileText,
  doc:      FileText,
  link:     LinkIcon,
  other:    File,
};

function getFileType(url = '') {
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return 'image';
  if (/\.pdf$/i.test(url)) return 'pdf';
  if (/\.(doc|docx|txt|md)$/i.test(url)) return 'doc';
  if (/^https?:\/\//.test(url)) return 'link';
  return 'other';
}

function fmtDate(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MaterialsTab({ projectId }) {
  const { currentUser } = useAppContext();
  const confirmDialog = useConfirm();
  const [files, setFiles]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [addUrl, setAddUrl]     = useState('');
  const [addName, setAddName]   = useState('');
  const [addNote, setAddNote]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [filter, setFilter]     = useState('all');

  // Load from Firestore: projectFiles sub-collection
  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, 'projectFiles'), where('projectId', '==', projectId));
    const unsub = onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      setFiles(docs);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  const handleAdd = async () => {
    if (!addUrl.trim() && !addName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'projectFiles'), {
        projectId,
        url: addUrl.trim(),
        name: addName.trim() || addUrl.trim(),
        note: addNote.trim(),
        type: getFileType(addUrl.trim()),
        addedBy: currentUser?.id || currentUser?.uid || null,
        addedByName: currentUser?.name || currentUser?.email || '',
        createdAt: serverTimestamp(),
      });
      setAddUrl(''); setAddName(''); setAddNote('');
      setShowAdd(false);
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog({ title: 'Видалити файл?', confirmText: 'Видалити', danger: true }))) return;
    await deleteDoc(doc(db, 'projectFiles', id));
  };

  const filtered = filter === 'all' ? files : files.filter(f => f.type === filter);

  const types = [...new Set(files.map(f => f.type))];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f4f4f5]">
      <div className="max-w-[860px] mx-auto px-6 py-5">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[16px] font-bold text-[#1f1f1f]">Матеріали проєкту</h2>
            <p className="text-[12px] text-[#9a9a9a] mt-[2px]">Внутрішні файли, посилання та документи команди</p>
          </div>
          <Button style="primary" size="md" icon={Plus} onClick={() => setShowAdd(v => !v)}>
            Додати матеріал
          </Button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white border border-[#e9e9e9] rounded-[16px] p-5 mb-5">
            <p className="text-[13px] font-semibold text-[#1f1f1f] mb-3">Новий матеріал</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-1 block">URL або посилання</label>
                <Input
                  autoFocus
                  value={addUrl}
                  onChange={e => setAddUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-1 block">Назва</label>
                  <Input
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="Опціонально"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-1 block">Нотатка</label>
                  <Input
                    value={addNote}
                    onChange={e => setAddNote(e.target.value)}
                    placeholder="Опціонально"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button style="primary" size="md" disabled={saving || (!addUrl.trim() && !addName.trim())} loading={saving} onClick={handleAdd}>
                  {saving ? 'Збереження...' : 'Додати'}
                </Button>
                <Button style="secondary" size="md" onClick={() => { setShowAdd(false); setAddUrl(''); setAddName(''); setAddNote(''); }}>
                  Скасувати
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Type filter */}
        {types.length > 1 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {['all', ...types].map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-3 py-[5px] text-[11px] font-semibold rounded-full border transition-all ${
                  filter === t
                    ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]'
                    : 'bg-white text-[#9a9a9a] border-[#e9e9e9] hover:border-[#1f1f1f]'
                }`}>
                {t === 'all' ? 'Всі' : t === 'image' ? 'Зображення' : t === 'pdf' ? 'PDF' : t === 'doc' ? 'Документи' : t === 'link' ? 'Посилання' : 'Інше'}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <FolderOpen size={36} className="text-[#e9e9e9] mb-3" />
            <p className="text-[14px] font-semibold text-[#cfcfcf] mb-1">Матеріалів немає</p>
            <p className="text-[12px] text-[#e0e0e0]">Додайте посилання на файли, документи або дизайни</p>
          </div>
        ) : (
          <div className="bg-white border border-[#e9e9e9] rounded-[16px] overflow-hidden">
            {filtered.map((file, i) => {
              const Icon = FILE_ICONS[file.type] || FILE_ICONS.other;
              return (
                <div key={file.id}
                  className={`flex items-center gap-4 px-5 py-[14px] group hover:bg-[#fafafa] transition-colors ${i < filtered.length - 1 ? 'border-b border-[#f0f0f0]' : ''}`}>
                  {/* Preview */}
                  <div className="w-[40px] h-[40px] bg-[#f4f4f5] rounded-[8px] shrink-0 overflow-hidden flex items-center justify-center border border-[#e9e9e9]">
                    {file.type === 'image' && file.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={file.url} alt="" className="w-full h-full object-cover"
                        onError={e => { e.target.style.display='none'; }} />
                    ) : (
                      <Icon size={16} className="text-[#9a9a9a]" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#1f1f1f] truncate">{file.name}</p>
                    <div className="flex items-center gap-3 mt-[2px]">
                      {file.note && <p className="text-[11px] text-[#9a9a9a] truncate">{file.note}</p>}
                      <span className="text-[10px] text-[#cfcfcf] flex items-center gap-1 shrink-0">
                        <Calendar size={9} />
                        {fmtDate(file.createdAt)}
                      </span>
                      {file.addedByName && (
                        <span className="text-[10px] text-[#cfcfcf] shrink-0">{file.addedByName}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.url && (
                      <a href={file.url} target="_blank" rel="noopener"
                        className="p-[6px] text-[#9a9a9a] hover:text-[#1f1f1f] hover:bg-[#f0f0f0] rounded-[6px] transition-all">
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button onClick={() => handleDelete(file.id)}
                      className="p-[6px] text-[#cfcfcf] hover:text-red-500 hover:bg-red-50 rounded-[6px] transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
