'use client';

// «Дзвінок → задачі»: завантаж запис дзвінка або встав транскрипт — ШІ
// зробить саммарі, витягне рішення і чернетки задач; підтверджені задачі
// створюються через звичайний /api/issues.
import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sparkles, Upload, FileAudio, ListChecks, X } from 'lucide-react';
import { useAppContext } from '@/lib/context/AppContext';
import { useOrganization } from '@/lib/hooks/useOrganization';
import useWorkspaceStore from '@/store/useWorkspaceStore';
import { auth } from '@/lib/firebase';
import { uploadFileToCloudinary } from '@/lib/services/fileUpload';
import { createIssueViaApi } from '@/lib/services/issues';
import { Button, Card, FormGroup, IconAction, LoadingSpinner, PageHeader, Textarea } from '@/components/ui';
import { Select } from '@/components/ui/Select';
import UserAvatar from '@/components/ui/DataDisplay/UserAvatar';

const PRIORITY_OPTIONS = [
  { value: 'blocker', label: 'Критичний' },
  { value: 'high', label: 'Високий' },
  { value: 'medium', label: 'Середній' },
  { value: 'low', label: 'Низький' },
];

export default function AiCallPage() {
  const router = useRouter();
  const { activeOrgId, projects = [] } = useAppContext();
  const { members } = useOrganization();
  const showToast = useWorkspaceStore(s => s.showToast);

  const searchParams = useSearchParams();
  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'archived'),
    [projects],
  );
  const [projectId, setProjectId] = useState('');
  // ?project= передає модалка створення задачі — звідти сюди і потрапляють
  const requestedProjectId = searchParams.get('project') || '';
  const effectiveProjectId = projectId
    || (activeProjects.some(p => p.id === requestedProjectId) ? requestedProjectId : '')
    || activeProjects[0]?.id || '';
  const project = activeProjects.find(p => p.id === effectiveProjectId);

  const [transcript, setTranscript] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState(null); // { summary, decisions, tasks:[...+include] }

  const memberOptions = useMemo(() => [
    { value: '', label: 'Без виконавця' },
    ...members.map(m => ({ value: m.id || m.uid, label: m.name || m.email, user: m })),
  ], [members]);

  const findMemberIdByName = name => {
    if (!name) return '';
    const lower = String(name).toLowerCase();
    const found = members.find(m => (m.name || '').toLowerCase() === lower)
      || members.find(m => (m.name || '').toLowerCase().includes(lower));
    return found ? (found.id || found.uid) : '';
  };

  const analyze = async () => {
    if (!activeOrgId) return;
    if (!transcript.trim() && !audioFile) {
      showToast('Додайте запис дзвінка або вставте транскрипт', 'error');
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      let audioUrl = null;
      if (!transcript.trim() && audioFile) {
        showToast('Завантажуємо аудіо…');
        const uploaded = await uploadFileToCloudinary(
          audioFile,
          `quickteam/organizations/${activeOrgId}/ai-calls`,
        );
        audioUrl = uploaded.downloadUrl;
      }

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/ai/call-to-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          organizationId: activeOrgId,
          transcript: transcript.trim() || undefined,
          audioUrl,
          audioMimeType: audioFile?.type || undefined,
          memberNames: members.map(m => m.name).filter(Boolean),
          projectName: project?.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не вдалося проаналізувати дзвінок');

      setResult({
        summary: data.summary,
        decisions: data.decisions,
        tasks: data.tasks.map(task => ({
          ...task,
          include: true,
          assigneeId: findMemberIdByName(task.assigneeName),
        })),
      });
    } catch (error) {
      showToast(error.message || 'Помилка аналізу', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateTask = (index, patch) => {
    setResult(previous => ({
      ...previous,
      tasks: previous.tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)),
    }));
  };

  const createTasks = async () => {
    const selected = result?.tasks.filter(task => task.include && task.title.trim()) || [];
    if (!selected.length || !effectiveProjectId) {
      showToast('Оберіть проєкт і хоча б одну задачу', 'error');
      return;
    }
    setCreating(true);
    let created = 0;
    try {
      for (const task of selected) {
        await createIssueViaApi({
          organizationId: activeOrgId,
          projectId: effectiveProjectId,
          data: {
            title: task.title.trim(),
            description: task.description || '',
            priority: task.priority || 'medium',
            assigneeIds: task.assigneeId ? [task.assigneeId] : [],
            ...(task.dueDate ? { dueDate: task.dueDate } : {}),
          },
        });
        created += 1;
      }
      showToast(`Створено задач: ${created} ✓`, 'success');
      router.push(`/${effectiveProjectId}`);
    } catch (error) {
      showToast(`Створено ${created}, далі помилка: ${error.message}`, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-canvas">
      <div className="w-full page-gutter pt-[56px] pb-[120px] flex flex-col gap-4 max-w-[960px]">
        <PageHeader variant="main" title="Дзвінок → задачі" />
        <p className="text-[13px] text-muted -mt-2">
          Завантажте запис дзвінка або вставте транскрипт — ШІ підведе підсумок і запропонує задачі.
        </p>

        {/* Input card */}
        <Card preset="bordered" padding="lg">
          <div className="flex flex-col gap-4">
            <Select
              value={effectiveProjectId}
              onChange={setProjectId}
              options={activeProjects.map(p => ({ value: p.id, label: p.name }))}
              label="Проєкт для задач"
            />

            <FormGroup label="Запис дзвінка (аудіо)">
              {audioFile ? (
                <div data-ui-surface="compact-bordered-panel" data-ui-padding="row" className="ui-surface flex items-center gap-3">
                  <FileAudio size={16} className="text-muted shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{audioFile.name}</span>
                  <IconAction label="Прибрати файл" icon={X} size="xs" appearance="quiet" shape="micro" onClick={() => setAudioFile(null)} />
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#cfcfcf] bg-canvas px-4 py-6 text-[13px] font-medium text-muted transition-colors hover:border-muted hover:text-ink">
                  <Upload size={15} />
                  Обрати аудіофайл (mp3, m4a, webm, wav — до 14 МБ)
                  <input
                    type="file"
                    accept="audio/*,video/webm,video/mp4"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file && file.size > 14 * 1024 * 1024) {
                        showToast('Файл завеликий — ліміт 14 МБ', 'error');
                      } else if (file) {
                        setAudioFile(file);
                      }
                      event.target.value = '';
                    }}
                  />
                </label>
              )}
            </FormGroup>

            <FormGroup label="Або текст транскрипту">
              <Textarea
                value={transcript}
                onChange={event => setTranscript(event.target.value)}
                rows={6}
                placeholder="Вставте транскрипт дзвінка (наприклад, з Google Meet / Zoom / tl;dv)…"
                composition="transcript"
              />
              {transcript.trim() && audioFile && (
                <p className="mt-1 text-[11px] text-muted">Є і текст, і аудіо — використаємо текст (без транскрипції).</p>
              )}
            </FormGroup>

            <Button onClick={analyze} loading={analyzing} disabled={analyzing} style="primary" size="md" icon={Sparkles}>
              {analyzing ? 'Аналізуємо…' : 'Проаналізувати дзвінок'}
            </Button>
          </div>
        </Card>

        {analyzing && (
          <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>
        )}

        {result && (
          <>
            <Card preset="bordered" padding="lg">
              <h2 className="ui-type-card-title-strong mb-2 text-ink">Саммарі дзвінка</h2>
              <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink">{result.summary}</p>
              {result.decisions.length > 0 && (
                <>
                  <h3 className="ui-type-column-title mb-1.5 mt-4 uppercase tracking-wider text-muted">Рішення</h3>
                  <ul className="flex flex-col gap-1">
                    {result.decisions.map((decision, index) => (
                      <li key={index} className="flex items-start gap-2 text-[13px] leading-5 text-ink">
                        <span className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink" />
                        {decision}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card preset="bordered" padding="lg">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="ui-type-card-title-strong flex items-center gap-2 text-ink">
                  <ListChecks size={16} />
                  Запропоновані задачі ({result.tasks.filter(t => t.include).length}/{result.tasks.length})
                </h2>
                <Button
                  onClick={createTasks}
                  loading={creating}
                  disabled={creating || !result.tasks.some(t => t.include)}
                  style="primary" size="md"
                >
                  Створити задачі
                </Button>
              </div>
              {result.tasks.length === 0 && (
                <p className="py-4 text-[13px] text-muted">ШІ не знайшов задач у цьому дзвінку.</p>
              )}
              <div className="flex flex-col gap-3">
                {result.tasks.map((task, index) => {
                  const assignee = members.find(m => (m.id || m.uid) === task.assigneeId);
                  return (
                    <div key={index} className={`rounded-[12px] border p-4 transition-opacity ${task.include ? 'border-line bg-canvas' : 'border-transparent bg-canvas opacity-45'}`}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={task.include}
                          onChange={event => updateTask(index, { include: event.target.checked })}
                          className="mt-[6px] h-4 w-4 shrink-0 accent-[#1f1f1f]"
                          aria-label="Створювати цю задачу"
                        />
                        <div className="min-w-0 flex-1 flex flex-col gap-2">
                          <input
                            value={task.title}
                            onChange={event => updateTask(index, { title: event.target.value })}
                            className="w-full rounded-[8px] border border-transparent bg-white px-3 py-2 text-[13px] font-semibold text-ink outline-none focus:border-ink"
                          />
                          <textarea
                            value={task.description}
                            onChange={event => updateTask(index, { description: event.target.value })}
                            rows={2}
                            className="w-full resize-y rounded-[8px] border border-transparent bg-white px-3 py-2 text-[12px] leading-5 text-ink outline-none focus:border-ink"
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {assignee && <UserAvatar user={assignee} size="sm" />}
                            <div className="w-[180px]">
                              <Select
                                value={task.assigneeId}
                                onChange={value => updateTask(index, { assigneeId: value })}
                                options={memberOptions}
                              />
                            </div>
                            <div className="w-[120px]">
                              <Select
                                value={task.priority}
                                onChange={value => updateTask(index, { priority: value })}
                                options={PRIORITY_OPTIONS}
                              />
                            </div>
                            <input
                              type="date"
                              value={task.dueDate || ''}
                              onChange={event => updateTask(index, { dueDate: event.target.value || null })}
                              className="rounded-[8px] border border-line bg-white px-2 py-[7px] text-[12px] text-ink outline-none focus:border-ink"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
