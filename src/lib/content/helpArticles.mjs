import { ISSUE_BULK_ACTIONS } from '../bulk/issueBulkActions.mjs';
import { INTEGRATIONS, INTEGRATION_STATES } from './integrations.mjs';
import { SHORTCUT_GROUPS } from './shortcuts.mjs';
import { STATUS_CATEGORY_IDS, STATUS_CATEGORIES } from '../utils/statusCategories.mjs';

export const HELP_CATEGORIES = Object.freeze([
  { id: 'start', label: 'Початок роботи', description: 'Організації, ролі, команда й доступ.' },
  { id: 'work', label: 'Робота із задачами', description: 'Проєкти, дошки, атрибути, спринти й час.' },
  { id: 'collaboration', label: 'Співпраця', description: 'Календар, чат, пошук і сповіщення.' },
  { id: 'insights', label: 'Керування', description: 'Аналітика, рахунки, інтеграції та імпорт.' },
  { id: 'trust', label: 'Безпека й підтримка', description: 'Доступ, приватність, видалення та діагностика.' },
]);

export const REQUIRED_HELP_COVERAGE = Object.freeze([
  'organizations-roles-invitations',
  'projects-boards',
  'issue-creation',
  'statuses-categories',
  'issue-fields',
  'kanban-bulk-selection',
  'subtasks-links-duplication',
  'attachments',
  'time-tracking',
  'sprints-backlog',
  'calendar',
  'chat-mentions',
  'search-shortcuts',
  'profiles-activity',
  'analytics-billing',
  'notifications',
  'integrations',
  'youtrack-import',
  'security-access',
  'support-troubleshooting',
]);

// Controlled product areas cannot silently drift away from the help center.
// Tests verify that every source exists and that its coverage id is backed by
// a valid article. When one of these areas changes, AGENTS.md requires its
// mapped article, news entry and version history to change in the same PR.
export const CONTROLLED_HELP_FEATURES = Object.freeze([
  { id: 'access', coverage: 'organizations-roles-invitations', sources: ['src/lib/context/AppContext.js', 'src/app/api/invitations/route.js'] },
  { id: 'projects', coverage: 'projects-boards', sources: ['src/app/(app)/[projectId]/ProjectBoardClient.jsx', 'src/app/api/projects/route.js'] },
  { id: 'issue-create', coverage: 'issue-creation', sources: ['src/components/CreateTaskModal.jsx', 'src/app/api/issues/route.js'] },
  { id: 'statuses', coverage: 'statuses-categories', sources: ['src/lib/utils/statusCategories.mjs'] },
  { id: 'fields', coverage: 'issue-fields', sources: ['src/lib/hooks/useWorkflowConfig.js'] },
  { id: 'bulk', coverage: 'kanban-bulk-selection', sources: ['src/app/api/issues/bulk/route.js', 'src/lib/hooks/useIssueSelection.js'] },
  { id: 'hierarchy', coverage: 'subtasks-links-duplication', sources: ['src/lib/utils/issueHierarchyModel.mjs'] },
  { id: 'attachments', coverage: 'attachments', sources: ['src/lib/services/fileUpload.js'] },
  { id: 'time', coverage: 'time-tracking', sources: ['src/components/workspace/IssueDetail.jsx'] },
  { id: 'sprints', coverage: 'sprints-backlog', sources: ['src/app/(app)/sprints/page.js'] },
  { id: 'calendar', coverage: 'calendar', sources: ['src/app/(app)/calendar/page.js'] },
  { id: 'chat', coverage: 'chat-mentions', sources: ['src/app/(app)/chat/page.js'] },
  { id: 'search', coverage: 'search-shortcuts', sources: ['src/components/WorkspaceCommandPalette.jsx'] },
  { id: 'profiles', coverage: 'profiles-activity', sources: ['src/components/profile/ProfileView.jsx'] },
  { id: 'analytics', coverage: 'analytics-billing', sources: ['src/app/(app)/analytics/page.js'] },
  { id: 'notifications', coverage: 'notifications', sources: ['src/lib/hooks/useNotifications.js'] },
  { id: 'integrations', coverage: 'integrations', sources: ['src/app/(app)/settings/page.js'] },
  { id: 'youtrack', coverage: 'youtrack-import', sources: ['src/lib/server/youtrackImporter.js'] },
  { id: 'security', coverage: 'security-access', sources: ['src/lib/server/firebaseAdmin.js', 'firestore.rules'] },
  { id: 'support', coverage: 'support-troubleshooting', sources: ['src/components/WorkspaceHelpMenu.jsx'] },
]);

