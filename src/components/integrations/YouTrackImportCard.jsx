'use client';

// ─── Перенесення з YouTrack ──────────────────────────────────────────────────
//
// Що тут було не так, дослівно зі скарги: «куча лишніх дій… постійно шось
// нажимати оновлювати, щоб шось додатково показалось» і «блок імпорт
// незавершений до кінця… воно просто висить, і ти не розумієш, а шо це таке і
// шо з ним робити».
//
// Обидві половини мали одну причину. Усе, що екран знав про YouTrack — проєкти,
// статуси, людей і зроблений вибір, — жило в стані React. Кожне перезавантаження
// стирало це дотла, тож людину щоразу зустрічала кнопка «Знайти проєкти», за
// нею «Перевірити імпорт», за нею «Почати імпорт»: чотири натискання й три
// очікування, щоб дійти туди, де ти вже був учора. А job, навпаки, лишався в
// базі назавжди — картка брала найновіший, яким би він не був, і малювала його
// панель, тоді як усі кнопки стояли за `activeJob`, до якого «скасовано» не
// належить. Панель була, дії не було, прибрати її не міг ніхто.
//
// Тепер навпаки. Знімок YouTrack і вибір живуть на сервері й переживають
// перезавантаження, тож екран нічого не питає — він показує. А стан перенесення
// — єдиний словник у `youtrackImport.mjs`, де для кожного стану й кожного читача
// є непорожній список дій; це перевіряє тест, а не обіцянка в коментарі.
//
// Три речі, яких тут більше немає й не має з'явитися знову:
//
//   Кнопка «Знайти проєкти». Розвідка — це плюмбінг, а не обіцянка, яку людина
//   відстежує. Вона стається сама, один раз, коли знімка ще немає.
//
//   Крок «Перевірити імпорт» окремою кнопкою. Він нікуди не подівся — рахунок
//   черги так само нічого не пише в робочий простір, — але це перша половина
//   натискання «Перенести», а не окреме рішення.
//
//   `disabled={activeJob}` на «Відключити». Замок, що робив відкликаний токен
//   глухим кутом: продовжити не можна, бо YouTrack не пускає, відключити не
//   можна, бо йде імпорт. Тепер відключення саме спиняє перенесення, а замінити
//   токен можна, нічого не відключаючи.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, RefreshCw, Search, Upload } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Input,
  Label,
  Meter,
  Pill,
  Select,
  SettingRow,
  SignalList,
  Skeleton,
  useConfirm,
} from '@/components/ui';
import { IntegrationConnect, IntegrationWork } from '@/components/integrations/IntegrationScreen';
import { authenticatedRequest } from '@/lib/services/authenticatedRequest';
import {
  IMPORT_AUTOSTART_LIMIT,
  IMPORT_PROJECT_LIMIT,
  describeImportJob,
  importActionsFor,
  importHaltSentence,
  importJobIsAbandoned,
  importJobIsDrivable,
  importJobIsOpen,
  importJobIsResumable,
  importPlanIssues,
  sourceUserId,
  suggestUserMappings,
  suggestYouTrackStatusMappings,
} from '@/lib/utils/youtrackImport.mjs';
import { statusCategoryLabel } from '@/lib/utils/statusCategories.mjs';
import { plural } from '@/lib/utils/plural.mjs';
import { errorTextUk } from '@/lib/utils/errors';

const EMPTY_PLAN = Object.freeze({
  selectedProjectIds: [],
  projectMappings: {},
  statusFilters: {},
  statusMappings: {},
  userMappings: {},
});

const PROJECT_FORMS = ['проєкту', 'проєктів', 'проєктів'];
const PROJECT_NOMINATIVE = ['проєкт', 'проєкти', 'проєктів'];
const ISSUE_FORMS = ['задача', 'задачі', 'задач'];
// Після «із» число з іменником стоять у родовому: «3 із 21 задачі», «3 із 663 задач».
const ISSUE_GENITIVE = ['задачі', 'задач', 'задач'];
const STATUS_FORMS = ['статус', 'статуси', 'статусів'];

function memberId(member) {
  return member?.id || member?.uid || member?.userId || '';
}

// Підсумок називає лише те, що справді сталося. «Успішно: 0 · Помилок: 0 ·
// Зв'язків: 0» — три нулі, які нічого не повідомляють; кількість перенесених
// задач лишається завжди, бо це і є відповідь на питання «скільки вже».
function jobSummaryParts(job) {
  if (!job) return [];
  const parts = [`Перенесено: ${job.processedIssues || 0}`];
  if (job.failedIssues > 0) parts.push(`Помилок: ${job.failedIssues}`);
  if (job.processedLinks > 0) parts.push(`Зв’язків: ${job.processedLinks}`);
  return parts;
}

function progressShare(job) {
  if (!job?.totalIssues) return job?.status === 'completed' ? 1 : 0;
  return Math.min(1, (job.processedIssues + job.failedIssues) / job.totalIssues);
}

