'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Search, Upload } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { Alert, Button, Input, Select, useConfirm } from '@/components/ui';
import { MultiSelect } from '@/components/ui/Select';
import IntegrationCard, { IntegrationSteps } from '@/components/integrations/IntegrationCard';
import { sourceUserId, suggestUserMappings } from '@/lib/utils/youtrackImport.mjs';

const ACTIVE_JOB_STATUSES = new Set(['prepared', 'running']);

function memberId(member) {
  return member?.id || member?.uid || member?.userId || '';
}

function statusLabel(status) {
  return {
    prepared: 'Перевірено',
    running: 'Імпортується',
    completed: 'Завершено',
    cancelled: 'Скасовано',
  }[status] || status || 'Не розпочато';
}

function progressFor(job) {
  if (!job?.totalIssues) return job?.status === 'completed' ? 100 : 0;
  return Math.min(100, Math.round(((job.processedIssues + job.failedIssues) / job.totalIssues) * 100));
}

export default function YouTrackImportCard({
  organizationId,
  members = [],
  projects = [],
  showToast,
  presentation = 'integration',
}) {
  const [connection, setConnection] = useState({ connected: false });
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [discovery, setDiscovery] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectMappings, setProjectMappings] = useState({});
  const [statusFilters, setStatusFilters] = useState({});
  const [userMappings, setUserMappings] = useState({});
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [setupOpen, setSetupOpen] = useState(false);
  const keepRunning = useRef(false);
  const confirmDialog = useConfirm();

  const request = useCallback(async (path, options = {}) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Увійдіть у QuickTeam ще раз');
    const idToken = await currentUser.getIdToken();
    const response = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      cache: 'no-store',
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Помилка сервера (${response.status})`);
    return result;
  }, []);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const encodedOrg = encodeURIComponent(organizationId);
      const [nextConnection, imports] = await Promise.all([
        request(`/api/integrations/youtrack?organizationId=${encodedOrg}`),
        request(`/api/integrations/youtrack/import?organizationId=${encodedOrg}`),
      ]);
      setConnection(nextConnection);
      setBaseUrl(nextConnection.baseUrl || '');
      setJob((imports.jobs || []).find(item => ACTIVE_JOB_STATUSES.has(item.status)) || imports.jobs?.[0] || null);
      if (nextConnection.connected) setSetupOpen(false);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [organizationId, request, showToast]);

  useEffect(() => {
    keepRunning.current = false;
    const timer = window.setTimeout(refresh, 0);
    return () => {
      window.clearTimeout(timer);
      keepRunning.current = false;
    };
  }, [refresh]);

  const activeProjects = useMemo(
    () => projects.filter(project => project.status !== 'archived'),
    [projects],
  );
  const memberOptions = useMemo(() => [
    { value: 'external', label: 'Залишити зовнішнім користувачем' },
    ...members.flatMap(member => {
      const id = memberId(member);
      if (!id) return [];
      return [{
        value: id,
        label: member.name || member.displayName || member.email || id,
        user: member,
      }];
    }),
  ], [members]);

  const connect = async () => {
    if (!baseUrl.trim() || !token.trim()) {
      showToast('Вкажіть адресу та постійний токен YouTrack', 'error');
      return;
    }
    setAction('connect');
    try {
      const next = await request('/api/integrations/youtrack', {
        method: 'POST',
        body: JSON.stringify({ organizationId, baseUrl, token }),
      });
      setConnection(next);
      setBaseUrl(next.baseUrl || baseUrl);
      setToken('');
      setSetupOpen(false);
      showToast('YouTrack підключено');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setAction('');
    }
  };

  const disconnect = async () => {
    if (ACTIVE_JOB_STATUSES.has(job?.status)) {
      showToast('Спочатку зупиніть активний імпорт', 'error');
      return false;
    }
    if (!(await confirmDialog({
      title: 'Відключити YouTrack?',
      message: 'Збережений токен буде видалено. Уже перенесені проєкти та задачі залишаться у QuickTeam.',
      confirmText: 'Відключити',
      danger: true,
    }))) return false;

    keepRunning.current = false;
    setAction('disconnect');
    try {
      await request(`/api/integrations/youtrack?organizationId=${encodeURIComponent(organizationId)}`, {
        method: 'DELETE',
      });
      setConnection({ connected: false });
      setDiscovery(null);
      setSelectedProjectIds([]);
      setProjectMappings({});
      setStatusFilters({});
      setUserMappings({});
      setJob(null);
      setSetupOpen(false);
      showToast('YouTrack відключено');
      return true;
    } catch (error) {
      showToast(error.message, 'error');
      return false;
    } finally {
      setAction('');
    }
  };

  const toggleConnection = async enabled => {
    if (enabled) {
      setSetupOpen(true);
      return;
    }
    if (connection.connected) {
      await disconnect();
      return;
    }
    setSetupOpen(false);
    setToken('');
  };

  const discover = async () => {
    setAction('discover');
    try {
      const result = await request('/api/integrations/youtrack/discover', {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      });
      const projectIds = result.projects.map(project => project.id);
      setDiscovery(result);
      setSelectedProjectIds(projectIds);
      setProjectMappings(Object.fromEntries(projectIds.map(id => [id, 'create'])));
      setStatusFilters(Object.fromEntries(result.projects.map(project => [
        project.id,
        (project.statuses || []).map(status => status.name),
      ])));
      setUserMappings(suggestUserMappings(result.users, members));
      showToast(`Знайдено ${result.projects.length} проєктів YouTrack`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setAction('');
    }
  };

  const toggleProject = projectId => {
    setSelectedProjectIds(current => (
      current.includes(projectId)
        ? current.filter(id => id !== projectId)
        : [...current, projectId]
    ));
  };

  const prepare = async () => {
    if (!selectedProjectIds.length) {
      showToast('Оберіть хоча б один проєкт YouTrack', 'error');
      return;
    }
    const projectWithoutStatuses = discovery?.projects?.find(project => (
      selectedProjectIds.includes(project.id)
      && (project.statuses || []).length > 0
      && (statusFilters[project.id] || []).length === 0
    ));
    if (projectWithoutStatuses) {
      showToast(`Оберіть хоча б один статус для проєкту ${projectWithoutStatuses.name}`, 'error');
      return;
    }
    setAction('prepare');
    try {
      const result = await request('/api/integrations/youtrack/import', {
        method: 'POST',
        body: JSON.stringify({
          action: 'prepare',
          organizationId,
          selectedProjectIds,
          projectMappings,
          userMappings,
          statusFilters,
        }),
      });
      setJob(result.job);
      showToast(`Перевірено: до імпорту готово ${result.job.totalIssues} задач`);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setAction('');
    }
  };

  const run = async () => {
    if (!job?.id || !ACTIVE_JOB_STATUSES.has(job.status)) return;
    keepRunning.current = true;
    setAction('run');
    try {
      let current = job;
      while (keepRunning.current && ACTIVE_JOB_STATUSES.has(current.status)) {
        const result = await request('/api/integrations/youtrack/import', {
          method: 'POST',
          body: JSON.stringify({
            action: 'run',
            organizationId,
            jobId: current.id,
          }),
        });
        current = result.job;
        setJob(current);
        if (current.stepInProgress) {
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      }
      if (current.status === 'completed') {
        showToast(`Імпорт завершено: ${current.processedIssues} задач`);
      }
    } catch (error) {
      showToast(`${error.message}. Імпорт можна продовжити тією ж кнопкою.`, 'error');
    } finally {
      keepRunning.current = false;
      setAction('');
    }
  };

  const cancel = async () => {
    if (!job?.id) return;
    keepRunning.current = false;
    setAction('cancel');
    try {
      const result = await request('/api/integrations/youtrack/import', {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel', organizationId, jobId: job.id }),
      });
      setJob(result.job);
      showToast('Імпорт зупинено');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setAction('');
    }
  };

  const visibleUsers = discovery?.users?.filter(user => !user.banned).slice(0, 250) || [];
  const progress = progressFor(job);
  const activeJob = ACTIVE_JOB_STATUSES.has(job?.status);
  const cardEnabled = connection.connected || setupOpen;
  const migrationPresentation = presentation === 'migration';
  const cardStatus = loading
    ? 'pending'
    : connection.connected
      ? 'connected'
      : setupOpen
        ? 'pending'
        : 'off';

  useEffect(() => {
    if (action !== 'run') return undefined;
    const warnBeforeClose = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [action]);

  return (
    <IntegrationCard
      title="YouTrack"
      description="Перенесіть проєкти, задачі, коментарі, вкладення, облік часу, зв’язки та користувачів без дублів."
      logoSrc="/integrations/youtrack.svg"
      logoAlt="YouTrack"
      enabled={cardEnabled}
      onToggle={toggleConnection}
      toggleDisabled={loading || Boolean(action) || activeJob}
      actionLabel={migrationPresentation
        ? connection.connected
          ? 'Відключити'
          : setupOpen
            ? 'Закрити'
            : 'Налаштувати'
        : undefined}
      onAction={() => toggleConnection(!cardEnabled)}
      actionIcon={!connection.connected && !setupOpen ? Upload : undefined}
      actionStyle={connection.connected || setupOpen ? 'ghost' : 'secondary'}
      actionAriaLabel={connection.connected ? 'Відключити джерело YouTrack' : 'Налаштувати імпорт із YouTrack'}
      status={cardStatus}
      statusLabel={loading
        ? 'Перевіряємо'
        : connection.connected
          ? migrationPresentation ? 'Готово до імпорту' : 'Підключено'
          : setupOpen
            ? 'Налаштування'
            : migrationPresentation ? 'Не налаштовано' : 'Вимкнено'}
      statusMeta={connection.connected ? (
        <span className="min-w-0 truncate text-[12px] text-muted">
          {connection.account?.name || connection.account?.login || 'YouTrack'} · {connection.baseUrl}
        </span>
      ) : null}
    >
      {!connection.connected ? (
        setupOpen ? (
          <div className="space-y-3">
            <IntegrationSteps
              steps={[
                {
                  title: 'Створіть постійний токен у YouTrack',
                  description: 'Відкрийте Profile → Account Security → New token і виберіть scope «YouTrack». Токен матиме ті самі права доступу, що й ваш акаунт.',
                  content: (
                    <a
                      href="https://www.jetbrains.com/help/youtrack/devportal/Manage-Permanent-Token.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink hover:underline"
                    >
                      Відкрити офіційну інструкцію JetBrains <ExternalLink size={10} />
                    </a>
                  ),
                },
                {
                  title: 'Вкажіть адресу та токен',
                  description: 'Використовуйте адресу вашого YouTrack без шляху до конкретного проєкту або задачі.',
                  content: (
                    <div className="mt-2 grid max-w-[760px] gap-2 md:grid-cols-2">
                      <Input
                        type="url"
                        value={baseUrl}
                        onChange={event => setBaseUrl(event.target.value)}
                        placeholder="https://company.youtrack.cloud"
                        aria-label="Адреса YouTrack"
                        disabled={loading}
                      />
                      <Input
                        type="password"
                        value={token}
                        onChange={event => setToken(event.target.value)}
                        placeholder="Постійний токен YouTrack"
                        aria-label="Постійний токен YouTrack"
                        autoComplete="new-password"
                        disabled={loading}
                      />
                    </div>
                  ),
                },
                {
                  title: 'Перевірте доступ',
                  description: 'QuickTeam перевірить токен і збереже його для цієї організації. Після цього можна вибрати проєкти та зіставити людей.',
                  content: (
                    <Button
                      style="secondary"
                      size="sm"
                      icon={Search}
                      className="mt-2"
                      onClick={connect}
                      loading={action === 'connect'}
                      disabled={!baseUrl.trim() || !token.trim()}
                    >
                      Перевірити й підключити
                    </Button>
                  ),
                },
              ]}
            />
            <p className="rounded-[8px] border border-line bg-canvas px-3 py-2 text-[11px] leading-relaxed text-muted">
              Підключення виконується один раз для організації. Токен зберігається у зашифрованому вигляді й після збереження не повертається у браузер.
            </p>
          </div>
        ) : null
      ) : (
        <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Button style="secondary" size="sm" icon={Search} onClick={discover} loading={action === 'discover'}>
                  Знайти проєкти
                </Button>
                <Button style="ghost" size="sm" icon={RefreshCw} onClick={refresh} loading={loading}>
                  Оновити
                </Button>
                <p className="text-[11px] text-muted">Вимкнути інтеграцію можна світчером угорі.</p>
              </div>

              {discovery && (
                <div data-ui-surface="compact-bordered-panel" data-ui-padding="sm" className="ui-surface space-y-4">
                  <div>
                    <p className="text-[12px] font-semibold text-ink">1. Проєкти та місце імпорту</p>
                    <p className="mt-1 text-[11px] text-muted">Повторний запуск оновлює вже імпортовані записи без дублів.</p>
                  </div>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {discovery.projects.map(project => {
                      const checked = selectedProjectIds.includes(project.id);
                      return (
                        <div key={project.id} data-ui-surface="local" className="rounded-[10px] bg-white p-2">
                          <div className="grid items-center gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                            <label className="flex min-w-0 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleProject(project.id)}
                                className="h-4 w-4 accent-ink"
                              />
                              <span className="min-w-0 truncate text-[12px] font-semibold text-ink">
                                {project.name} <span className="font-normal text-muted">({project.shortName})</span>
                              </span>
                            </label>
                            <Select
                              value={projectMappings[project.id] || 'create'}
                              onChange={value => setProjectMappings(current => ({ ...current, [project.id]: value }))}
                              disabled={!checked}
                              options={[
                                { value: 'create', label: 'Створити новий проєкт' },
                                ...activeProjects.map(target => ({ value: target.id, label: `Додати в: ${target.name}` })),
                              ]}
                            />
                          </div>
                          {(project.statuses || []).length > 0 && (
                            <div className="mt-2 grid items-center gap-2 border-t border-line pt-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                              <div>
                                <p className="text-[11px] font-semibold text-ink">Статуси задач</p>
                                <p className="text-[10px] text-muted">Імпортуються лише обрані</p>
                              </div>
                              <MultiSelect
                                value={statusFilters[project.id] || []}
                                onChange={value => setStatusFilters(current => ({ ...current, [project.id]: value }))}
                                disabled={!checked}
                                options={project.statuses.map(status => ({
                                  value: status.name,
                                  label: status.archived ? `${status.name} · архівний` : status.name,
                                }))}
                                selectAllLabel="Усі статуси"
                                placeholder="Оберіть статуси"
                                size="md"
                                className="w-full"
                                dropdownClassName="w-[280px]"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-line pt-3">
                    <p className="text-[12px] font-semibold text-ink">2. Зіставлення користувачів</p>
                    <p className="mt-1 text-[11px] text-muted">
                      Точний збіг email уже підставлено. Решта збережуться як зовнішні автори, доки ви не оберете учасника.
                    </p>
                  </div>
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {visibleUsers.map(user => {
                      const id = sourceUserId(user);
                      return (
                        <div key={id} data-ui-surface="local" className="grid items-center gap-2 rounded-[10px] bg-white p-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-ink">{user.name}</p>
                            <p className="truncate text-[11px] text-muted">{user.email || user.login || id}</p>
                          </div>
                          <Select
                            value={userMappings[id] || 'external'}
                            onChange={value => setUserMappings(current => ({ ...current, [id]: value }))}
                            options={memberOptions}
                          />
                        </div>
                      );
                    })}
                    {(discovery.users?.length || 0) > visibleUsers.length && (
                      <p className="px-2 text-[11px] text-muted">
                        Показано перші {visibleUsers.length} активних користувачів; інші імпортуються як зовнішні.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    <Button
                      style="secondary"
                      size="md"
                      icon={Search}
                      onClick={prepare}
                      loading={action === 'prepare'}
                      disabled={action === 'run'}
                    >
                      Перевірити імпорт
                    </Button>
                    <p className="text-[11px] text-muted">Цей крок лише рахує задачі й нічого не змінює.</p>
                  </div>
                </div>
              )}

              {job && (
                <div data-ui-surface="compact-bordered-card" data-ui-padding="sm" className="ui-surface">
                  {ACTIVE_JOB_STATUSES.has(job.status) && (
                    <Alert
                      variant="warning"
                      title="Не закривайте цю сторінку під час імпорту"
                      description="Імпорт виконується послідовними кроками з браузера. Якщо закрити або оновити сторінку, процес призупиниться; його можна буде продовжити без дублів."
                      className="mb-3"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-semibold text-ink">
                        {statusLabel(job.status)} · {job.processedIssues + job.failedIssues} / {job.totalIssues} задач
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Успішно: {job.processedIssues} · Помилок: {job.failedIssues} · Зв’язків: {job.processedLinks}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold text-ink">{progress}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                  {job.lastError && <p className="mt-2 break-words text-[11px] text-red-500">{job.lastError}</p>}
                  {job.warnings?.length > 0 && (
                    <p className="mt-2 text-[11px] text-amber-600">Попереджень: {job.warnings.length}. Дані без помилок продовжують імпортуватися.</p>
                  )}
                  {ACTIVE_JOB_STATUSES.has(job.status) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="md" icon={Upload} onClick={run} loading={action === 'run'}>
                        {job.status === 'running' ? 'Продовжити імпорт' : 'Почати імпорт'}
                      </Button>
                      <Button style="ghost" color="red" size="md" onClick={cancel} loading={action === 'cancel'}>
                        Зупинити
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
    </IntegrationCard>
  );
}
