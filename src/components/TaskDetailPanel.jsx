'use client';
// src/components/TaskDetailPanel.jsx — Light theme side panel
import { useState, useEffect } from 'react';
import { useAppContext } from '@/lib/context/AppContext';
import { useTaskChat } from '@/lib/hooks/useTaskChat';
import { useWorkflowConfig } from '@/lib/hooks/useWorkflowConfig';
import { X, Trash2, Clock, CheckSquare, Square, Plus, Send } from 'lucide-react';
import UserAvatar from './UserAvatar';
import MarkdownEditor from './MarkdownEditor';
import { Select } from '@/components/ui/Select';

const PRIORITY_CONFIG = {
  critical: { label: 'Критичний', color: '#ef4444' },
  high:     { label: 'Високий',   color: '#f97316' },
  medium:   { label: 'Середній',  color: '#eab308' },
  low:      { label: 'Низький',   color: '#9a9a9a' },
};

const TYPE_CONFIG = {
  task:    { label: 'Задача', color: '#6366f1' },
  bug:     { label: 'Баг',    color: '#ef4444' },
  feature: { label: 'Фіча',  color: '#10b981' },
  request: { label: 'Запит', color: '#f97316' },
};

const DEFAULT_STATUSES = [
  { id: 'todo',        label: 'Backlog' },
  { id: 'in-progress', label: 'В роботі' },
  { id: 'review',      label: 'Перевірка' },
  { id: 'done',        label: 'Готово' },
];

