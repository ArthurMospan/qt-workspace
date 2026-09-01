'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Upload } from 'lucide-react';
import { Alert, Button, Card, Checkbox, Dialog, Input, Label, Meter, Pill, Select, SettingRow, TextAction, useConfirm } from '@/components/ui';
import { IntegrationConnect, IntegrationWork } from '@/components/integrations/IntegrationScreen';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import {
  sourceUserId,
  suggestUserMappings,
  suggestYouTrackStatusMappings,
} from '@/lib/utils/youtrackImport.mjs';
import { statusCategoryLabel } from '@/lib/utils/statusCategories.mjs';
import { plural } from '@/lib/utils/plural.mjs';
import { errorTextUk } from '@/lib/utils/errors';

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

// Стан імпорту носить бейдж, а не зелений напис: у продукту одна темна гама, і
// «йде» чи «завершено» — це те, що сталося, а не привід світитися.
const JOB_TONES = {
  prepared: 'neutral',
  running: 'dark',
  completed: 'dark',
  cancelled: 'neutral',
};

function progressFor(job) {
  if (!job?.totalIssues) return job?.status === 'completed' ? 100 : 0;
  return Math.min(100, Math.round(((job.processedIssues + job.failedIssues) / job.totalIssues) * 100));
}

// Підсумок називає лише те, що справді сталося. «Успішно: 0 · Помилок: 0 ·
// Зв'язків: 0» — три нулі, які нічого не повідомляють; кількість перенесених
// задач лишається завжди, бо це і є відповідь на питання «скільки вже».
function jobSummaryParts(job) {
  if (!job) return [];
  const parts = [`Успішно: ${job.processedIssues || 0}`];
  if (job.failedIssues > 0) parts.push(`Помилок: ${job.failedIssues}`);
  if (job.processedLinks > 0) parts.push(`Зв’язків: ${job.processedLinks}`);
  return parts;
}