// «Прочитано сьогодні о 14:20» / «Прочитано 1 вересня о 09:40». Дата з'являється
// лише тоді, коли вона щось додає: знімок, зроблений годину тому, і знімок,
// зроблений тиждень тому, — різні речі, і друга має сказати про себе сама.
function readingStamp(iso) {
  if (!iso) return '';
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return '';
  const time = at.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  const sameDay = at.toDateString() === new Date().toDateString();
  if (sameDay) return `Прочитано сьогодні о ${time}`;
  return `Прочитано ${at.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })} о ${time}`;
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
  const [newToken, setNewToken] = useState('');
  const [discovery, setDiscovery] = useState(null);
  const [discoveryError, setDiscoveryError] = useState('');
  const [tokenRejected, setTokenRejected] = useState(false);
  const [plan, setPlan] = useState(null);
  const [job, setJob] = useState(null);
  const [failedItems, setFailedItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');
  const [scopeOpen, setScopeOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [failedOpen, setFailedOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  // Відмова цього екрана — не подія, а стан: «не вийшло, ось чому». Тост про
  // таке спливав над нижнім краєм, за сотні пікселів від кнопки, яку натиснули,
  // тримався дев'ять секунд і йшов — а причина лишалася чинною й після того, як
  // напис зник. Тост лишається там, де він доречний: на тому, що сталося й
  // минуло («YouTrack підключено»).
  const [failure, setFailure] = useState('');
  const [dismissedError, setDismissedError] = useState('');
  const keepRunning = useRef(false);
  const confirmDialog = useConfirm();
  // Годинник тримається в стані, а не читається під час рендера: «Пауза» — це
  // висновок про час, і без такту компонент ніколи б до нього не дійшов, поки
  // ніхто нічого не натискає.
  const [now, setNow] = useState(() => Date.now());
  const stamp = useCallback(() => setNow(Date.now()), []);

  const request = useCallback(async (path, options = {}) => {
    return authenticatedRequest(path, {
      ...options,
      cache: 'no-store',
    }, 'Не вдалося виконати запит до інтеграції YouTrack');
  }, []);

  const orgParam = organizationId ? encodeURIComponent(organizationId) : '';

  const writePlan = useCallback(async (next, connectionId) => {
    try {
      await request('/api/integrations/youtrack/plan', {
        method: 'PUT',
        body: JSON.stringify({ organizationId, connectionId, plan: next }),
      });
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося зберегти вибір. Спробуйте ще раз.'));
    }
  }, [organizationId, request]);

  // Екран міняється одразу, база — за секунду тиші.
  //
  // Зняти галочки з двадцяти статусів — це двадцять натискань підряд, і запис
  // на кожне був би двадцятьма записами в базу та двадцятьма запитами проти
  // стелі в шістдесят на хвилину. Вибір зберігається, коли людина закінчила
  // вибирати: після паузи, при закритті вікна й обов'язково перед запуском.
  const pendingPlan = useRef(null);
  const planTimer = useRef(null);

  const flushPlan = useCallback(async () => {
    if (planTimer.current) {
      window.clearTimeout(planTimer.current);
      planTimer.current = null;
    }
    const pending = pendingPlan.current;
    pendingPlan.current = null;
    if (pending) await writePlan(pending.plan, pending.connectionId);
  }, [writePlan]);

  const savePlan = useCallback(async (next, connectionId) => {
    setPlan(next);
    if (!connectionId) return;
    pendingPlan.current = { plan: next, connectionId };
    if (planTimer.current) window.clearTimeout(planTimer.current);
    planTimer.current = window.setTimeout(() => {
      planTimer.current = null;
      const pending = pendingPlan.current;
      pendingPlan.current = null;
      if (pending) writePlan(pending.plan, pending.connectionId);
    }, 1_000);
  }, [writePlan]);

  // Піти з екрана — теж «закінчив вибирати». Скасувати таймер і викинути те, що
  // в ньому лежало, означало б утратити останню галочку рівно тоді, коли людина
  // вважає, що все збережено.
  useEffect(() => () => {
    if (planTimer.current) window.clearTimeout(planTimer.current);
    const pending = pendingPlan.current;
    pendingPlan.current = null;
    if (pending) writePlan(pending.plan, pending.connectionId);
  }, [writePlan]);

  // Значення за замовчуванням — не порожній екран, а готовий до запуску вибір:
  // усі проєкти, у яких видно статуси, усі їхні статуси, зіставлення за
  // збігом назви й людей за точним email. Саме цього й просили — «щоб одразу
  // показало всіх людей, статуси і все інше».
  const seedPlanFrom = useCallback(result => {
    // Двадцять — стеля одного запуску на сервері, і вибір за замовчуванням її
    // поважає: інакше організація з двадцятьма п'ятьма проєктами відкривала б
    // екран уже у стані, який сервер відмовиться прийняти.
    const projectIds = result.projects
      .filter(project => (project.statuses || []).length > 0)
      .map(project => project.id)
      .slice(0, IMPORT_PROJECT_LIMIT);
    return {
      selectedProjectIds: projectIds,
      projectMappings: Object.fromEntries(projectIds.map(id => [id, 'create'])),
      // Фільтр отримує лише проєкт, чиї статуси справді прочитані. У проєкта,
      // чий bundle недоступний, вибирати нема з чого, а порожній список читався
      // б як «не переносити жодного статусу».
      statusFilters: Object.fromEntries(result.projects.flatMap(project => (
        (project.statuses || []).length
          ? [[project.id, project.statuses.map(status => status.name)]]
          : []
      ))),
      statusMappings: suggestYouTrackStatusMappings(result.projects, result.targetStatuses),
      // Люди тут навмисно порожні. Підказка за email — похідна від складу
      // команди, а склад приходить пропом і на першому рендері «Налаштувань»
      // цілком може бути ще порожнім: заморожена в цю мить підказка означала б
      // «усі зовнішні» назавжди. Тому зберігається лише те, що людина обрала
      // руками, а підказка обчислюється щоразу заново, нижче.
      userMappings: {},
    };
  }, []);

  // Перший вибір пишеться одразу, без паузи: інакше перезавантаження за секунду
  // після підключення знайшло б порожнечу й почало розвідку наново.
  const seedPlan = useCallback(async (result, connectionId) => {
    const next = seedPlanFrom(result);
    setPlan(next);
    await writePlan(next, connectionId);
  }, [seedPlanFrom, writePlan]);

  const runDiscovery = useCallback(async connectionId => {
    setAction('discover');
    setDiscoveryError('');
    setTokenRejected(false);
    try {
      const result = await request('/api/integrations/youtrack/discover', {
        method: 'POST',
        body: JSON.stringify({ organizationId }),
      });
      setDiscovery(result);
      return result;
    } catch (error) {
      if (error?.code === 'YOUTRACK_TOKEN_REJECTED') setTokenRejected(true);
      setDiscoveryError(errorTextUk(error?.message, 'Не вдалося прочитати YouTrack.'));
      return null;
    } finally {
      setAction('');
    }
  }, [organizationId, request]);

  // Один прохід завантаження. Він же вирішує, чи треба читати YouTrack: знімок
  // від цього ж підключення береться з бази й нічого не коштує, і лише його
  // відсутність запускає розвідку — сама, один раз. Без цього правила
  // автоматична розвідка означала б сотні звернень до чужого API на кожне
  // відкриття вкладки.
  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const nextConnection = await request(`/api/integrations/youtrack?organizationId=${orgParam}`);
      setConnection(nextConnection);
      setBaseUrl(nextConnection.baseUrl || '');
      const connectionId = nextConnection.connectionId || '';
      const [snapshot, planned, imports] = await Promise.all([
        nextConnection.connected
          ? request(`/api/integrations/youtrack/discover?organizationId=${orgParam}&connectionId=${encodeURIComponent(connectionId)}`)
          : Promise.resolve(null),
        nextConnection.connected
          ? request(`/api/integrations/youtrack/plan?organizationId=${orgParam}&connectionId=${encodeURIComponent(connectionId)}`)
          : Promise.resolve({ plan: null }),
        request(`/api/integrations/youtrack/import?organizationId=${orgParam}`),
      ]);
      // Перенесення від іншої адреси YouTrack — не наше. Без цієї перевірки
      // картка показувала job попереднього сервера з його числами під новою
      // назвою: `connectionId` — це хеш адреси, тож питання вирішується
      // порівнянням, а не здогадкою.
      setJob((imports.jobs || []).find(item => (
        !item.acknowledgedAt
        && (!item.connectionId || !connectionId || item.connectionId === connectionId)
      )) || null);
      setPlan(planned?.plan || null);
      setFailure('');
      if (!nextConnection.connected) {
        setDiscovery(null);
        return;
      }
      if (snapshot?.state === 'ready') {
        setDiscovery(snapshot);
        if (!planned?.plan) await seedPlan(snapshot, connectionId);
        return;
      }
      setDiscovery(snapshot);
      const fresh = await runDiscovery(connectionId);
      if (fresh && !planned?.plan) await seedPlan(fresh, connectionId);
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося прочитати стан інтеграції YouTrack. Спробуйте ще раз.'));
    } finally {
      setLoading(false);
    }
  }, [orgParam, organizationId, request, runDiscovery, seedPlan]);

  useEffect(() => {
    keepRunning.current = false;
    const timer = window.setTimeout(load, 0);
    return () => {
      window.clearTimeout(timer);
      keepRunning.current = false;
    };
  }, [load]);

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

  const currentPlan = plan || EMPTY_PLAN;
  const jobState = describeImportJob(job, now);
  const locked = importJobIsOpen(jobState.state);
  const abandoned = importJobIsAbandoned(job, jobState.state, now);
  const actions = useMemo(() => importActionsFor(job, jobState.state, {
    userId: currentUserId,
    isOrganizationOwner,
    isOrganizationAdmin: true,
    abandoned,
  }), [job, jobState.state, currentUserId, isOrganizationOwner, abandoned]);

  const planIssues = useMemo(() => (
    discovery?.state === 'ready'
      ? importPlanIssues(currentPlan, discovery, {
        targetStatuses: discovery.targetStatuses || [],
        projects: activeProjects,
        memberIds: new Set(members.map(memberId).filter(Boolean)),
      })
      : []
  ), [activeProjects, currentPlan, discovery, members]);

  // Підказка знизу, явний вибір зверху. Збережений вибір тримає лише те, що
  // обрали руками; решта — свіжа підказка за точним email, перерахована щоразу.
  // Тому людина, яка з'явилась у команді після того, як вибір зберегли, одразу
  // підставляється, а той, кого навмисно лишили зовнішнім, лишається зовнішнім:
  // це явний запис, і він перекриває підказку.
  const effectiveUserMappings = useMemo(() => ({
    ...suggestUserMappings(discovery?.users || [], members),
    ...currentPlan.userMappings,
  }), [discovery, members, currentPlan.userMappings]);

  const targetStatusesFor = useCallback((sourceProjectId, targetOverride) => {
    const targetProjectId = targetOverride ?? currentPlan.projectMappings[sourceProjectId] ?? 'create';
    const hiddenStatusIds = new Set(
      targetProjectId === 'create'
        ? []
        : activeProjects.find(project => project.id === targetProjectId)?.hiddenColumns || [],
    );
    return (discovery?.targetStatuses || []).filter(status => !hiddenStatusIds.has(status.id));
  }, [activeProjects, currentPlan.projectMappings, discovery]);

  const updateProjectMapping = (sourceProject, targetProjectId) => {
    const availableStatuses = targetStatusesFor(sourceProject.id, targetProjectId);
    const availableIds = new Set(availableStatuses.map(status => status.id));
    const suggestions = suggestYouTrackStatusMappings([sourceProject], availableStatuses)[sourceProject.id] || {};
    savePlan({
      ...currentPlan,
      projectMappings: { ...currentPlan.projectMappings, [sourceProject.id]: targetProjectId },
      statusMappings: {
        ...currentPlan.statusMappings,
        [sourceProject.id]: Object.fromEntries((sourceProject.statuses || []).flatMap(status => {
          const chosen = currentPlan.statusMappings[sourceProject.id]?.[status.name];
          const targetStatusId = availableIds.has(chosen) ? chosen : suggestions[status.name];
          return targetStatusId ? [[status.name, targetStatusId]] : [];
        })),
      },
    }, connection.connectionId);
  };

  const toggleProject = projectId => {
    const selected = currentPlan.selectedProjectIds.includes(projectId)
      ? currentPlan.selectedProjectIds.filter(id => id !== projectId)
      : [...currentPlan.selectedProjectIds, projectId];
    savePlan({ ...currentPlan, selectedProjectIds: selected }, connection.connectionId);
  };

  const toggleSourceStatus = (projectId, sourceStatus) => {
    const selected = currentPlan.statusFilters[projectId] || [];
    savePlan({
      ...currentPlan,
      statusFilters: {
        ...currentPlan.statusFilters,
        [projectId]: selected.includes(sourceStatus)
          ? selected.filter(status => status !== sourceStatus)
          : [...selected, sourceStatus],
      },
    }, connection.connectionId);
  };

  const setStatusMapping = (projectId, sourceStatus, targetStatusId) => {
    savePlan({
      ...currentPlan,
      statusMappings: {
        ...currentPlan.statusMappings,
        [projectId]: { ...currentPlan.statusMappings[projectId], [sourceStatus]: targetStatusId },
      },
    }, connection.connectionId);
  };

  const setUserMapping = (sourceId, value) => {
    savePlan({
      ...currentPlan,
      userMappings: { ...currentPlan.userMappings, [sourceId]: value },
    }, connection.connectionId);
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
      // Розвідка йде тим самим натисканням. Окрема кнопка «Знайти проєкти» була
      // проханням підтвердити те, чого людина щойно й попросила.
      const fresh = await runDiscovery(next.connectionId);
      if (fresh) await seedPlan(fresh, next.connectionId);
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося підключити YouTrack. Перевірте адресу й токен.'));
    } finally {
      setAction('');
    }
  };

  // Замінити токен, нічого не відключаючи.
  //
  // `connectionId` — це хеш адреси, а всі ключі ідемпотентності прив'язані до
  // нього, тож той самий YouTrack під новим токеном лишається тим самим
  // YouTrack: незавершене перенесення продовжується з тієї ж задачі й нічого не
  // дублює. Саме тому адресу тут змінити не можна — інша адреса це інший
  // YouTrack і тихий повний дубль усього, що вже перенесли.
  const replaceToken = async () => {
    if (!newToken.trim()) {
      setFailure('Вкажіть новий постійний токен YouTrack.');
      return;
    }
    setAction('token');
    setFailure('');
    try {
      const next = await request('/api/integrations/youtrack', {
        method: 'POST',
        body: JSON.stringify({ organizationId, baseUrl: connection.baseUrl, token: newToken }),
      });
      setConnection(next);
      setNewToken('');
      setTokenOpen(false);
      setTokenRejected(false);
      showToast('Токен YouTrack оновлено');
      await runDiscovery(next.connectionId);
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'YouTrack не прийняв цей токен. Перевірте його й спробуйте ще раз.'));
    } finally {
      setAction('');
    }
  };

  const disconnect = async () => {
    if (!(await confirmDialog({
      title: 'Відключити YouTrack?',
      message: locked
        ? 'Незавершене перенесення буде зупинено, а збережений токен видалено. Уже перенесені проєкти та задачі залишаться у QuickTeam.'
        : 'Збережений токен буде видалено. Уже перенесені проєкти та задачі залишаться у QuickTeam.',
      confirmText: 'Відключити',
      danger: true,
    }))) return false;

    keepRunning.current = false;
    setAction('disconnect');
    try {
      await request(`/api/integrations/youtrack?organizationId=${orgParam}`, { method: 'DELETE' });
      setConnection({ connected: false });
      setDiscovery(null);
      setDiscoveryError('');
      setPlan(null);
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

  // Кроки одного перенесення, доки воно рухається. Ця вкладка — двигун, і
  // панель каже про це прямо; коли вкладку закривають або йдуть з екрана, job
  // лишається там, де був, і при поверненні називає себе «Пауза» з кнопкою
  // «Продовжити», а не «Іде» над смугою, яка не рухається.
  const drive = useCallback(async startJob => {
    // Умова входу й умова продовження — різні, і сплутати їх дорого. Поки цикл
    // перевіряв «чи можна крутити далі» ПЕРЕД першим кроком, «Продовжити» на
    // паузі й «Спробувати ще раз» на зупиненому не надсилали жодного запиту:
    // умова не виконувалась, цикл виходив, кнопка блимала й нічого не робила.
    // Тобто рівно той глухий кут, який ця робота прибирає.
    if (!startJob?.id || !importJobIsResumable(describeImportJob(startJob, Date.now()).state)) return;
    keepRunning.current = true;
    setAction('run');
    setFailure('');
    try {
      let current = startJob;
      do {
        const result = await request('/api/integrations/youtrack/import', {
          method: 'POST',
          body: JSON.stringify({ action: 'run', organizationId, jobId: current.id }),
        });
        current = result.job;
        setJob(current);
        stamp();
        if (current.stepInProgress) {
          await new Promise(resolve => setTimeout(resolve, 750));
        }
      } while (keepRunning.current && importJobIsDrivable(describeImportJob(current, Date.now()).state));
      if (current.status === 'completed') {
        showToast(`Перенесення завершено: ${current.processedIssues} ${plural(current.processedIssues, ISSUE_FORMS)}`);
      }
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Перенесення перервалося. Продовжити можна тією ж кнопкою — без дублів.'));
    } finally {
      keepRunning.current = false;
      setAction('');
    }
  }, [organizationId, request, showToast, stamp]);

  const start = async () => {
    const count = currentPlan.selectedProjectIds.length;
    if (!count) {
      setScopeOpen(true);
      return;
    }
    if (!(await confirmDialog({
      title: 'Почати перенесення?',
      message: `Перенесемо задачі з ${count} ${plural(count, PROJECT_FORMS)} YouTrack. Спершу порахуємо, скільки їх, потім почнемо переносити. Уже перенесене оновиться — дублів не буде.\n\nПеренесення йде з цієї вкладки, тримайте її відкритою.`,
      confirmText: 'Почати',
    }))) return;

    setAction('start');
    setFailure('');
    await flushPlan();
    // Попереднє перенесення прибирається з екрана вже після підтвердження. Поки
    // «Почати заново» знімало його першим, відмова в діалозі лишала людину з
    // порожньою панеллю замість підсумку, який вона щойно читала.
    if (job?.id) await acknowledge();
    try {
      const result = await request('/api/integrations/youtrack/import', {
        method: 'POST',
        body: JSON.stringify({
          action: 'prepare',
          organizationId,
          selectedProjectIds: currentPlan.selectedProjectIds,
          projectMappings: currentPlan.projectMappings,
          userMappings: effectiveUserMappings,
          statusFilters: currentPlan.statusFilters,
          statusMappings: currentPlan.statusMappings,
        }),
      });
      setJob(result.job);
      stamp();
      setAction('');
      // Велике перенесення спиняється тут і називає число: година запису в
      // робочий простір — це вже рішення, а не крок. Звичайне йде далі саме,
      // бо саме про це й просили: «нажав кнопку і воно почало».
      if (result.job.totalIssues && result.job.totalIssues <= IMPORT_AUTOSTART_LIMIT) {
        await drive(result.job);
      }
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося порахувати задачі. Спробуйте ще раз.'));
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
      stamp();
      setFailure('');
      showToast('Перенесення зупинено');
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося зупинити перенесення. Спробуйте ще раз.'));
    } finally {
      setAction('');
    }
  };

  // Прибрати з екрана те, що вже сталося. Це не воскресіння й не видалення:
  // job лишається таким, яким закінчився, і просто перестає бути тим, на що
  // дивишся. Рівно цього не існувало, і тому «Скасовано · 0 із 663» ставало
  // меблями назавжди.
  const acknowledge = async () => {
    if (!job?.id) return;
    setAction('acknowledge');
    try {
      await request('/api/integrations/youtrack/import', {
        method: 'POST',
        body: JSON.stringify({ action: 'acknowledge', organizationId, jobId: job.id }),
      });
      setJob(null);
      setFailedItems(null);
      setFailure('');
    } catch (error) {
      setFailure(errorTextUk(error?.message, 'Не вдалося прибрати перенесення з екрана.'));
    } finally {
      setAction('');
    }
  };

  // «Почати заново» — це той самий запуск: підтвердження, прибирання підсумку,
  // рахунок черги. Друга функція тут була б другим шляхом до одного й того ж.
  const restart = start;

  const openFailedItems = async () => {
    if (!job?.id) return;
    setFailedOpen(true);
    if (failedItems) return;
    try {
      const result = await request(
        `/api/integrations/youtrack/import?organizationId=${orgParam}&jobId=${encodeURIComponent(job.id)}&items=failed`,
      );
      setFailedItems(result.items || []);
    } catch (error) {
      setFailedItems([]);
      setFailure(errorTextUk(error?.message, 'Не вдалося прочитати список задач, які не перенеслися.'));
    }
  };

  const runAction = id => {
    if (id === 'start') return start();
    if (id === 'run') return drive(job);
    if (id === 'cancel') return cancel();
    if (id === 'acknowledge') return acknowledge();
    if (id === 'restart') return restart();
    if (id === 'token') { setTokenOpen(true); return undefined; }
    if (id === 'scope') { setScopeOpen(true); return undefined; }
    return undefined;
  };

  const visibleUsers = discovery?.users || [];
  const selectedStatusCount = currentPlan.selectedProjectIds.reduce(
    (total, projectId) => total + (currentPlan.statusFilters[projectId] || []).length,
    0,
  );
  const mappedUserCount = visibleUsers.filter(user => {
    const mapping = effectiveUserMappings[sourceUserId(user)];
    return mapping && mapping !== 'external';
  }).length;
  const jobOwner = job?.createdBy
    ? members.find(member => memberId(member) === job.createdBy) || null
    : null;
  const jobIsMine = !job?.createdBy || job.createdBy === currentUserId;
  const jobOwnerName = jobOwner?.name || jobOwner?.displayName || jobOwner?.email || 'інший учасник';

  // Стан джерела читає шапка секції над цим компонентом — там, де його читають
  // усі інші інтеграції. «Помилка» тут з'явилася разом із причинами, яких раніше
  // не було кому назвати: над відкликаним токеном пігулка спокійно писала
  // «Підключено».
  useEffect(() => {
    const broken = tokenRejected || job?.blockedReason === 'connection';
    onStatus?.(
      loading ? 'connecting'
        : broken ? 'error'
          : connection.connected ? 'connected' : 'idle',
    );
  }, [onStatus, loading, connection.connected, tokenRejected, job?.blockedReason]);

  useEffect(() => {
    if (action !== 'run') return undefined;
    const warnBeforeClose = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeClose);
    return () => window.removeEventListener('beforeunload', warnBeforeClose);
  }, [action]);

  // Два різні такти, і плутати їх дорого.
  //
  // Годинник — місцевий і безкоштовний. «Пауза» й «покинуте» — це висновки про
  // час, а не новини з сервера, і поки їх виводило лише опитування, вони не
  // з'являлися саме тоді, коли потрібні: у зупиненого перенесення опитувати
  // нічого, тож годинник стояв, і чверть години до кнопки «Зупинити» для
  // адміністратора не спливала ніколи без перезавантаження сторінки.
  const jobOpen = importJobIsOpen(jobState.state);
  useEffect(() => {
    if (!jobOpen) return undefined;
    const timer = window.setInterval(stamp, 30_000);
    return () => window.clearInterval(timer);
  }, [jobOpen, stamp]);

  // Опитування — з мережі, і лише про те, що справді може змінитися без нас:
  // перенесення, яке рухає інша вкладка. «Пауза», «спинилося», «готово до
  // запуску», «завершено» й «скасовано» самі не міняються, а кожен такт — це
  // два читання з денного бюджету; десять секунд на паузі, яка триває годину,
  // з'їдали б сімнадцять тисяч читань за добу з однієї відкритої вкладки.
  useEffect(() => {
    if (!job?.id || jobState.state !== 'running' || action === 'run') return undefined;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const result = await request(
          `/api/integrations/youtrack/import?organizationId=${orgParam}&jobId=${encodeURIComponent(job.id)}`,
        );
        if (result.job) setJob(result.job);
      } catch {
        // Мовчки: це фонове опитування, і його невдача — не подія для читача.
        // Кнопки на панелі працюють і без нього.
      }
      stamp();
    };
    const timer = window.setInterval(tick, 10_000);
    return () => window.clearInterval(timer);
  }, [job?.id, jobState.state, action, orgParam, request, stamp]);

  const discoveryReady = discovery?.state === 'ready';
  const discoveryDesc = action === 'discover'
    ? 'Читаємо ваш YouTrack…'
    : tokenRejected
      ? 'YouTrack не прийняв збережений токен. Введіть новий у рядку «Джерело».'
      : discoveryError
        ? `Не вдалося прочитати. ${discoveryError}`
        : discoveryReady
          ? `Проєкти, статуси й люди. ${readingStamp(discovery.readAt)}`
          : 'Ще не читали';

  const scopeValue = discoveryReady
    ? `${currentPlan.selectedProjectIds.length} ${plural(currentPlan.selectedProjectIds.length, PROJECT_NOMINATIVE)} · ${selectedStatusCount} ${plural(selectedStatusCount, STATUS_FORMS)}`
    : '';

  const driving = action === 'run';
  const panelDescription = {
    none: 'Перенесемо проєкти, задачі, коментарі, вкладення й час. Уже перенесене оновлюється без дублів.',
    ready: 'Порахували. Перевірте число й запускайте.',
    running: driving
      ? 'Іде з цієї вкладки. Якщо її закрити, перенесення спиниться на поточній задачі — продовжити можна тією ж кнопкою.'
      : 'Іде просто зараз. Ця вкладка лише показує поступ.',
    stalled: 'Перенесення спинилося. Уже перенесене на місці.',
    blocked: 'Перенесення спинилося й нічого не втратило.',
    completed: 'Готово. Це вікно можна закрити.',
    cancelled: 'Зупинено вами. Уже перенесене залишилось у QuickTeam.',
  }[jobState.state] || '';

  // Головна дія глухне лише тоді, коли поруч уже стоїть те, що її відмикає:
  // список розбіжностей, кожен рядок якого веде у вікно з виправленням, або
  // рядок «Дані з YouTrack» із кнопкою «Спробувати ще раз». Порожній вибір її
  // не глушить — натискання відкриває вікно вибору, і це теж вихід.
  const primaryDisabled = jobState.state === 'none' && (planIssues.length > 0 || !discoveryReady);

  const scopeDialogTitle = 'Проєкти й статуси';
  const lockedNote = 'Змінюється після завершення або зупинки перенесення.';

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Причина стоїть на екрані, під тим, що натиснули, і тримається, доки її
          не усунуть або доки читач сам її не закриє. */}
      {failure && (
        <Alert variant="danger" onClose={() => setFailure('')}>
          <span className="whitespace-pre-line">{failure}</span>
        </Alert>
      )}

      {!connection.connected ? (
        <IntegrationConnect
          logoSrc="/integrations/youtrack.svg"
          title="Підключіть YouTrack"
          description="Вкажіть адресу вашого YouTrack і постійний токен. QuickTeam перевірить доступ, збереже токен зашифрованим і одразу покаже ваші проєкти, статуси й людей."
          action={{
            label: 'Підключити',
            icon: Search,
            onClick: connect,
            loading: action === 'connect' || action === 'discover',
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
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-[13px] text-muted">
                  {connection.account?.name || connection.account?.login || 'YouTrack'} · {connection.baseUrl}
                </span>
                <Button style="ghost" size="sm" icon={KeyRound} onClick={() => setTokenOpen(true)}>
                  Змінити токен
                </Button>
              </div>
            </SettingRow>

            <SettingRow label="Дані з YouTrack" desc={discoveryDesc}>
              <Button
                style="secondary"
                size="sm"
                icon={RefreshCw}
                onClick={() => runDiscovery(connection.connectionId)}
                loading={action === 'discover'}
                disabled={locked}
              >
                {discoveryError || tokenRejected ? 'Спробувати ще раз' : 'Оновити'}
              </Button>
            </SettingRow>

            {discoveryReady && (
              <SettingRow
                label={scopeDialogTitle}
                desc={locked
                  ? lockedNote
                  : 'Що переносимо і в які статуси QuickTeam. Повторний запуск оновлює вже перенесене без дублів.'}
                onClick={locked ? undefined : () => setScopeOpen(true)}
                value={scopeValue}
              >
                {locked ? <span className="shrink-0 text-[13px] text-muted">{scopeValue}</span> : null}
              </SettingRow>
            )}

            {discoveryReady && (
              <SettingRow
                label="Люди"
                desc={locked
                  ? lockedNote
                  : 'Кого прив’язати до учасників QuickTeam. Решта перенесуться як зовнішні автори.'}
                onClick={locked ? undefined : () => setPeopleOpen(true)}
                value={`${mappedUserCount} із ${discovery.usersTotal || visibleUsers.length}`}
              >
                {locked ? (
                  <span className="shrink-0 text-[13px] text-muted">
                    {mappedUserCount} із {discovery.usersTotal || visibleUsers.length}
                  </span>
                ) : null}
              </SettingRow>
            )}

            {!discoveryReady && !discoveryError && !tokenRejected && (
              <SettingRow label={scopeDialogTitle} desc="Читаємо, що є у вашому YouTrack">
                <Skeleton preset="control" width="half" />
              </SettingRow>
            )}

            <SettingRow
              label="Відключити YouTrack"
              desc="Токен буде видалено. Уже перенесені проєкти й задачі залишаться у QuickTeam."
              danger
            >
              <Button style="ghost" color="red" size="sm" onClick={disconnect} loading={action === 'disconnect'}>
                Відключити
              </Button>
            </SettingRow>
          </Card>

          {/* Розбіжності між збереженим вибором і тим, що є зараз, названі
              поіменно й ведуть у вікно, де їх виправляють. Вибір тепер переживає
              перезавантаження — а разом із цим переживає й редагування workflow,
              архівування проєкту та звільнення людини, тож те, що раніше було
              рідкою гонкою всередині `prepare`, стало звичайним станом
              наступного ранку. */}
          {planIssues.length > 0 && !locked && (
            <Card preset="bordered" padding="lg">
              <p className="ui-type-card-title text-ink">Виправте вибір, щоб почати</p>
              <SignalList
                className="mt-[10px]"
                signals={planIssues}
                onSelect={signal => (signal.opens === 'people' ? setPeopleOpen(true) : setScopeOpen(true))}
              />
            </Card>
          )}

          <IntegrationWork
            title="Перенесення"
            description={panelDescription}
            status={<Pill tone={jobState.tone} size="md">{jobState.label}</Pill>}
          >
            {jobState.state === 'none' ? (
              <EmptyState
                density="compact"
                surface="transparent"
                icon={Upload}
                title={currentPlan.selectedProjectIds.length ? 'Готово до перенесення' : 'Оберіть, що переносимо'}
                description={currentPlan.selectedProjectIds.length
                  ? `Задачі, коментарі, вкладення й час із ${currentPlan.selectedProjectIds.length} ${plural(currentPlan.selectedProjectIds.length, PROJECT_FORMS)}. Скільки саме задач — порахуємо після натискання.`
                  : 'Відкрийте «Проєкти й статуси» і оберіть хоча б один проєкт.'}
              />
            ) : (
              <>
                <Meter
                  value={progressShare(job)}
                  label={job.totalIssues
                    ? `${job.processedIssues + job.failedIssues} із ${job.totalIssues} ${plural(job.totalIssues, ISSUE_GENITIVE)}`
                    : 'Жодна задача не підпала під вибір'}
                  reading={`${Math.round(progressShare(job) * 100)}%`}
                  tone={jobState.state === 'blocked' ? 'danger' : jobState.state === 'stalled' ? 'warning' : 'neutral'}
                />
                <p className="text-[12px] text-muted">{jobSummaryParts(job).join(' · ')}</p>
              </>
            )}

            {jobState.state === 'blocked' && (
              <Alert variant="danger">
                <span className="whitespace-pre-line">
                  {`${importHaltSentence(job.blockedReason)}\n${errorTextUk(job.lastError, '')}`.trim()}
                </span>
              </Alert>
            )}

            {jobState.state === 'stalled' && (
              <p className="text-[12px] leading-relaxed text-warning">
                Останній крок був понад три хвилини тому. Продовжте — уже перенесене не задублюється.
              </p>
            )}

            {/* Останню помилку кроку можна закрити: перенесення, яке після неї
                пішло далі, не має показувати її вічно. Закритий текст
                запам'ятовується, інакше наступне опитування повертало б його на
                екран. */}
            {jobState.state !== 'blocked' && job?.lastError && job.lastError !== dismissedError && (
              <Alert variant="danger" onClose={() => setDismissedError(job.lastError)}>
                {errorTextUk(job.lastError, 'Крок перенесення не вдався. Продовжіть — уже перенесене не дублюється.')}
              </Alert>
            )}

            {job?.warningsCount > 0 && (
              <SignalList
                signals={[{
                  id: 'warnings',
                  tone: 'warning',
                  title: `${job.warningsCount} ${plural(job.warningsCount, ['попередження', 'попередження', 'попереджень'])}`,
                  description: (job.warnings || [])[0] || 'Дані без помилок перенеслися далі',
                  count: job.warningsCount,
                }]}
              />
            )}

            {job?.failedIssues > 0 && (
              <SignalList
                signals={[{
                  id: 'failed',
                  tone: 'warning',
                  title: `Не перенеслося задач: ${job.failedIssues}`,
                  description: 'Подивіться, що саме — повторний запуск спробує їх ще раз',
                  count: job.failedIssues,
                }]}
                onSelect={openFailedItems}
              />
            )}

            {job && !jobIsMine && (
              <p className="text-[12px] leading-relaxed text-muted">
                Це перенесення запустив(ла) {jobOwnerName}. Продовжити його може лише той, хто розпочав
                {abandoned
                  ? '; воно не рухається понад чверть години, тож зупинити його може будь-який адміністратор.'
                  : isOrganizationOwner
                    ? '; ви як власник можете його зупинити.'
                    : '; зупинити — він або власник організації.'}
              </p>
            )}

            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {actions.map(item => (
                  <Button
                    key={item.id}
                    size="md"
                    style={item.kind === 'primary' ? 'primary' : 'ghost'}
                    color={item.kind === 'danger' ? 'red' : undefined}
                    icon={item.id === 'start' || item.id === 'run' ? Upload : undefined}
                    onClick={() => runAction(item.id)}
                    loading={
                      (item.id === 'start' && action === 'start')
                      || (item.id === 'run' && action === 'run')
                      || (item.id === 'cancel' && action === 'cancel')
                      || (item.id === 'acknowledge' && action === 'acknowledge')
                    }
                    disabled={item.kind === 'primary' && primaryDisabled}
                  >
                    {item.id === 'start' && currentPlan.selectedProjectIds.length
                      ? `Перенести з ${currentPlan.selectedProjectIds.length} ${plural(currentPlan.selectedProjectIds.length, PROJECT_FORMS)}`
                      : item.label}
                  </Button>
                ))}
              </div>
            )}

            {locked && (
              <p className="text-[12px] text-muted">
                {jobState.state === 'running' || jobState.state === 'ready'
                  ? 'Поки триває перенесення, налаштування закриті. Зупиніть його, щоб їх змінити.'
                  : 'Поки це перенесення не завершене, налаштування закриті. Продовжіть або зупиніть його, щоб їх змінити.'}
              </p>
            )}
          </IntegrationWork>
        </>
      )}

      {/* Обсяг перенесення — діалог, а не половина екрана. */}
      <Dialog
        isOpen={scopeOpen}
        onClose={() => { setScopeOpen(false); flushPlan(); }}
        size="lg"
        title={scopeDialogTitle}
        description="Оберіть, що переносимо. Необрані залишаться в YouTrack."
        footer={(
          <div className="flex w-full items-center justify-between gap-3">
            <span className="text-[12px] text-muted">{scopeValue}</span>
            <Button style="primary" size="md" onClick={() => { setScopeOpen(false); flushPlan(); }}>Готово</Button>
          </div>
        )}
      >
        <div className="flex flex-col divide-y divide-line">
          {discovery?.projects?.map(project => {
            const checked = currentPlan.selectedProjectIds.includes(project.id);
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
                    value={currentPlan.projectMappings[project.id] || 'create'}
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
                    {project.statusesPartial && (
                      <Alert variant="warning">
                        Статуси зібрані з останніх 2 000 задач цього проєкту. Якщо якогось статусу тут немає, задачі з ним не перенесуться.
                      </Alert>
                    )}
                    {project.statuses.map(sourceStatus => {
                      const selected = (currentPlan.statusFilters[project.id] || []).includes(sourceStatus.name);
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
                            value={currentPlan.statusMappings[project.id]?.[sourceStatus.name] || ''}
                            onChange={value => setStatusMapping(project.id, sourceStatus.name, value)}
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
                    У доступних задачах цього проєкту не знайдено жодного статусу, тому імпорт для нього вимкнено. Найчастіше це означає, що токен не бачить статусів цього проєкту.
                  </Alert>
                )}
              </div>
            );
          })}
          {discovery?.projectsTruncated && (
            <p className="py-3 text-[11px] text-muted">
              Показано перші 200 проєктів YouTrack.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={peopleOpen}
        onClose={() => { setPeopleOpen(false); flushPlan(); }}
        size="md"
        title="Зіставлення людей"
        description="Точний збіг email уже підставлено. Решта збережуться як зовнішні автори."
        footer={<Button style="primary" size="md" onClick={() => { setPeopleOpen(false); flushPlan(); }}>Готово</Button>}
      >
        <Input
          value={peopleQuery}
          onChange={event => setPeopleQuery(event.target.value)}
          placeholder="Пошук за іменем або поштою"
          aria-label="Пошук людини YouTrack"
          size="md"
        />
        <div className="mt-3 flex flex-col divide-y divide-line">
          {visibleUsers
            .filter(user => {
              const needle = peopleQuery.trim().toLowerCase();
              if (!needle) return true;
              return `${user.name} ${user.email} ${user.login}`.toLowerCase().includes(needle);
            })
            .slice(0, 250)
            .map(user => {
              const id = sourceUserId(user);
              return (
                <div key={id} className="grid items-center gap-2 py-3 sm:grid-cols-[minmax(180px,1fr)_minmax(220px,1fr)]">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[11px] text-muted">{user.email || user.login || id}</p>
                  </div>
                  <Select
                    value={effectiveUserMappings[id] || 'external'}
                    onChange={value => setUserMapping(id, value)}
                    options={memberOptions}
                    ariaLabel={`Кому відповідає ${user.name}`}
                  />
                </div>
              );
            })}
          {discovery?.usersTruncated && (
            <p className="py-3 text-[11px] text-muted">
              Збережено перших 1 000 активних користувачів; інші перенесуться як зовнішні автори.
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        isOpen={tokenOpen}
        onClose={() => setTokenOpen(false)}
        size="sm"
        title="Новий токен YouTrack"
        description={`Адреса лишається та сама: ${connection.baseUrl || ''}. Новий токен замінить збережений — перенесене не зміниться.`}
        footer={(
          <Button style="primary" size="md" onClick={replaceToken} loading={action === 'token'}>
            Зберегти
          </Button>
        )}
      >
        <Label>Новий постійний токен</Label>
        <Input
          type="password"
          value={newToken}
          onChange={event => setNewToken(event.target.value)}
          placeholder="perm:..."
          aria-label="Новий постійний токен YouTrack"
          autoComplete="new-password"
          size="md"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-muted">
          Адресу змінити не можна — для іншого YouTrack спочатку відключіть цей.
          {locked ? ' Перенесення продовжиться з тієї задачі, на якій спинилося.' : ''}
        </p>
      </Dialog>

      <Dialog
        isOpen={failedOpen}
        onClose={() => setFailedOpen(false)}
        size="md"
        title="Що не перенеслося"
        description="Ці задачі лишились у YouTrack. Повторний запуск спробує їх ще раз."
        footer={<Button style="primary" size="md" onClick={() => setFailedOpen(false)}>Закрити</Button>}
      >
        <div className="flex flex-col divide-y divide-line">
          {(failedItems || []).map(item => (
            <div key={item.id} className="py-3">
              <p className="text-[13px] font-semibold text-ink">
                {item.sourceReadableId ? `${item.sourceReadableId} · ` : ''}{item.title || 'Без назви'}
              </p>
              <p className="mt-[2px] text-[11px] leading-relaxed text-muted">
                {errorTextUk(item.error, 'Причина не збереглася')}
              </p>
            </div>
          ))}
          {failedItems?.length === 0 && (
            <p className="py-3 text-[12px] text-muted">Список порожній.</p>
          )}
          {job?.failedIssues > 50 && (
            <p className="py-3 text-[11px] text-muted">
              Показано перші 50 із {job.failedIssues}.
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