const UPDATED_AT = '2026-08-15';
const roles = ['owner', 'admin', 'member'];
const categoryNames = STATUS_CATEGORY_IDS.map(id => `${id} — ${STATUS_CATEGORIES[id].label}`);
const availableIntegrations = INTEGRATIONS
  .filter(item => item.state === 'available')
  .map(item => `${item.label} — ${INTEGRATION_STATES[item.state]}`);
const plannedIntegrations = INTEGRATIONS
  .filter(item => item.state === 'planned')
  .map(item => `${item.label} — ${INTEGRATION_STATES[item.state]}`);
const bulkActionNames = ISSUE_BULK_ACTIONS.map(action => action.label);
const shortcutNames = SHORTCUT_GROUPS.flatMap(group => group.items.map(item => (
  `${item.label}: ${(item.alt || item.keys).join(' + ')}`
)));

export const HELP_ARTICLES = Object.freeze([
  {
    id: 'organizations-and-roles', slug: 'organizations-and-roles', coverage: ['organizations-roles-invitations'],
    title: 'Організації, ролі та запрошення', category: 'start', summary: 'Як створюється робочий простір, хто керує командою та як працюють запрошення.',
    keywords: ['організація', 'owner', 'admin', 'member', 'запрошення', 'команда'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/onboarding', '/team', '/settings'], minimumRole: 'member', relatedIds: ['projects-and-boards', 'security-and-access'],
    sections: [
      { id: 'organization', title: 'Один простір — одна організація', paragraphs: ['Після входу користувач створює організацію або приймає чинне запрошення. Дані проєктів, задач, чатів і налаштувань завжди обмежені активною організацією. Перемикання організації змінює цей контекст і очищає тимчасовий вибір задач.'] },
      { id: 'roles', title: 'Ролі', paragraphs: [`Фактична модель має три ролі: ${roles.join(', ')}. Owner керує фінансами й усіма адміністративними діями; admin керує проєктами, командою, workflow та спринтами; member працює із доступними йому проєктами й задачами.`], bullets: ['Запрошувати та видаляти учасників можуть owner і admin.', 'Учасник бачить лише проєкти, до команди яких має доступ.', 'Клієнтська співпраця відбувається у QuickTeam+, а не через внутрішню роль workspace.'] },
      { id: 'invites', title: 'Запрошення', paragraphs: ['Запрошення створюється у розділі команди або під час налаштування проєкту. Посилання та email-запрошення проходять через серверний API. Прийняття запрошення не дає доступу до іншої організації чи чужого проєкту.'] },
    ],
  },
  {
    id: 'projects-and-boards', slug: 'projects-and-boards', coverage: ['projects-boards'],
    title: 'Проєкти й дошки', category: 'work', summary: 'Створення проєкту, команда, архівація та налаштування колонок.',
    keywords: ['проєкт', 'дошка', 'колонки', 'команда', 'архів'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/', '/[projectId]'], minimumRole: 'member', relatedIds: ['organizations-and-roles', 'statuses-and-categories'],
    sections: [
      { id: 'project', title: 'Проєктний контекст', paragraphs: ['Owner або admin створює проєкт через захищений серверний маршрут. Кожен проєкт отримує стабільний ASCII-префікс, а задачі — послідовні ключі на кшталт ENG-12. Учасники мають доступ лише до проєктів своєї команди.'] },
      { id: 'board', title: 'Дошка', paragraphs: ['Проєктна Kanban-дошка показує локальні статуси організації. У налаштуваннях дошки можна приховати окремі колонки, але вхідна категорія лишається доступною. Перетягування одразу оновлює оптимістичний стан і повертає картку назад, якщо сервер відхилив перехід.'] },
      { id: 'archive', title: 'Архівація', paragraphs: ['Архівований проєкт стає недоступним для активної роботи й може бути відновлений уповноваженим користувачем. Повне видалення організації навмисно недоступне, доки немає перевіреного серверного cascade.'] },
    ],
  },
  {
    id: 'creating-issues', slug: 'creating-issues', coverage: ['issue-creation'],
    title: 'Створення задач', category: 'work', summary: 'Швидке й повне створення, стартовий статус та перехід до нової задачі.',
    keywords: ['створити задачу', 'створити ще одне', 'composer', 'ключ'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/my?new=1', '/[projectId]'], minimumRole: 'member', relatedIds: ['issue-fields', 'statuses-and-categories'],
    sections: [
      { id: 'ways', title: 'Два способи створення', paragraphs: ['На дошці можна швидко додати задачу в колонку або відкрити повну форму. У повній формі доступні опис, проєкт, статус, пріоритет, тип, виконавці, мітки, дедлайн, оцінка та спринт. «Створити ще одне» очищає форму після успішного запису; звичайне створення відкриває нову задачу.'] },
      { id: 'server', title: 'Що гарантує сервер', paragraphs: ['Створення відбувається через авторизований API. Сервер перевіряє членство, команду проєкту, workflow, спринт, виконавців і ліміти полів, атомарно резервує наступний ключ та записує audit. Стартовий статус визначається канонічною категорією входу й не може бути прихованою колонкою.'] },
    ],
  },
  {
    id: 'statuses-and-categories', slug: 'statuses-and-categories', coverage: ['statuses-categories'],
    title: 'Статуси та категорії', category: 'work', summary: 'Чому назва статусу локальна, а категорія спільна для всіх проєктів.',
    keywords: ['статус', 'категорія', 'backlog', 'todo', 'in-progress', 'done', 'cancelled'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=workflow', '/my'], minimumRole: 'member', relatedIds: ['projects-and-boards', 'kanban-and-bulk-actions'],
    sections: [
      { id: 'categories', title: 'П’ять категорій', paragraphs: ['Організація може назвати й упорядкувати статуси як завгодно, але кожен статус належить одній спільній категорії. Саме категорія визначає міжпроєктні колонки, завершення, прострочення, velocity і рахунки.'], bullets: categoryNames },
      { id: 'boards', title: 'Проєктна й міжпроєктна дошки', paragraphs: ['Проєктна дошка записує точний статус. «Мої завдання» групує картки за категоріями; перехід у категорію резолвить дозволений статус окремо в проєкті кожної задачі. Поле isDone є лише похідним наслідком категорії й не визначає поведінку самостійно.'] },
    ],
  },
  {
    id: 'issue-fields', slug: 'issue-fields', coverage: ['issue-fields'],
    title: 'Пріоритети, типи, мітки й виконавці', category: 'work', summary: 'Як атрибути задачі впливають на роботу, фільтри та планування.',
    keywords: ['пріоритет', 'тип', 'мітка', 'виконавець', 'дедлайн', 'оцінка'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=workflow', '/my'], minimumRole: 'member', relatedIds: ['creating-issues', 'kanban-and-bulk-actions'],
    sections: [
      { id: 'fields', title: 'Робочі атрибути', paragraphs: ['Пріоритет, тип і мітки беруться з workflow організації. Дедлайн зберігає дату з урахуванням timezone організації, оцінка — хвилини в межах серверного ліміту. «Без пріоритету» є явним станом, а не відсутністю правила.'] },
      { id: 'assignees', title: 'Кілька відповідальних', paragraphs: ['Задача підтримує масив відповідальних. Додавання та прибирання змінюють лише названих людей; повна заміна або очищення виконуються лише явною командою. Призначення учасника може створити сповіщення для нього.'] },
    ],
  },
  {
    id: 'kanban-and-bulk-actions', slug: 'kanban-and-bulk-actions', coverage: ['kanban-bulk-selection'],
    title: 'Kanban, Shift-вибір і масові дії', category: 'work', summary: 'Як вибрати кілька задач на дошці, у списку або спринті.',
    keywords: ['kanban', 'shift', 'масові дії', 'bulk', 'вибрати всі', 'escape'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/my', '/sprints', '/[projectId]'], minimumRole: 'member', relatedIds: ['statuses-and-categories', 'sprints-and-backlog'],
    sections: [
      { id: 'selection', title: 'Вибір', paragraphs: ['Відкрийте кебаб колонки, списку або спринту та натисніть «Вибрати всі». Лише після цього checkbox замінює пріоритет у правому верхньому слоті картки або у відповідному слоті рядка; наведення саме по собі режим вибору не вмикає. Shift додає діапазон у поточному візуальному порядку. Повторна команда, Escape або × очищає вибір. Зміна маршруту, організації, проєкту чи фільтра не дозволяє прихованим задачам потрапити в операцію.'], bullets: ['Поки вибір активний, drag-and-drop заблокований.', 'Кількість вибраних оголошується через aria-live.', 'Checkbox і групові команди доступні з клавіатури.'] },
      { id: 'actions', title: 'Доступні масові дії', paragraphs: ['QuickTeam збереже всі можливі зміни та повідомить, скільки задач оновлено. Якщо частину змін виконати не вдалося, ви побачите кількість і причини помилок.'], bullets: bulkActionNames },
      { id: 'excluded', title: 'Що не є масовою дією', paragraphs: ['Перенесення між проєктами, підзавдання, зв’язки, списання часу, описи й коментарі потребують роботи з кожною задачею окремо.'] },
    ],
  },
  {
    id: 'subtasks-links-and-duplicates', slug: 'subtasks-links-and-duplicates', coverage: ['subtasks-links-duplication'],
    title: 'Підзавдання, зв’язки та дублювання', category: 'work', summary: 'Однорівнева hierarchy, логічні залежності та безпечні копії.',
    keywords: ['підзавдання', 'parent', 'зв’язок', 'блокує', 'дублювати', 'кошик'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/[projectId]/issue/[issueId]'], minimumRole: 'member', relatedIds: ['creating-issues', 'security-and-access'],
    sections: [
      { id: 'hierarchy', title: 'Підзавдання', paragraphs: ['QuickTeam підтримує один рівень parent/subtask. Батьківська задача показує прогрес дітей; закриття може бути заблоковане, доки відкриті підзавдання або залежності. Зміна hierarchy проходить через серверний маршрут із перевіркою проєкту й циклів.'] },
      { id: 'links', title: 'Логічні зв’язки', paragraphs: ['Зв’язки «блокує», «заблоковано» й «пов’язано» не змінюють hierarchy. Вони працюють лише в межах проєкту; відкритий blocker може заборонити завершення задачі.'] },
      { id: 'duplicate', title: 'Копії та кошик', paragraphs: ['Дублювання створює нову задачу з новим ключем через той самий server create flow. Видалення є recoverable soft-delete: задача потрапляє до серверного кошика на обмежений час і може бути відновлена, якщо бухгалтерські інваріанти дозволяють операцію.'] },
    ],
  },
  {
    id: 'attachments', slug: 'attachments', coverage: ['attachments'],
    title: 'Описи, чеклісти й вкладення', category: 'work', summary: 'Форматування опису, файли, перегляд і правила приватності.',
    keywords: ['опис', 'markdown', 'чекліст', 'файл', 'вкладення', 'cloudinary'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/[projectId]/issue/[issueId]'], minimumRole: 'member', relatedIds: ['security-and-access', 'chat-and-mentions'],
    sections: [
      { id: 'description', title: 'Опис і чеклісти', paragraphs: ['Опис підтримує Markdown, режим попереднього перегляду та checklist-рядки. Checklist в описі — це легкі пункти, не окремі задачі й не учасники hierarchy.'] },
      { id: 'files', title: 'Вкладення', paragraphs: ['Файли завантажуються за підписаним сервером шляхом, мають організаційний і проєктний scope та відкриваються у viewer або завантажуються оригіналом. Приватне вкладення чату доступне лише учасникам кімнати; знання URL не замінює перевірку доступу.'] },
      { id: 'file-types', title: 'Типи файлів', paragraphs: ['Кожен файл показує, що він таке: зображення — власну мініатюру, відео — перший кадр зі значком відтворення, решта — гліф і колір своєї родини (PDF, таблиця, документ, презентація, текст, код, архів). Аудіо не відкривається у перегляді — воно грає прямо у списку вкладень: пауза, перемотка стрілками, Home і End. Одночасно грає лише один запис. У повноекранному перегляді відкриваються зображення, PDF, відео та текстові файли; для решти доступне завантаження. Так само це працює в чаті — вкладення задачі та вкладення повідомлення виглядають і поводяться однаково.'] },
    ],
  },
  {
    id: 'time-tracking', slug: 'time-tracking', coverage: ['time-tracking'],
    title: 'Час, таймер і журнал', category: 'work', summary: 'Запуск таймера, ручні записи та зв’язок із рахунками.',
    keywords: ['час', 'таймер', 'time log', 'журнал', 'оцінка'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/[projectId]/issue/[issueId]', '/analytics'], minimumRole: 'member', relatedIds: ['analytics-and-billing', 'calendar'],
    sections: [
      { id: 'timer', title: 'Один активний таймер', paragraphs: ['Таймер запускається на задачі й зупиняється з картки, деталей або командної палітри. Після зупинки створюється запис журналу часу; активний таймер не є ще одним завершеним записом.'] },
      { id: 'logs', title: 'Журнал часу', paragraphs: ['Запис містить автора, тривалість, дату й необов’язковий опис. Сервер перевіряє проєктний доступ. Час, уже зарезервований рахунком, не можна тихо змінити або видалити.'] },
    ],
  },
  {
    id: 'sprints-and-backlog', slug: 'sprints-and-backlog', coverage: ['sprints-backlog'],
    title: 'Спринти й backlog', category: 'work', summary: 'Планування, активний спринт, завершення та повернення задач.',
    keywords: ['спринт', 'backlog', 'планування', 'активний'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/sprints'], minimumRole: 'member', relatedIds: ['kanban-and-bulk-actions', 'analytics-and-billing'],
    sections: [
      { id: 'states', title: 'Стани спринту', paragraphs: ['Спринт організації може бути запланованим, активним або завершеним. Owner/admin створює, запускає й завершує спринти; одночасно активним є один. Задачі можна переміщати у запланований/активний спринт або повертати без sprintId у backlog.'] },
      { id: 'complete', title: 'Завершення', paragraphs: ['Перед завершенням незакриті задачі спрямовуються в інший незавершений спринт або backlog. Завершений спринт не приймає нові задачі. Backlog і список конкретного спринту підтримують той самий масовий вибір, що й інші робочі поверхні.'] },
    ],
  },
  {
    id: 'calendar', slug: 'calendar', coverage: ['calendar'],
    title: 'Календар, повтори й нагадування', category: 'collaboration', summary: 'Події, учасники, відповіді, повтори та доставка нагадувань.',
    keywords: ['календар', 'подія', 'повтор', 'нагадування', 'учасник', 'rsvp'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/calendar'], minimumRole: 'member', relatedIds: ['notifications', 'time-tracking'],
    sections: [
      { id: 'events', title: 'Події', paragraphs: ['Календар показує особисті та доступні організаційні події, дедлайни задач і часові записи. Подія має тип, час, timezone, учасників і рівень видимості. Запрошені учасники відповідають на запрошення; автор може дублювати подію.'] },
      { id: 'recurrence', title: 'Повтори й нагадування', paragraphs: ['Повтор описує серію, а зміни серії та окремого occurrence розрізняються. До події можна додати до п’яти нагадувань. Захищений cron materialise/dispatch створює та доставляє їх незалежно від відкритого браузера.'] },
    ],
  },
  {
    id: 'chat-and-mentions', slug: 'chat-and-mentions', coverage: ['chat-mentions'],
    title: 'Чат і згадки', category: 'collaboration', summary: 'Канали, приватні кімнати, @люди, #задачі, файли й непрочитане.',
    keywords: ['чат', 'канал', 'приватний', 'згадка', 'непрочитане', 'вкладення'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/chat'], minimumRole: 'member', relatedIds: ['attachments', 'notifications'],
    sections: [
      { id: 'rooms', title: 'Канали й приватні кімнати', paragraphs: ['Організаційні канали доступні їхній аудиторії; приватна кімната обмежена явними учасниками. Read state зберігає непрочитане окремо для кожного користувача.'] },
      { id: 'mentions', title: 'Згадки', paragraphs: ['@ відкриває пошук людей, # після двох символів — авторизований пошук задач. Вибрана задача рендериться як preview і відкривається за стабільним маршрутом. Згадка людини створює окремий unread count і може надіслати сповіщення.'] },
      { id: 'files', title: 'Вкладення', paragraphs: ['Вкладення повідомлення мають приватний шлях доступу; файл не стає публічним через копіювання посилання. Виглядають і поводяться вони точно так само, як вкладення задачі: зображення й відео показують себе, голосове повідомлення грає прямо в повідомленні, решта отримує гліф своєї родини — див. «Описи, чеклісти й вкладення».'] },
    ],
  },
  {
    id: 'search-and-shortcuts', slug: 'search-and-shortcuts', coverage: ['search-shortcuts'],
    title: 'Пошук і клавіатурні команди', category: 'collaboration', summary: 'Глобальний пошук, command palette та фактичний каталог shortcuts.',
    keywords: ['пошук', 'command palette', 'shortcut', 'гарячі клавіші', 'cmd k'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/my'], minimumRole: 'member', relatedIds: ['chat-and-mentions', 'profiles-and-activity'],
    sections: [
      { id: 'search', title: 'Що шукається', paragraphs: ['Workspace search ранжує точний ключ задачі вище назви й опису та повертає лише ресурси доступних організації й проєктів. Command palette поєднує навігацію, дії, проєкти, задачі, людей і події.'] },
      { id: 'shortcuts', title: 'Комбінації клавіш', paragraphs: ['Список нижче походить із того самого реєстру, що й діалог «Гарячі клавіші». Друкований символ ? не перехоплюється глобально.'], bullets: shortcutNames },
    ],
  },
  {
    id: 'profiles-and-activity', slug: 'profiles-and-activity', coverage: ['profiles-activity'],
    title: 'Профілі й онлайн-статус', category: 'collaboration', summary: 'Команда, профіль учасника, presence та audit-події.',
    keywords: ['профіль', 'команда', 'presence', 'остання активність', 'audit'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/team', '/settings'], minimumRole: 'member', relatedIds: ['organizations-and-roles', 'notifications'],
    sections: [
      { id: 'profile', title: 'Профіль', paragraphs: ['Профіль містить ім’я, фото, контактні поля й робочі дані, дозволені організацією. У списку команди біля аватара показується лише індикатор онлайн — текст останньої активності список не перевантажує. Сторінка команди відкриває профіль у межах активної організації; приватний користувацький документ не є загальним каталогом.'] },
      { id: 'activity', title: 'Активність задач', paragraphs: ['Зміни задач зберігають lastActivity і audit для значущих дій; серверні bulk-зміни записують актора так само. Це історія робочих дій, а не точний трекінг перебування людини.'] },
    ],
  },
  {
    id: 'analytics-and-billing', slug: 'analytics-and-billing', coverage: ['analytics-billing'],
    title: 'Аналітика й рахунки', category: 'insights', summary: 'Метрики за категоріями, час, ставки та незмінність рахунків.',
    keywords: ['аналітика', 'рахунок', 'invoice', 'velocity', 'workload', 'ставка'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/analytics', '/[projectId]?tab=analytics'], minimumRole: 'member', relatedIds: ['time-tracking', 'statuses-and-categories'],
    sections: [
      { id: 'analytics', title: 'Метрики', paragraphs: ['Аналітика рахує статусний зміст через категорії: done означає доставлену роботу, done/cancelled — закриту. Workload, velocity, прострочення й оцінки поважають проєктний scope і вибрані фільтри. Завантажений набір не обрізається кнопкою «довантажити» або прихованим лімітом рядків.'] },
      { id: 'reading-charts', title: 'Як читати графіки', paragraphs: ['Один колір означає одне й те саме на всіх екранах аналітики: синій — це сам показник, сірий — контекст, з яким його порівнюють (наприклад, «відкрито» поруч із «закрито»). Статус, тип і пріоритет малюються власним кольором із налаштувань робочого простору. Червоний, бурштиновий і зелений залишені за станом — прострочення, межа бюджету — і завжди йдуть разом зі словами та значком, не самим кольором. Смуга масштабується до найбільшого значення в списку; там, де це частки одного цілого (наприклад, куди пішов час), — до їхньої суми. Пунктир на графіку означає розрахунок, а не вимір: це рівний темп, з яким порівнюють фактичний.'] },
      { id: 'attention', title: 'Що потребує уваги', paragraphs: ['Блок збирає все, що варто переглянути, від найважливішого: заблоковані залежностями, прострочені, критичний пріоритет, без виконавця, без оцінки. Робочий простір, у якому немає жодного з цих пунктів, каже це одним рядком.'] },
      { id: 'billing', title: 'Рахунки', paragraphs: ['Фінанси доступні owner. Створення рахунку транзакційно резервує точні часові записи й оцінки; після цього джерела не можна змінити так, щоб рахунок перестав відповідати зафіксованому складу.'] },
    ],
  },
  {
    id: 'notifications', slug: 'notifications', coverage: ['notifications'],
    title: 'Сповіщення', category: 'collaboration', summary: 'In-app, email і Telegram як незалежні канали доставки.',
    keywords: ['сповіщення', 'email', 'telegram', 'дзвіночок', 'deadline'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=notifications'], minimumRole: 'member', relatedIds: ['calendar', 'integrations'],
    sections: [
      { id: 'channels', title: 'Три незалежні канали', paragraphs: ['In-app, email і Telegram мають окремі налаштування. Вимкнення події в дзвіночку не вимикає автоматично зовнішні канали. Власна дія не надсилається автору, крім явного тестового сповіщення.'] },
      { id: 'delivery', title: 'Доставка й повтори', paragraphs: ['Scheduled outbox дедуплікує отримувачів, відстежує результат кожного каналу та повторює лише невдалий канал. Telegram треба спершу прив’язати через одноразове посилання в налаштуваннях.'] },
    ],
  },
  {
    id: 'integrations', slug: 'integrations', coverage: ['integrations'],
    title: 'QuickTeam+, Telegram і BuggyBag', category: 'insights', summary: 'Доступні інтеграції та чітко відокремлені майбутні провайдери.',
    keywords: ['quickteam+', 'telegram', 'buggybag', 'інтеграція'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=integrations'], minimumRole: 'member', relatedIds: ['notifications', 'youtrack-import'],
    sections: [
      { id: 'available', title: 'Доступно', paragraphs: ['QuickTeam+ використовує окремий Firebase app і sealed server-side grant для клієнтського порталу. Telegram приймає задачі з підключеної групи та доставляє сповіщення після особистої прив’язки. BuggyBag завантажується як віджет зворотного зв’язку.'], bullets: availableIntegrations },
      { id: 'planned', title: 'У планах', paragraphs: ['Наведені провайдери мають лише інформаційний стан і не імпортують дані.'], bullets: plannedIntegrations },
    ],
  },
  {
    id: 'youtrack-import', slug: 'youtrack-import', coverage: ['youtrack-import'],
    title: 'Імпорт із YouTrack', category: 'insights', summary: 'Підключення, preview, відповідність статусів і безпечне повторення.',
    keywords: ['youtrack', 'імпорт', 'міграція', 'token', 'mapping'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=migrations'], minimumRole: 'admin', relatedIds: ['integrations', 'statuses-and-categories'],
    sections: [
      { id: 'flow', title: 'Підтримуваний імпорт', paragraphs: ['Owner/admin додає URL і токен YouTrack у серверне налаштування, перевіряє доступний проєкт і preview, зіставляє статуси та запускає імпорт. Токен не повертається в браузер у відкритому вигляді. Повторний запуск використовує зовнішню ідентичність, щоб не створювати тихі дублікати.'] },
      { id: 'limits', title: 'Інші джерела', paragraphs: [`${plannedIntegrations.join(', ')}. Для них немає робочого імпорту, кнопка запуску або API не надаються.`] },
    ],
  },
  {
    id: 'security-and-access', slug: 'security-and-access', coverage: ['security-access'],
    title: 'Безпека, доступ і видалення даних', category: 'trust', summary: 'Авторизація, Firestore rules, приватні файли та recoverable deletion.',
    keywords: ['безпека', 'доступ', 'firestore rules', 'видалення', 'кошик', 'приватність'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/settings?section=security', '/privacy'], minimumRole: 'member', relatedIds: ['organizations-and-roles', 'support'],
    sections: [
      { id: 'boundaries', title: 'Межі доступу', paragraphs: ['Firebase ID token або server session автентифікує API. Кожен привілейований маршрут повторно перевіряє org membership і project scope; прихована кнопка в клієнті не є захистом. Firestore rules лишаються остаточною межею для браузерних читань і дозволених записів.'] },
      { id: 'files', title: 'Файли й секрети', paragraphs: ['Секрети Admin SDK, Cloudinary, email, Telegram і QuickTeam+ існують лише на сервері. Підписані upload/download шляхи зв’язують файл з організацією та ресурсом.'] },
      { id: 'deletion', title: 'Видалення', paragraphs: ['Задача видаляється у recoverable server trash з перевіркою підзавдань і забілінгованого часу. Видалення організації вимкнене. Щодо видалення облікового запису або персональних даних зверніться до підтримки OneB.'] },
    ],
  },
  {
    id: 'support', slug: 'support', coverage: ['support-troubleshooting'],
    title: 'Підтримка й діагностика', category: 'trust', summary: 'Перевірені канали OneB і дії перед зверненням.',
    keywords: ['підтримка', 'помилка', 'telegram oneb', 'viber oneb', 'email'], updatedAt: UPDATED_AT,
    relatedRoutes: ['/help', '/settings'], minimumRole: 'member', relatedIds: ['security-and-access', 'notifications'],
    sections: [
      { id: 'before', title: 'Перед зверненням', paragraphs: ['Перевірте активну організацію й проєкт, скиньте фільтри, дочекайтеся завершення поточного запиту та повторіть дію. Для Telegram перевірте особисту прив’язку й перемикач потрібної події. Якщо операція завершилася частково, додайте до звернення показані причини та ключі задач.'] },
      { id: 'contact', title: 'Що додати до звернення', paragraphs: ['Надішліть URL сторінки, час і timezone, кроки відтворення, очікуваний та фактичний результат. Не надсилайте паролі, Firebase service-account keys, API tokens або одноразові коди. Перевірені Telegram, Viber та email доступні в меню «Допомога».'] },
    ],
  },
]);

export const HELP_ARTICLE_BY_SLUG = new Map(HELP_ARTICLES.map(article => [article.slug, article]));
export const HELP_ARTICLE_BY_ID = new Map(HELP_ARTICLES.map(article => [article.id, article]));

export function articleSearchText(article) {
  return [
    article.title,
    article.summary,
    ...(article.keywords || []),
    ...(article.sections || []).flatMap(section => [section.title, ...(section.paragraphs || []), ...(section.bullets || [])]),
  ].join(' ').toLocaleLowerCase('uk-UA');
}

export function searchHelpArticles(query) {
  const words = String(query || '').trim().toLocaleLowerCase('uk-UA').split(/\s+/).filter(Boolean);
  if (!words.length) return HELP_ARTICLES;
  return HELP_ARTICLES.filter(article => {
    const text = articleSearchText(article);
    return words.every(word => text.includes(word));
  });
}
