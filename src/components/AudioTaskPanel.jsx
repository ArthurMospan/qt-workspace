'use client';

import { useMemo, useState } from 'react';
import { Check, FileAudio, ListChecks, Sparkles, Upload, X } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { auth } from '@/lib/firebase';
import { uploadFileToCloudinary } from '@/lib/services/fileUpload';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import UserAvatar from '@/components/UserAvatar';
import { fromDateInput } from '@/lib/utils/date';

const PRIORITIES = [
  { value: 'blocker', label: 'Blocker' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function AudioTaskPanel({
  projects = [],
  projectContext = null,
  teamMembers = [],
  onSubmit,
  onFinished,
}) {
  const { activeOrgId } = useAppContext();
  const showToast = useWorkspaceStore(state => state.showToast);
  const availableProjects = useMemo(
    () => (projects?.length ? projects : projectContext ? [projectContext] : []).filter(Boolean),
    [projects, projectContext],
  );
  const [projectId, setProjectId] = useState(availableProjects[0]?.id || '');
  const effectiveProjectId = projectId || availableProjects[0]?.id || '';
  const project = availableProjects.find(item => item.id === effectiveProjectId);
  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null);

  const updateTask = (index, patch) => {
    setResult(previous => ({
      ...previous,
      tasks: previous.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task),
    }));
  };

  const findMemberId = name => {
    if (!name) return '';
    const normalized = name.toLowerCase();
    const member = teamMembers.find(item => (item.name || '').toLowerCase() === normalized)
      || teamMembers.find(item => (item.name || '').toLowerCase().includes(normalized));
    return member ? member.id || member.uid : '';
  };

  const analyze = async () => {
    if (!transcript.trim() && !audioFile) {
      showToast('Додайте аудіозапис або текст транскрипту', 'error');
      return;
    }
    if (!activeOrgId) return;
    setAnalyzing(true);
    setResult(null);
    try {
      let audioUrl = '';
      if (!transcript.trim() && audioFile) {
        const upload = await uploadFileToCloudinary(
          audioFile,
          `quickteam/organizations/${activeOrgId}/ai-calls`,
        );
        audioUrl = upload.downloadUrl;
      }
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/call-to-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizationId: activeOrgId,
          transcript: transcript.trim() || undefined,
          audioUrl: audioUrl || undefined,
          audioMimeType: audioFile?.type || undefined,
          memberNames: teamMembers.map(member => member.name).filter(Boolean),
          projectName: project?.name || '',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не вдалося проаналізувати аудіо');
      setResult({
        summary: data.summary || '',
        decisions: data.decisions || [],
        tasks: (data.tasks || []).map(task => ({
          ...task,
          include: true,
          assigneeId: findMemberId(task.assigneeName),
        })),
      });
    } catch (error) {
      showToast(error.message || 'Помилка аналізу аудіо', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const createTasks = async () => {
    const selected = result?.tasks.filter(task => task.include && task.title.trim()) || [];
    if (!selected.length || !effectiveProjectId) {
      showToast('Оберіть проєкт і хоча б одне завдання', 'error');
      return;
    }
    setCreating(true);
    let created = 0;
    try {
      for (const task of selected) {
        await onSubmit({
          projectId: effectiveProjectId,
          title: task.title.trim(),
          description: task.description || '',
          priority: task.priority || 'medium',
          type: 'task',
          status: 'todo',
          assignees: task.assigneeId ? [task.assigneeId] : [],
          dueDate: task.dueDate ? fromDateInput(task.dueDate, { endOfDay: true }) : null,
          labelIds: [],
        });
        created += 1;
      }
      showToast(`Створено завдань: ${created}`, 'success');
      onFinished?.();
    } catch (error) {
      showToast(`Створено ${created}, далі помилка: ${error.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {availableProjects.length > 1 && (
        <div>
          <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">Проєкт</label>
          <Select
            value={effectiveProjectId}
            onChange={setProjectId}
            options={availableProjects.map(item => ({ value: item.id, label: item.name }))}
          />
        </div>
      )}

      <div>
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">Аудіозапис</label>
        {audioFile ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-canvas px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-muted"><FileAudio size={16} /></span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{audioFile.name}</span>
            <button type="button" onClick={() => setAudioFile(null)} className="rounded-full p-2 text-muted hover:bg-white hover:text-ink" aria-label="Прибрати файл"><X size={14} /></button>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#d7d7d7] bg-canvas px-5 py-8 text-center transition-colors hover:border-muted">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink"><Upload size={18} /></span>
            <span className="text-[13px] font-bold text-ink">Оберіть аудіофайл</span>
            <span className="text-[11px] text-muted">MP3, M4A, WAV, WEBM або OGG · до 14 МБ</span>
            <input
              type="file"
              accept=".mp3,.m4a,.wav,.webm,.ogg,.oga,audio/*,video/webm"
              className="hidden"
              onChange={event => {
                const file = event.target.files?.[0];
                if (file?.size > 14 * 1024 * 1024) showToast('Файл завеликий — ліміт 14 МБ', 'error');
                else if (file) setAudioFile(file);
                event.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      <div>
        <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted">Або транскрипт</label>
        <textarea
          value={transcript}
          onChange={event => setTranscript(event.target.value)}
          rows={5}
          placeholder="Вставте текст розмови…"
          className="w-full resize-y rounded-[14px] border border-transparent bg-canvas px-4 py-3 text-[13px] leading-5 text-ink outline-none transition-colors focus:border-ink"
        />
      </div>

      <Button style="primary" size="lg" icon={Sparkles} onClick={analyze} loading={analyzing} disabled={analyzing}>
        {analyzing ? 'Аналізуємо…' : 'Проаналізувати'}
      </Button>

      {result && (
        <div className="flex flex-col gap-4 border-t border-line pt-5">
          {result.summary && (
            <div className="rounded-[14px] bg-canvas p-4">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Підсумок</p>
              <p className="whitespace-pre-wrap text-[13px] leading-5 text-ink">{result.summary}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-ink"><ListChecks size={16} /> Запропоновані завдання</h3>
            <Button style="primary" size="md" onClick={createTasks} loading={creating} disabled={creating || !result.tasks.some(task => task.include)}>
              Створити вибрані
            </Button>
          </div>
          {result.tasks.map((task, index) => {
            const assignee = teamMembers.find(member => (member.id || member.uid) === task.assigneeId);
            return (
              <div key={index} className={`rounded-[14px] bg-canvas p-4 transition-opacity ${task.include ? '' : 'opacity-45'}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => updateTask(index, { include: !task.include })}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${task.include ? 'border-ink bg-ink text-white' : 'border-[#cfcfcf] bg-white'}`}
                  >
                    {task.include && <Check size={12} />}
                  </button>
                  <div className="min-w-0 flex-1 space-y-3">
                    <input
                      value={task.title}
                      onChange={event => updateTask(index, { title: event.target.value })}
                      className="w-full bg-transparent text-[13px] font-bold text-ink outline-none"
                    />
                    <textarea
                      value={task.description || ''}
                      onChange={event => updateTask(index, { description: event.target.value })}
                      rows={2}
                      className="w-full resize-none bg-transparent text-[12px] leading-5 text-muted outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Select value={task.priority || 'medium'} onChange={value => updateTask(index, { priority: value })} options={PRIORITIES} compact />
                      <Select
                        value={task.assigneeId || ''}
                        onChange={value => updateTask(index, { assigneeId: value })}
                        options={[
                          { value: '', label: 'Без виконавця' },
                          ...teamMembers.map(member => ({ value: member.id || member.uid, label: member.name || member.email })),
                        ]}
                        compact
                      />
                      {assignee && <UserAvatar user={assignee} size={24} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