export default function YouTrackImportCard({
  organizationId,
  currentUserId = '',
  isOrganizationOwner = false,
  members = [],
  projects = [],
  showToast,
  onStatus,
}) {
  const [connection, setConnection] = useState({ connected: false });
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [discovery, setDiscovery] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [projectMappings, setProjectMappings] = useState({});
  const [statusFilters, setStatusFilters] = useState({});
  const [statusMappings, setStatusMappings] = useState({});
  const [userMappings, setUserMappings] = useState({});
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  // Два екрани, які в рядок не складаються: обсяг імпорту й зіставлення людей.
  const [scopeOpen, setScopeOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  // Відмова цього екрана — не подія, а стан: «знайти проєкти не вийшло, ось
  // чому». Тост про таке спливав над нижнім краєм, за 800 пікселів від кнопки,
  // яку натиснули, тримався дев'ять секунд і йшов — а причина лишалася чинною
  // і після того, як напис зник. Тепер вона стоїть у картці, під тією самою
  // кнопкою, доки її не усунуть. Тост лишається там, де він і має бути: на
  // тому, що сталося і минуло («YouTrack підключено»).
  const [failure, setFailure] = useState('');
  const keepRunning = useRef(false);
  const confirmDialog = useConfirm();

  const request = useCallback(async (path, options = {}) => {
    return authenticatedRequest(path, {
      ...options,
      cache: 'no-store',
    }, 'Не вдалося виконати запит до інтеграції YouTrack');
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
      setFailure('');
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося прочитати стан інтеграції YouTrack. Спробуйте ще раз.'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, request]);

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

  const targetStatusesFor = useCallback((sourceProjectId, targetOverride) => {
    const targetProjectId = targetOverride ?? projectMappings[sourceProjectId] ?? 'create';
    const hiddenStatusIds = new Set(
      targetProjectId === 'create'
        ? []
        : activeProjects.find(project => project.id === targetProjectId)?.hiddenColumns || [],
    );
    return (discovery?.targetStatuses || []).filter(status => !hiddenStatusIds.has(status.id));
  }, [activeProjects, discovery, projectMappings]);

  const updateProjectMapping = (sourceProject, targetProjectId) => {
    const availableStatuses = targetStatusesFor(sourceProject.id, targetProjectId);
    const availableIds = new Set(availableStatuses.map(status => status.id));
    const suggestions = suggestYouTrackStatusMappings([sourceProject], availableStatuses)[sourceProject.id] || {};
    setProjectMappings(current => ({ ...current, [sourceProject.id]: targetProjectId }));
    setStatusMappings(current => ({
      ...current,
      [sourceProject.id]: Object.fromEntries((sourceProject.statuses || []).flatMap(status => {
        const currentTarget = current[sourceProject.id]?.[status.name];
        const targetStatusId = availableIds.has(currentTarget)
          ? currentTarget
          : suggestions[status.name];
        return targetStatusId ? [[status.name, targetStatusId]] : [];
      })),
    }));
  };

  const connect = async () => {
    if (!baseUrl.trim() || !token.trim()) {
      setFailure('Вкажіть адресу YouTrack і постійний токен.');
      return;
    }
    setAction('connect');
    setFailure('');
    try {
      const next = await request('/api/integrations/youtrack', {
        method: 'POST',
        body: JSON.stringify({ organizationId, baseUrl, token }),
      });
      setConnection(next);
      setBaseUrl(next.baseUrl || baseUrl);
      setToken('');
      showToast('YouTrack підключено');
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося підключити YouTrack. Перевірте адресу й токен.'));
    } finally {
      setAction('');
    }
  };

  const disconnect = async () => {
    if (ACTIVE_JOB_STATUSES.has(job?.status)) {
      setFailure('Спочатку зупиніть активний імпорт — тоді YouTrack можна буде відключити.');
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
      setStatusMappings({});
      setUserMappings({});
      setJob(null);
      setFailure('');
      showToast('YouTrack відключено');
      return true;
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося відключити YouTrack. Спробуйте ще раз.'));
      return false;
    } finally {
      setAction('');
    }
  };

  const discover = async () => {
    setAction('discover');
    setFailure('');
    try {
      const result = await request('/api/integrations/youtrack/discover', {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      });
      const projectIds = result.projects
        .filter(project => (project.statuses || []).length > 0)
        .map(project => project.id);
      setDiscovery(result);
      setSelectedProjectIds(projectIds);
      setProjectMappings(Object.fromEntries(projectIds.map(id => [id, 'create'])));
      // Only projects whose statuses were actually discovered get a filter. A
      // project whose state bundle is unreadable has nothing to choose from,
      // and sending it an empty list would read as "import no statuses".
      setStatusFilters(Object.fromEntries(result.projects.flatMap(project => (
        (project.statuses || []).length
          ? [[project.id, project.statuses.map(status => status.name)]]
          : []
      ))));
      setStatusMappings(suggestYouTrackStatusMappings(result.projects, result.targetStatuses));
      setUserMappings(suggestUserMappings(result.users, members));
      showToast(`Знайдено ${result.projects.length} ${plural(result.projects.length, ['проєкт', 'проєкти', 'проєктів'])} YouTrack`);
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося прочитати проєкти YouTrack. Спробуйте ще раз.'));
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

  const toggleSourceStatus = (projectId, sourceStatus) => {
    setStatusFilters(current => {
      const selected = current[projectId] || [];
      return {
        ...current,
        [projectId]: selected.includes(sourceStatus)
          ? selected.filter(status => status !== sourceStatus)
          : [...selected, sourceStatus],
      };
    });
  };

  const prepare = async () => {
    if (!selectedProjectIds.length) {
      setFailure('Оберіть хоча б один проєкт YouTrack.');
      return;
    }
    const projectWithoutStatuses = discovery?.projects?.find(project => (
      selectedProjectIds.includes(project.id)
      && (project.statuses || []).length > 0
      && (statusFilters[project.id] || []).length === 0
    ));
    if (projectWithoutStatuses) {
      setFailure(`Оберіть хоча б один статус для проєкту ${projectWithoutStatuses.name}.`);
      return;
    }
    const unmappedStatus = discovery?.projects?.flatMap(project => (
      selectedProjectIds.includes(project.id)
        ? (statusFilters[project.id] || []).flatMap(sourceStatus => (
          statusMappings[project.id]?.[sourceStatus]
            ? []
            : [{ project, sourceStatus }]
        ))
        : []
    ))[0];
    if (unmappedStatus) {
      setFailure(`Оберіть статус QuickTeam для «${unmappedStatus.sourceStatus}».`);
      return;
    }
    setAction('prepare');
    setFailure('');
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
          statusMappings,
        }),
      });
      setJob(result.job);
      // Порожня перевірка — не поломка, а результат: вибір такий, що під нього
      // не підпала жодна задача. Це пояснення, і воно лишається на екрані.
      if (result.job.totalIssues) {
        showToast(`Перевірено: до імпорту готово ${result.job.totalIssues} ${plural(result.job.totalIssues, ['задача', 'задачі', 'задач'])}`);
      } else {
        setFailure('Під цей вибір не підпала жодна задача. Перевірте обрані проєкти та статуси.');
      }
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося перевірити імпорт. Спробуйте ще раз.'));
    } finally {
      setAction('');
    }
  };

  const run = async () => {
    if (!job?.id || !ACTIVE_JOB_STATUSES.has(job.status)) return;
    keepRunning.current = true;
    setAction('run');
    setFailure('');
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
        showToast(`Імпорт завершено: ${current.processedIssues} ${plural(current.processedIssues, ['задача', 'задачі', 'задач'])}`);
      }
    } catch (error) {
      setFailure(`${errorTextUk(error?.message, 'Імпорт перервався')}\n\nПродовжити можна тією ж кнопкою — без дублів.`);
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
      setFailure('');
      showToast('Імпорт зупинено');
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося зупинити імпорт. Спробуйте ще раз.'));
    } finally {
      setAction('');
    }
  };

  const visibleUsers = discovery?.users?.filter(user => !user.banned).slice(0, 250) || [];
  const progress = progressFor(job);
  const jobSummary = jobSummaryParts(job);
  const activeJob = ACTIVE_JOB_STATUSES.has(job?.status);
  // A migration belongs to whoever started it — see `assertImportControl` on the
  // server, which refuses the same calls this hides. Everyone who can open this
  // screen still sees the job and its progress: the point is not to conceal that
  // an import is running, it is that stepping and stopping it are not theirs.
  const jobOwner = job?.createdBy
    ? members.find(member => memberId(member) === job.createdBy) || null
    : null;
  const jobIsMine = !job?.createdBy || job.createdBy === currentUserId;
  const jobOwnerName = jobOwner?.name || jobOwner?.displayName || jobOwner?.email || 'інший учасник';
  // Скільки людей уже прив'язано до учасників QuickTeam — те саме число, що
  // раніше треба було рахувати очима, гортаючи двісті рядків селектів.
  const mappedUserCount = visibleUsers.filter(user => {
    const mapping = userMappings[sourceUserId(user)];
    return mapping && mapping !== 'external';
  }).length;

  // Стан джерела читає шапка секції над цим компонентом — там, де його читають
  // усі інші інтеграції. Односторонньо: сюди назад нічого не приходить, тож
  // циклу перерендерів тут немає.
  useEffect(() => {
    onStatus?.(loading ? 'connecting' : connection.connected ? 'connected' : 'idle');
  }, [onStatus, loading, connection.connected]);

  useEffect(() => {
    if (action !== 'run') return undefined;
    const warnBeforeClose = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [action]);

  // Той самий екран, що й у будь-якої інтеграції: сцена підключення, поки
  // джерела немає, і рядки на білому, коли воно є. Відрізняється рівно одним —
  // зоною роботи внизу, і це відхилення чесне: імпорт триває хвилинами, показує
  // поступ і може обірватись посередині. Такого немає в жодної інтеграції, і
  // рядок налаштування цього не вміщає.
  //
  // Те, що пішло звідси разом зі старим шелом: пронумеровані кроки підключення
  // (їх було три, і всі три малювались одночасно, тож «крок» нічого не значив),
  // сірі панелі з обводкою навколо кожного блока, і власна смуга прогресу —
  // тепер це `Meter`, той самий, яким продукт малює будь-яку частку.
  return (
    <div className="flex flex-col gap-[16px]">
      {/* Причина стоїть на екрані, під тим, що натиснули, і тримається, доки її
          не усунуть або доки читач сам її не закриє. Тост тут не працював: він
          спливав над нижнім краєм, за сотні пікселів від дії, зникав за девʼять
          секунд — а причина лишалася чинною. */}
      {failure && (
        <Alert variant="danger" onClose={() => setFailure('')}>
          <span className="whitespace-pre-line">{failure}</span>
        </Alert>
      )}

      {!connection.connected ? (
        <IntegrationConnect
          logoSrc="/integrations/youtrack.svg"
          title="Підключіть YouTrack"
          description="Вкажіть адресу вашого YouTrack і постійний токен. QuickTeam перевірить доступ і збереже токен зашифрованим."
          action={{
            label: 'Перевірити й підключити',
            icon: Search,
            onClick: connect,
            loading: action === 'connect',
            disabled: !baseUrl.trim() || !token.trim() || loading,
          }}
          footnote={(
            <>
              Потрібен токен зі scope «YouTrack» — Profile → Account Security → New token.{' '}
              <a
                href="https://www.jetbrains.com/help/youtrack/devportal/Manage-Permanent-Token.html"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-ink hover:underline"
              >
                Інструкція JetBrains
              </a>
            </>
          )}
        >
          <Label>Адреса YouTrack</Label>
          <Input
            type="url"
            value={baseUrl}
            onChange={event => setBaseUrl(event.target.value)}
            placeholder="https://company.youtrack.cloud"
            aria-label="Адреса YouTrack"
            disabled={loading}
            size="md"
          />
          <Label>Постійний токен</Label>
          <Input
            type="password"
            value={token}
            onChange={event => setToken(event.target.value)}
            placeholder="perm:..."
            aria-label="Постійний токен YouTrack"
            autoComplete="new-password"
            disabled={loading}
            size="md"
          />
        </IntegrationConnect>
      ) : (
        <>
          <Card preset="borderless" padding="lg">
            <SettingRow label="Джерело" desc="Звідки переносимо">
              <span className="text-[13px] text-muted">
                {connection.account?.name || connection.account?.login || 'YouTrack'} · {connection.baseUrl}
              </span>
            </SettingRow>

            <SettingRow
              label="Проєкти й статуси"
              desc={discovery
                ? 'Що переносимо і в які статуси QuickTeam. Повторний запуск оновлює вже перенесене без дублів.'
                : 'Спочатку подивимось, що є у вашому YouTrack'}
            >
              {discovery ? (
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-muted">
                    {selectedProjectIds.length} {plural(selectedProjectIds.length, ['проєкт', 'проєкти', 'проєктів'])}
                  </span>
                  <TextAction onClick={() => setScopeOpen(true)}>Налаштувати</TextAction>
                </div>
              ) : (
                <Button style="secondary" size="sm" icon={Search} onClick={discover} loading={action === 'discover'}>
                  Знайти проєкти
                </Button>
              )}
            </SettingRow>

            {discovery && (
              <SettingRow
                label="Люди"
                desc="Кого прив'язати до учасників QuickTeam. Решта перенесуться як зовнішні автори."
              >
                <div className="flex items-center gap-3">
                  <span className="text-[13px] text-muted">
                    {mappedUserCount} із {visibleUsers.length}
                  </span>
                  <TextAction onClick={() => setPeopleOpen(true)}>Зіставити</TextAction>
                </div>
              </SettingRow>
            )}

            {discovery && !activeJob && (
              <SettingRow label="Перевірка перед імпортом" desc="Рахує задачі й нічого не змінює">
                <Button style="secondary" size="sm" icon={Search} onClick={prepare} loading={action === 'prepare'}>
                  Перевірити імпорт
                </Button>
              </SettingRow>
            )}

            <SettingRow
              label="Відключити YouTrack"
              desc="Токен буде видалено. Уже перенесені проєкти й задачі залишаться у QuickTeam."
              danger
            >
              <Button style="ghost" color="red" size="sm" onClick={disconnect} loading={action === 'disconnect'} disabled={activeJob}>
                Відключити
              </Button>
            </SettingRow>
          </Card>

          {job && (
            <IntegrationWork
              title="Імпорт"
              description="Іде з цієї вкладки — тримайте її відкритою. Перезапуск не створює дублів."
              status={<Pill tone={JOB_TONES[job.status] || 'neutral'} size="md">{statusLabel(job.status)}</Pill>}
            >
              <Meter
                value={job.totalIssues ? (job.processedIssues + job.failedIssues) / job.totalIssues : 0}
                label={`${job.processedIssues + job.failedIssues} із ${job.totalIssues} ${plural(job.totalIssues, ['задача', 'задачі', 'задач'])}`}
                reading={`${progress}%`}
              />

              {jobSummary.length > 0 && (
                <p className="text-[12px] text-muted">{jobSummary.join(' · ')}</p>
              )}

              {/* Це поле може містити що завгодно: воно зберігає те, що сказав
                  шар, який зламався, і в базі вже лежать рядки, записані до
                  того, як їх навчилися перекладати. */}
              {job.lastError && (
                <Alert variant="danger">
                  {errorTextUk(job.lastError, 'Крок імпорту не вдався. Спробуйте продовжити — уже перенесене не дублюється.')}
                </Alert>
              )}

              {job.warnings?.length > 0 && (
                <p className="text-[12px] text-warning">
                  {job.warnings.length} {plural(job.warnings.length, ['попередження', 'попередження', 'попереджень'])}. Дані без помилок продовжують імпортуватися.
                </p>
              )}

              {!jobIsMine && (
                <p className="text-[12px] leading-relaxed text-muted">
                  Цей імпорт запустив(ла) {jobOwnerName}
                  {isOrganizationOwner
                    ? '. Продовжити його може лише той, хто розпочав; ви як власник можете його зупинити.'
                    : '. Продовжити або зупинити його може той, хто розпочав, або власник організації.'}
                </p>
              )}

              {activeJob && (
                <div className="flex flex-wrap gap-2">
                  {jobIsMine && (
                    <Button size="md" icon={Upload} onClick={run} loading={action === 'run'}>
                      {job.status === 'running' ? 'Продовжити імпорт' : 'Почати імпорт'}
                    </Button>
                  )}
                  {(jobIsMine || isOrganizationOwner) && (
                    <Button style="ghost" color="red" size="md" onClick={cancel} loading={action === 'cancel'}>
                      Зупинити
                    </Button>
                  )}
                </div>
              )}
            </IntegrationWork>
          )}
        </>
      )}

      {/* Обсяг імпорту — діалог, а не половина екрана.
          П'ять проєктів, у кожного до двох десятків статусів, і в кожного
          статусу власний селект: це таблиця на кількасот рядків, і вона стояла
          просто в картці, у сірій панелі, всередині якої були білі плитки, у
          яких були рамки навколо кожного статусу. Чотири рівні вкладеності на
          один вибір. */}
      <Dialog
        isOpen={scopeOpen}
        onClose={() => setScopeOpen(false)}
        size="lg"
        title="Проєкти й статуси"
        description="Оберіть, що переносимо. Необрані залишаться в YouTrack."
        footer={<Button style="primary" size="md" onClick={() => setScopeOpen(false)}>Готово</Button>}
      >
        <div className="flex flex-col divide-y divide-line">
          {discovery?.projects?.map(project => {
            const checked = selectedProjectIds.includes(project.id);
            return (
              <div key={project.id} className="py-3">
                <div className="grid items-center gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      size="sm"
                      checked={checked}
                      onChange={() => toggleProject(project.id)}
                      disabled={(project.statuses || []).length === 0}
                      ariaLabel={project.name}
                    />
                    <span className="min-w-0 truncate text-[13px] font-semibold text-ink">
                      {project.name} <span className="font-normal text-muted">({project.shortName})</span>
                    </span>
                  </div>
                  <Select
                    value={projectMappings[project.id] || 'create'}
                    onChange={value => updateProjectMapping(project, value)}
                    disabled={!checked}
                    options={[
                      { value: 'create', label: 'Створити новий проєкт' },
                      ...activeProjects.map(target => ({ value: target.id, label: `Додати в: ${target.name}` })),
                    ]}
                    ariaLabel={`Куди імпортувати ${project.name}`}
                  />
                </div>

                {(project.statuses || []).length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2 pl-6">
                    {project.statuses.map(sourceStatus => {
                      const selected = (statusFilters[project.id] || []).includes(sourceStatus.name);
                      const targetStatuses = targetStatusesFor(project.id);
                      return (
                        <div
                          key={sourceStatus.id || sourceStatus.name}
                          className="grid items-center gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <Checkbox
                              size="sm"
                              checked={selected}
                              onChange={() => toggleSourceStatus(project.id, sourceStatus.name)}
                              disabled={!checked}
                              ariaLabel={`Імпортувати ${sourceStatus.name}`}
                            />
                            <p className="min-w-0 truncate text-[12px] text-ink">
                              {sourceStatus.name}
                              {sourceStatus.issueCount > 0 ? <span className="text-muted"> · {sourceStatus.issueCount}</span> : null}
                              {sourceStatus.archived ? <span className="text-muted"> · архівний</span> : null}
                            </p>
                          </div>
                          <Select
                            value={statusMappings[project.id]?.[sourceStatus.name] || ''}
                            onChange={value => setStatusMappings(current => ({
                              ...current,
                              [project.id]: {
                                ...current[project.id],
                                [sourceStatus.name]: value,
                              },
                            }))}
                            disabled={!checked || !selected}
                            options={targetStatuses.map(status => ({
                              value: status.id,
                              label: `${status.label} · ${statusCategoryLabel(status.category)}`,
                            }))}
                            ariaLabel={`Статус QuickTeam для ${sourceStatus.name}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Alert className="mt-2" variant="warning">
                    У доступних задачах цього проєкту не знайдено жодного статусу, тому імпорт для нього вимкнено.
                  </Alert>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>

      <Dialog
        isOpen={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        size="md"
        title="Зіставлення людей"
        description="Точний збіг email уже підставлено. Решта збережуться як зовнішні автори."
        footer={<Button style="primary" size="md" onClick={() => setPeopleOpen(false)}>Готово</Button>}
      >
        <div className="flex flex-col divide-y divide-line">
          {visibleUsers.map(user => {
            const id = sourceUserId(user);
            return (
              <div key={id} className="grid items-center gap-2 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                  <p className="truncate text-[11px] text-muted">{user.email || user.login || id}</p>
                </div>
                <Select
                  value={userMappings[id] || 'external'}
                  onChange={value => setUserMappings(current => ({ ...current, [id]: value }))}
                  options={memberOptions}
                  ariaLabel={`Кому відповідає ${user.name}`}
                />
              </div>
            );
          })}
          {(discovery?.users?.length || 0) > visibleUsers.length && (
            <p className="py-3 text-[11px] text-muted">
              Показано перші {visibleUsers.length} активних користувачів; інші імпортуються як зовнішні.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}