export default function TaskDetailPanel({ task, stages, teamMembers = [], onUpdate, onDelete }) {
  const { currentUser } = useAppContext();
  const { messages, sendMessage } = useTaskChat(task?.id);
  const { labels: availableLabels = [] } = useWorkflowConfig();
  const statuses = stages?.length ? stages : DEFAULT_STATUSES;

  const [tab, setTab] = useState('details'); // 'details' | 'chat'
  const [chatInput, setChatInput] = useState('');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!task) return null;

  const dueDate = task.dueDate?.toDate ? task.dueDate.toDate() : task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  const assignees = (task.assignees || [])
    .map(uid => teamMembers.find(m => m.uid === uid || m.id === uid))
    .filter(Boolean);

  const toggleAssignee = (uid) => {
    const current = task.assignees || [];
    onUpdate(task.id, {
      assignees: current.includes(uid) ? current.filter(a => a !== uid) : [...current, uid],
    });
  };

  const toggleLabel = (labelId) => {
    const current = task.labelIds || [];
    onUpdate(task.id, {
      labelIds: current.includes(labelId) ? current.filter(id => id !== labelId) : [...current, labelId],
    });
  };

  const toggleSubtask = (idx) => {
    const subtasks = [...(task.subtasks || [])];
    subtasks[idx] = { ...subtasks[idx], done: !subtasks[idx].done };
    onUpdate(task.id, { subtasks });
  };

  const addSubtask = () => {
    if (!subtaskInput.trim()) return;
    const subtasks = [...(task.subtasks || []), { title: subtaskInput.trim(), done: false }];
    onUpdate(task.id, { subtasks });
    setSubtaskInput('');
    setShowSubtaskInput(false);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    await sendMessage(chatInput.trim(), currentUser);
    setChatInput('');
  };

  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.low;
  const type = TYPE_CONFIG[task.type] || TYPE_CONFIG.task;
  const subtotalDone = task.subtasks?.filter(s => s.done)?.length ?? 0;
  const subtotalAll = task.subtasks?.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-white border-l border-[#e9e9e9] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e9e9e9] shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full" style={{ color: type.color, background: type.color + '18' }}>{type.label}</span>
          <span className="text-[10px] font-semibold px-2 py-[2px] rounded-full" style={{ color: priority.color, background: priority.color + '18' }}>{priority.label}</span>
          <button onClick={() => setShowDeleteConfirm(true)} className="ml-auto text-[#cfcfcf] hover:text-red-500 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
        <h2 className="text-[15px] font-bold text-[#1f1f1f] leading-snug">{task.title}</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#e9e9e9] shrink-0">
        {[['details', 'Деталі'], ['chat', `Чат ${messages.length > 0 ? `(${messages.length})` : ''}`]].map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[12px] font-semibold transition-colors ${tab === t ? 'text-[#1f1f1f] border-b-2 border-[#1f1f1f]' : 'text-[#9a9a9a] hover:text-[#1f1f1f]'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'details' && (
          <div className="p-5 flex flex-col gap-5">
            {/* Status */}
            <Field label="Статус">
              <Select
                value={task.status}
                onChange={val => onUpdate(task.id, { status: val })}
                options={statuses.map(s => ({ value: s.id, label: s.label }))}
              />
            </Field>

            {/* Дедлайн */}
            <Field label={<span className={isOverdue ? 'text-red-500' : undefined}>Дедлайн</span>}>
              <input
                type="date"
                value={dueDate ? dueDate.toISOString().split('T')[0] : ''}
                onChange={e => onUpdate(task.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                className={`w-full px-3 py-2 bg-[#f7f7f7] rounded-[12px] text-[13px] border transition-colors ${isOverdue ? 'border-red-200 text-red-600' : 'border-[#e9e9e9] text-[#1f1f1f]'} focus:border-[#1f1f1f]`}
              />
            </Field>

            {/* Опис */}
            <Field label="Опис">
              <MarkdownEditor 
                value={task.description || ''}
                onChange={(val) => onUpdate(task.id, { description: val })}
                defaultTab={task.description ? 'preview' : 'write'}
                minHeight="100px"
              />
            </Field>

            {/* Виконавці */}
            <Field label="Виконавці">
              <div className="flex flex-wrap gap-2">
                {teamMembers.map(m => {
                  const uid = m.uid || m.id;
                  const active = (task.assignees || []).includes(uid);
                  return (
                    <button key={uid} onClick={() => toggleAssignee(uid)}
                      className={`flex items-center gap-[6px] px-3 py-[5px] rounded-full text-[12px] font-medium border transition-all ${active ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]' : 'bg-white text-[#1f1f1f] border-[#e9e9e9] hover:border-[#9a9a9a]'}`}>
                      <UserAvatar user={m} size={16} />
                      {m.name || m.email}
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Мітки */}
            <Field label="Мітки (Теги)">
              <div className="flex flex-wrap gap-2 items-center relative">
                {(task.labelIds || []).map(id => {
                  const l = availableLabels.find(lbl => lbl.id === id);
                  if (!l) return null;
                  return (
                    <span key={id} className="text-[11px] font-bold px-[8px] py-[3px] rounded-full flex items-center gap-1"
                      style={{ background: l.color + '18', color: l.color }}>
                      {l.label}
                      <button onClick={() => toggleLabel(id)} className="hover:opacity-70 ml-1"><X size={10} /></button>
                    </span>
                  );
                })}
                <button
                  onClick={() => setShowLabelDropdown(v => !v)}
                  className="flex items-center gap-1 px-[8px] py-[4px] rounded-full text-[11px] font-bold bg-[#f7f7f7] text-[#9a9a9a] border border-dashed border-[#cfcfcf] hover:border-[#9a9a9a] hover:text-[#1f1f1f] transition-all"
                >
                  <Plus size={10} /> Додати мітку
                </button>

                {showLabelDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowLabelDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 w-[200px] bg-white border border-[#e9e9e9] rounded-[12px] shadow-lg z-20 py-2">
                      {availableLabels.length === 0 && (
                        <p className="px-4 py-2 text-[12px] text-[#9a9a9a]">Немає доступних міток</p>
                      )}
                      {availableLabels.map(l => {
                        const active = (task.labelIds || []).includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => { toggleLabel(l.id); setShowLabelDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#f7f7f7] transition-colors flex items-center justify-between ${active ? 'bg-[#f5f7ff] font-bold' : ''}`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                              {l.label}
                            </span>
                            {active && <CheckSquare size={12} className="text-[#6366f1]" />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </Field>

            {/* Підзадачі */}
            <Field label={`Підзадачі ${subtotalAll > 0 ? `(${subtotalDone}/${subtotalAll})` : ''}`}>
              <div className="flex flex-col gap-2">
                {(task.subtasks || []).map((s, i) => (
                  <label key={i} className="flex items-center gap-3 cursor-pointer group">
                    <button onClick={() => toggleSubtask(i)} className="shrink-0 text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors">
                      {s.done ? <CheckSquare size={15} className="text-[#1f1f1f]" /> : <Square size={15} />}
                    </button>
                    <span className={`text-[13px] ${s.done ? 'line-through text-[#cfcfcf]' : 'text-[#1f1f1f]'}`}>{s.title}</span>
                  </label>
                ))}

                {showSubtaskInput ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={subtaskInput}
                      onChange={e => setSubtaskInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') setShowSubtaskInput(false); }}
                      placeholder="Назва підзадачі..."
                      className="flex-1 px-3 py-[7px] bg-[#f7f7f7] rounded-[12px] text-[12px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f]"
                    />
                    <button onClick={addSubtask} className="px-3 py-[7px] bg-[#1f1f1f] text-white rounded-[12px] text-[11px] font-bold">OK</button>
                  </div>
                ) : (
                  <button onClick={() => setShowSubtaskInput(true)} className="flex items-center gap-2 text-[12px] text-[#9a9a9a] hover:text-[#1f1f1f] transition-colors w-fit">
                    <Plus size={12} /> Додати підзадачу
                  </button>
                )}
              </div>
            </Field>
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="text-center py-10 text-[#cfcfcf] text-[12px]">Почніть обговорення задачі</div>
              )}
              {messages.map(msg => {
                const isMe = msg.senderId === currentUser?.uid;
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <UserAvatar user={{ name: msg.senderName, photoURL: msg.senderPhoto }} size={28} />
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      {!isMe && <p className="text-[10px] text-[#9a9a9a] font-medium">{msg.senderName}</p>}
                      <div className={`px-3 py-2 rounded-[12px] text-[13px] ${isMe ? 'bg-[#1f1f1f] text-white' : 'bg-[#f7f7f7] text-[#1f1f1f]'}`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-[#e9e9e9] flex gap-2 shrink-0">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Повідомлення..."
                className="flex-1 px-4 py-[10px] bg-[#f7f7f7] rounded-[12px] text-[13px] text-[#1f1f1f] border border-[#e9e9e9] focus:border-[#1f1f1f] transition-colors"
              />
              <button onClick={handleSendMessage} disabled={!chatInput.trim()}
                className="px-4 py-[10px] bg-[#1f1f1f] text-white rounded-[12px] disabled:opacity-30 hover:bg-[#303030] transition-all">
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[400px] p-[24px] flex flex-col gap-[24px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="text-[18px] font-bold text-[#1f1f1f]">Видалити задачу?</h3>
              <p className="text-[13px] text-[#9a9a9a]">Ця дія не може бути скасована.</p>
            </div>
            <div className="flex gap-[12px] justify-end">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="px-[24px] py-[12px] rounded-[12px] text-[14px] font-bold text-[#9a9a9a] bg-[#f7f7f7] hover:bg-[#f0f0f0] transition-colors">
                Скасувати
              </button>
              <button onClick={() => { onDelete(task.id); setShowDeleteConfirm(false); }}
                className="px-[24px] py-[12px] rounded-[12px] text-[14px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#9a9a9a] uppercase tracking-wide mb-2">{label}</label>
      {children}
    </div>
  );
}
