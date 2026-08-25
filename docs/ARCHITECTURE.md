# How QuickTeam works

Four subsystems that a change is likely to touch, in one file so that finding
the rule costs one search rather than a guess at a filename. Setup, commands and
the data model are in [../README.md](../README.md); the rules a change must obey
are in [../AGENTS.md](../AGENTS.md); shared UI has its own contract in
[UI_KIT_CONTRACT.md](UI_KIT_CONTRACT.md).

- [Tasks, subtasks, links and accounting](#задачі-підзадачі-звязки-та-облік) — the task model, its execution invariants, time and invoices
- [View state: a screen's filters live in its address](#view-state-a-screens-filters-live-in-its-address) — URL state, the table view
- [What is new to whom: one feed, one cursor](#what-is-new-to-whom-one-feed-one-cursor) — read/unread, the task history feed
- [Notification delivery](#notification-delivery) — the two paths and their guarantees

One-time data migrations are runbooks, not architecture: they live in
[MIGRATIONS.md](MIGRATIONS.md).

---

## Задачі, підзадачі, зв’язки та облік

Цей документ фіксує продуктову й технічну модель QuickTeam. Вона є спільною
для дошки, списків, аналітики, обліку часу, рахунків та інтеграцій.

### Ментальна модель

#### Задача

Кожен робочий елемент зберігається в канонічній колекції `issues` і має власний
ключ, статус, виконавців, оцінку, фактичний час та історію.

Тип (`Фіча`, `Задача`, `Баг`) описує характер роботи, але не створює окремий
рівень ієрархії. `Епік` не доступний для нових задач. Наявні епіки тимчасово
показуються як `Епік (legacy)` до перевіреної міграції.

#### Справжня підзадача

Справжня підзадача — це повноцінний `issue` з `parentIssueId`. Вона має власний
ключ, статус, виконавця, оцінку, фактичний час, коментарі й зв’язки.

Підтримується один новий рівень:

```text
Основна задача
└── Підзадача
```

Основна задача — повноцінна задача зі своєю ціллю, виконавцем, статусом і
власним часом. Підзадачі стоять поруч з нею, а не замість неї: в аналітиці
рахуються всі, і поява підзадачі нічого не забирає з підрахунків. Раніше було
навпаки — задача випадала з усіх чисел, щойно в неї з'являлась дитина, через що
графік уже закритого тижня мінявся заднім числом.

Нову підзадачу не можна зробити батьком іншої задачі. Legacy-дерева більшої
глибини залишаються читабельними в аналітиці, але API не дозволяє поглиблювати
їх.

#### Чекліст в описі

Markdown-пункти `- [ ]` — легкий чекліст усередині опису. Вони не мають власних
статусів, виконавців, часу чи аналітики і не блокують завершення задачі.

Старе поле `subtasks[]` не є другим типом підзадачі: воно доступне лише для
читання й може бути явно перенесене в Markdown-чекліст.

### Логічні зв’язки

У даних зберігаються лише три канонічні типи:

- `blocks`: напрямлений зв’язок «джерело блокує ціль»;
- `relates-to`: ненапрямлений зв’язок «пов’язана з»;
- `duplicates`: ненапрямлений зв’язок «дублює».

У UI користувач бачить чотири зрозумілі дії:

- `Блокує` створює `source → target`;
- `Залежить від` створює той самий `blocks`, але з оберненим напрямком;
- `Пов’язана з` створює `relates-to`;
- `Дублює` створює `duplicates`.

Для однієї пари задач існує не більше одного детермінованого документа
`issueLinks`. Напрямок і ID нормалізує сервер; клієнт не пише зв’язки напряму.

### Інваріанти виконання

- Основну задачу не можна завершити, поки відкрита хоча б одна справжня
  підзадача.
- Задачу не можна завершити, поки її блокує незавершена задача.
- Завершену підзадачу можна повторно відкрити лише після повторного відкриття
  завершеної основної задачі.
- Завершений заблокований елемент не дозволяє повторно відкрити його блокер.
- До завершеної основної задачі не можна приєднати відкриту підзадачу.
- До завершеної цілі не можна додати відкритий блокер.
- Зв’язки й ієрархія дозволені лише всередині тієї самої організації та
  проєкту.
- Видалення основної задачі вимагає явної політики для дітей. Поточна безпечна
  політика — підняти дітей на верхній рівень.

Переходи статусів виконує `PATCH /api/issues/:issueId/status`. Він
транзакційно перевіряє workflow, ієрархію, блокери, доступ до проєкту й
перестановку карток. Firestore Rules забороняють клієнту напряму змінювати
`status`, `columnId`, `completedAt` та `order`.

### Аналітика

Кількість, потік, навантаження й списки уваги рахують кожен канонічний
`issues`-документ один раз, включно з основною задачею, що має підзадачі.
Ієрархія не перетворює основну задачу на папку: вона лишається одиницею роботи,
а її прогрес окремо показується як завершені листові нащадки / усі листові
нащадки.

Кожен сирий `timeLogs` документ сумується не більше одного разу. Некоректні
від’ємні, дробові або надмірні значення не впливають на агрегати й не можуть
створюватися новими клієнтськими записами.

#### Один таймер на користувача

Поточний таймер не є станом вкладки. Авторитетний документ
`timerStates/{uid}` має максимум один `active` і максимум один `pending` запис
на обліковий запис. Старт, зупинка й відхилення pending-часу виконуються лише
серверними маршрутами в транзакції; Firestore Rules дозволяють браузеру читати
власний документ, але забороняють усі прямі записи. Тому дві вкладки, два
пристрої або дві організації не можуть мовчки перезаписати один одного.

Кожна сесія таймера зберігає `organizationId`, тип і id джерела, проєкт та
серверний `startedAt`. Зупинка звіряє очікуваний id: повтор того самого запиту
ідемпотентний, а стара вкладка отримує конфлікт. Офлайн-зупинка тимчасово тримає
тільки `{timerId, requestedAt}` під ключем користувача; reconnect відправляє її
на сервер, який обмежує час моментом старту, моментом reconnect і максимум
дванадцятьма годинами.

Збереження pending-часу й створення `timeLogs` — одна транзакція з
детермінованим id за timer session. Повтор запиту повертає вже створений лог і
не додає хвилини до денного підсумку вдруге. Logout/account switch очищає лише
екранний стан; серверний таймер нового акаунта завантажується окремим слухачем.

`taskMinutes` і `eventMinutes` — дві частини одного факту: реально
зафіксованого часу. Заплановані `startAt` / `endAt` події не підміняють лог і не
додаються до діаграми часу.

Новий time-log зберігає `sourceTitle`, а task-log також `sourceKey`. На живому
джерелі інтерфейс показує актуальну назву, snapshot є лише запасним підписом на
час між видаленням джерела й фінальним purge або для незмінного облікового
сліду. Запис часу не повинен ставати безіменним через порядок фонової чистки.

Період закриття й цикл використовують тільки явний достовірний `completedAt`.
`updatedAt` не є запасною датою завершення: редагування закритої задачі не
закриває її повторно. Legacy-задачі YouTrack без маркера `importedAt` також не
потрапляють у ці метрики, бо старий імпортер міг записати час міграції замість
дати завершення у джерелі. Вони залишаються в історії та загальній кількості,
але не створюють фальшивий сплеск у конкретному періоді.

#### Вікно, а не історія

Задачі — скінченна множина: один документ на одну одиницю роботи. Записи часу —
ні. Один пишеться щоразу, коли хтось зупиняє таймер, кожною людиною, щодня, і
жоден не видаляється. Екран показував «за 30 днів», а читав усе від першого дня
проєкту й відкидав зайве вже в браузері — тобто вартість відкриття росла з
віком робочого простору, а не з розміром періоду.

Тому період — це межа запиту, а не фільтр після нього.
`useWorkspaceAnalytics` не читає жодного логу без явного `timeLogWindow`:
викликач називає проміжок, який збирається малювати, і цей проміжок стає
`where('loggedAt', …)`. Вікна рахує один модуль
`src/lib/utils/analyticsWindow.mjs`, і той самий модуль дає компонентам їхній
власний предикат, щоб межа запиту й межа малювання не розійшлися у дві різні
відповіді:

- «Огляд» і «Команда» — `periodTimeLogWindow`: обраний період,
  вирівняний до локальної півночі. Вирівнювання навмисне: «Огляд» перечитує
  годинник щохвилини, і межа, що рухається разом із ним, перебудовувала б запит
  шістдесят разів на годину;
- «Табель» — `timesheetTimeLogWindow`: рівно той тиждень або місяць, який
  показано. Гортання назад **пересуває** вікно, а не розширює його;
- сторінка учасника читає період для «Огляду» й «Роботи», але перемикається на
  точний тиждень або місяць, щойно відкрито його «Табель»;
- «Рахунок» читає сирі логи свого проєкту власним хуком
  (`useProjectAllTimeLogs`): рахунок — це кожна невиставлена година, а не
  період, і жодний агрегат його не замінює.

Задачі й логи — два окремі підписники всередині хука, бо живуть за різними
годинниками: набір задач змінюється зі зміною проєктів, вікно логів — коли
людина перемикає період або гортає табель. В одному ефекті зміна періоду
перечитувала б усі задачі організації, щоб відповісти на питання про години.

Запит task-логів має дві нерівності — `issueId != ''` і діапазон по `loggedAt`,
— тож складений індекс містить обидва поля: `(organizationId, projectId,
issueId, loggedAt)`. Порядок не на вибір: Firestore добирає індекс за порядком
полів у наборі фільтрів, а не за тим, який діапазон вибірковіший. Варіант
`(…, loggedAt, issueId)` виглядав кращим планом і просто не є індексом, яким цей
запит можна обслужити — прод відповів `FAILED_PRECONDITION` і назвав правильний
порядок.

#### Денні підсумки

Вікно робить вартість пропорційною періоду, але «за 90 днів» по активній
команді — це все ще тисячі документів заради чотирьох чисел. Денний підсумок
проєкту — один невеликий документ, і девʼяносто днів коштують девʼяносто
читань незалежно від того, скільки роботи в них було.

    analyticsRollups/{organizationId}_{projectId}_{YYYY-MM-DD}

Поля: `taskMinutes`, `eventMinutes`, `cancelledTaskMinutes`, `minutesByUser`,
`cancelledMinutesByUser`, `version`. `projectId` порожній для командного часу
календаря без проєкту — та сама межа, яку вже проводять сирі логи й
`firestore.rules`. День береться в часовому поясі організації: до якого дня
належить запис — це факт про робочий простір, а не про того, хто відкрив звіт.

**Похідне, а не джерело правди.** Кожна цифра виводиться з `timeLogs`, і
`scripts/backfill-analytics-rollups.mjs` перебудовує будь-яку з них із нуля
(runbook — у [MIGRATIONS.md](MIGRATIONS.md)). Агрегат без способу відновлення —
це дані, які баг псує назавжди.

**І не гроші.** Рахунок читає точні `sourceTimeLogIds` кожної позиції і не має
права читати підсумок: хвилини, зведені за день, не можуть сказати, які саме
хвилини вже виставлені.

**Дельти, а не інкременти.** Запис часу можна відредагувати й видалити, тож
кожна зміна — це старий запис назовні й новий усередину. 30 хв, виправлені на
45, зсувають день на +15; інкремент нового значення зробив би з двох правок 75.

**Скасування — окрема цифра.** Задачу скасовують після того, як години вже
пораховані, і скасування оборотне. Тому `taskMinutes` лишається тим, що
записали, а `cancelledTaskMinutes` — тією частиною, що належить скасованим
задачам; читач віднімає одне від одного. Повернення задачі — точна інверсія, а
перебудова рахує обидві цифри незалежно, тож розбіжність між ними видно, а не
ховається всередині одного числа. Архівні задачі не коригуються взагалі.

**Лічильників задач тут немає.** Задачі — скінченна колекція, яку екрани
аналітики й так читають заради дощок, відкритих лічильників і списку уваги.
Рахувати їх із підсумку не дало б нічого, зате поставило б другого письменника
на кожен перехід статусу. Без межі росте саме час — його й зводимо.

**Конкуренція.** Firestore тримає ~1 запис на секунду на документ, але цей
документ ніколи не найзавантаженіший у власній транзакції: кожен task-лог і так
пише `issues/{id}` і `projects/{id}`, кожен календарний — `calendarEvents/{id}`
і `projects/{id}`. Документ проєкту приймає логи всіх днів усіх задач проєкту,
підсумок — логи одного дня. Шардити довелося б спочатку `projects/{id}`.
Арифметика погоджується: пʼятдесят людей по десять записів — це пʼятсот записів
на робочий день, розподілених ще й по проєктах.

**Хто що читає.** «Огляд» і «Команда» — це суми, тож вони читають дні: плитки,
«Куди пішов час», колонка часу в «По проєктах», хвилини кожної людини в
командній таблиці. «Продуктивність» описує потік задач і часу не читає.
Календар завантажується лише там, де потрібні назви подій або рахунок, а не при
кожному відкритті аналітики.

Денний підсумок знає проєкт, дату й того, хто списав годину. Він не знає, проти
якої задачі, тож не може відповісти на «час на задачах, призначених Анні», на
пошук чи на фільтр за пріоритетом і типом — це питання про задачі, а не про дні.
Тому агрегат — швидкий шлях, а записи — точний: щойно вмикається такий фільтр,
той самий період читається з логів, за тими самими днями, бо обидві межі дає
один `periodDayRange`.

«Табель» читає записи завжди — це сітка «хто що списав проти якої задачі», а не
сума. «Рахунок» читає сирі логи свого проєкту. Сторінка окремої людини теж читає
записи: вона малює її табель.

Помилка одного обовʼязкового читання зупиняє весь звіт і показує повторну
спробу. Частково прочитані колекції не публікуються як правдивий нуль: нуль —
це результат успішного запиту, а не запасне значення для збою мережі чи
відсутнього індексу.

«За 30 днів» тепер означає тридцять цілих днів у поясі організації, включно з
сьогоднішнім, а не «останні 720 годин». Так підсумок і записи говорять про той
самий проміжок — і так підпис під плиткою нарешті збігається з тим, що
порахували.

Точки запису: `applyTaskTimeLogMutation` (створення, зміна, видалення
task-логу), маршрут календарного часу, маршрут скасування задачі, чистка
tombstone у `issueTrash.js`, каскад видалення проєкту та YouTrack-імпортер.
`tests/analytics-rollups.test.mjs` перевіряє, що жоден із них не змінює хвилини
без підсумку.

### Облік часу задач

- Створення, зміна й видалення task-логів проходять лише через автентифіковані
  серверні API.
- Лог, `issues.spentMinutes` і версія бухгалтерського стану проєкту
  змінюються в одній транзакції.
- Учасник може змінювати лише власні логи; owner/admin — логи учасників свого
  проєкту.
- Лог, який уже потрапив у рахунок, незмінний.
- Legacy-задача з історією логів без підтвердженої версії дзеркала fail-closed
  до явної звірки.

### Рахунки

- Оцінка ніколи не стає грошима: рахунок рахується лише з фактичних логів, а
  робота без зафіксованого часу отримує суму вручну. Джерело `estimate`
  лишилося тільки на вже виставлених рахунках.
- Ієрархія задач на рахунок не впливає: основна задача виставляється за своїм
  фактичним часом так само, як будь-яка інша.
- Фактична позиція рахунку зберігає точні `sourceTimeLogIds`.
- Хвилини позиції на сервері мають точно дорівнювати сумі сирих джерел.
- Після створення рахунку кожне джерело отримує `invoiceId` і `billedAt` та
  стає незмінним.
- Детерміновані reservation-документи і транзакція не дозволяють двом
  паралельним рахункам використати одне джерело.
- Номер рахунку генерує серверна послідовність організації на календарний рік,
  тому два проєкти однієї організації не можуть отримати однаковий номер.
- Новий невиставлений лог тієї самої задачі можна включити в наступний рахунок;
  вже виставлені логи не потрапляють у нову позицію.
- Позиція без фактичних логів резервує сам `itemId`, щоб ту саму роботу не
  виставили двічі.
- Старі рахунки без `itemId` і `sourceTimeLogIds` консервативно блокують задачі
  з тим самим стабільним ключем. Такі збіги потребують ручної звірки, бо
  автоматично вгадати історичні джерела безпечно неможливо.
- Чернетку можна анулювати. Рахунок залишається в історії зі статусом `void`,
  а його точні маркери й reservation-документи звільняються в одній транзакції.

Видалення задачі з виставленими логами блокується, щоб не знищити аудиторський
ланцюжок рахунку.

### Час календарних подій

- Подія без проєкту може мати org-scoped час для командної аналітики, але такий
  час не є позицією рахунку.
- Час події з проєктом належить точному occurrence і може потрапити лише в
  рахунок цього проєкту.
- `eventId`, `occurrenceStartAt` і `projectId` разом утворюють ідентичність
  джерела; їх не можна непомітно змінювати після появи логів.
- Спільний трекінг доступний лише для подій із видимістю `team`. Події
  `participants` і `private` не створюють нових спільних таймлогів, щоб їхній
  опис не витікав у командні аналітичні запити.
- Повторення рахуються в UTC з календарною арифметикою. Точний occurrence
  залишається валідним навіть для щомісячної серії, створеної багато років тому.

### Локалізація системних довідників

Стабільні технічні id залишаються незмінними й англомовними — наприклад,
`backlog`, `in-progress`, `feature`, `meeting`. Користувач бачить українські
назви з усталеним продуктовим сленгом:

- статуси: `Беклог`, `До виконання`, `У роботі`, `Готово`;
- типи: `Фіча`, `Задача`, `Баг`;
- пріоритети: `Блокер`, `Високий`, `Середній`, `Низький`;
- мітки: `Баг`, `Фронтенд`, `Дизайн`;
- посади: `Розробник`, `Дизайнер`, `PM`, `QA`;
- системні типи календаря: `Мітинг`, `Подія`, `Фокус-час`, `Відсутність`,
  `Реліз / етап`, `Нотатка`.

Англійські назви відомих legacy-defaults локалізуються лише за точним
стабільним id. Власні назви організації не перекладаються й не перезаписуються.
Типи календаря є фіксованою семантикою для поведінки та аналітики, але їхні
людські назви локалізовані.

### Серверні точки запису

- `POST /api/issues` — створення задачі або підзадачі;
- `PATCH /api/issues/:id/parent` — зміна основної задачі;
- `PATCH /api/issues/:id/status` — статус і атомарна перестановка;
- `GET|POST|DELETE /api/issues/:id/links` — канонічні логічні зв’язки;
- `POST /api/issues/:id/legacy-checklist` — явне перенесення старого чекліста;
- `POST /api/issues/:id/time-logs` — списання часу на задачу;
- `PATCH|DELETE /api/issues/:id/time-logs/:logId` — зміна або видалення
  невиставленого task-логу;
- `DELETE /api/issues/:id` — ієрархічне видалення;
- `POST|PATCH|DELETE /api/calendar/events/:id/time-logs` — час точного
  occurrence командної події;
- `POST /api/invoices` — перевірений рахунок і резервування джерел;
- `POST /api/invoices/:id/void` — атомарне анулювання чернетки.

### Міграція legacy-даних

Операційні інструкції для ієрархії v2, звірки дзеркала task-часу та
класифікації календарного часу — у [MIGRATIONS.md](MIGRATIONS.md).

---

## View state: a screen's filters live in its address

Filters used to be `useState` mirrored into `localStorage` per device. Three
ordinary things were therefore impossible: a board could not be sent to anyone,
"my daily board" could not exist on two machines, and the browser's Back button
did not undo a filter because nothing had navigated.

The address is now the single source of truth for what a screen is showing.
There is no `useState` copy of a filter anywhere — two sources can disagree, and
one of them is the one you paste into a message.

### The pieces

- `src/lib/utils/viewState.mjs` — pure serialisation and the schemas. No React.
  Covered by `tests/view-state.test.mjs`.
- `src/lib/hooks/useViewState.js` — binds a schema to `useSearchParams` and
  `router.replace`, and remembers the last visit.

```js
const [state, setState] = useViewState(BOARD_VIEW_SCHEMA, {
  storageKey: `qt:view:board:${projectId}`,
  ready: resourceContextReady,
});

setState({ priority: 'high' });   // a patch, never a whole state
```

### The schema

```js
{ key: { default, values?, type?: 'list' } }
```

- `values` declares the closed set a key accepts. Anything else falls back to
  the default: an address outlives what it points at, and a renamed view mode or
  a hand-edited link must still open the screen.
- `type: 'list'` serialises as `a,b,c`. Its default is `[]`.

Shipped schemas: `BOARD_VIEW_SCHEMA`, `MY_TASKS_VIEW_SCHEMA`,
`SPRINTS_VIEW_SCHEMA`. Аналітика має окрему перевірену серіалізацію в
`analyticsUrlState.mjs`: вкладка, проєкти, виконавець, пріоритет, тип, період,
пошук і точний тиждень або місяць табеля переживають перезавантаження та
передаються посиланням. Сторінка учасника успадковує проєкти й період командної
аналітики.

### The four rules

1. **A value equal to its default is absent from the address.** An untouched
   board stays `/PROJ`, not `/PROJ?sprint=all&assignee=all&priority=all`.
2. **A key the schema does not declare is never read and never written.** `org`
   (the organization guard), `new` and `assignee` (the task composer) and
   `member` (the profile overlay) survive a filter change untouched. This is why
   `MY_TASKS_VIEW_SCHEMA` deliberately has no `assignee` key: that address
   already carries `assignee` to pre-fill the composer, and one parameter cannot
   mean two things on one screen.
3. **An address that already says something about the screen is never
   overruled.** That is what makes a shared link show the sender's board rather
   than the reader's habits. Only a bare address restores the previous visit,
   and it restores it *into the address*, so a bookmark always captures what you
   are actually looking at. The whole rule is `restoredViewQuery`, and it is
   tested there rather than inside the hook.
4. **A filter change is `replace`, not `push`.** Clicking through four selects
   must not need four presses of Back to leave the screen; each press undoes one
   filter because `replace` still writes the address the next entry is diffed
   against.

### Deliberate omissions

- **Search is not in the address.** `projectSearch`, `myTaskSearch` and
  `sprintSearch` live in the workspace store and are driven by the header, which
  is shared chrome. Binding a store to the address in both directions is a
  second source of truth, which is the thing this change exists to remove.
- **The old per-filter `localStorage` keys are not migrated.** `qt_board_sprint_*`,
  `qt_board_assignee_*`, `qt_board_priority_*`, `qt_board_type_*` and
  `qt_project_view_*` are no longer read or written. Filters reset once, and the
  alternative was carrying a migration shim indefinitely.
- **`/calendar` is not converted.** Він має окрему лексику дати й режиму
  календаря. `/analytics` уже зберігає власні періоди, вкладки й date anchor у
  своїй адресі.

### The table view

The board's `view` key was the extension point for further readings of the same
tasks, and the table is the first one to use it: `view=table` sits beside
`kanban` and `list`, with four keys of its own.

| key | default | what it says |
| --- | --- | --- |
| `group` | `status` | What a band is: `none`, `status`, `assignee`, `priority`, `type`, `sprint` |
| `sort` | `manual` | Which column orders the rows; `manual` is the board's own order |
| `dir` | `asc` | Direction of that sort |
| `cols` | *(empty)* | Which columns are on; empty means the default six |

Their accepted values come from `src/lib/utils/taskTable.mjs` rather than being
typed into the schema, so adding a column adds a sortable value to the address
in the same change. `taskTable.mjs` also owns the sorting comparators and the
grouping, and is covered by `tests/task-table.test.mjs`; the component in
`src/components/ui/TaskManagement/TaskTableView.jsx` renders what those
functions return and holds none of it.

Four consequences worth stating:

- **The keys stay declared while the kanban is showing.** They belong to the
  screen, not to one of its modes, so switching to the board and back does not
  throw away the columns you chose.
- **`cols` is empty for the default set, not a list of six.** Rule 1 again: an
  untouched table is `?view=table` and nothing else.
- **Column order is not in the address.** `cols` is a set; the table always
  draws the canonical order. What you send somebody is which columns, not a
  layout.
- **The table adds no reads.** It arranges the tasks the board already loaded.
  Sorting and grouping are pure functions over that array, and an edited cell
  goes back through `updateIssue` — the same path a drag on the board takes.

### Extending it

Add a key to a schema; there is nothing else to register.

---

## What is new to whom: one feed, one cursor

A task tells its reader two kinds of news — somebody said something, and somebody
changed something. The product used to treat them as unrelated: messages had a
boundary and a count, changes had a feed entry nobody marked, and the dot on a
card stood for both without saying which.

There is no second data model for this. Everything below rides on what already
existed: the `issues/{id}/audit` subcollection, the per-user cursor in
`organizations/{orgId}/issueReadState/{uid}_{issueId}`, and `lastActivityAt` on
the task document. No new field, no new query, and nothing extra read per row of
a list.

### The pieces

- `src/lib/utils/issueAuditEvents.mjs` — which field changes are worth logging
  (`AUDITED_ISSUE_FIELDS`) and how one reads out (`describeAuditEvent`). Pure, no
  React. Covered by `tests/issue-audit-events.test.mjs`.
- `src/lib/utils/issueReadState.mjs` — the cursor rules: `isIssueUnread` for a
  card, `isIssueChangeUnread` for one line of history, `unreadActivityLabel` for
  what the dot is about. Covered by `tests/issue-read-state.test.mjs`.
- `src/lib/services/issueReadState.js` — the writes: consume on leaving
  (`scheduleIssueSeen` / `cancelScheduledIssueSeen`) and `markIssueUnread`.
- `src/components/IssueReadStateBridge.jsx` — one organization-wide cursor
  listener at the workspace boundary. Unchanged, and the reason a board of five
  hundred cards costs no reads for any of this.

### The rules

1. **The list of audited fields lives next to the phrases that read it.** They
   were in different files and drifted: three fields were logged while the
   timeline knew how to say five, so a moved deadline left no trace anywhere in
   the product. Adding a field to `AUDITED_ISSUE_FIELDS` and giving it a label in
   the same module is the whole change.
2. **Nothing names a status, priority, type, label or sprint from a table of its
   own.** `describeAuditEvent` is handed the live workflow, and statuses resolve
   through `statusLabel`. A hard-coded map of seven status ids is what made a
   project that renamed «QA» read somebody else's word for it, and a project that
   added a status read a raw id.
3. **One boundary for the whole feed.** Messages and changes are two kinds of the
   same question — «що тут сталося без мене» — so `UnreadDivider` counts both.
4. **The two halves are consumed differently, on purpose.** A message is read
   when the boundary has been on screen for half a second (`readBy` per comment).
   A change is read when the reader *leaves the task*. Rendering the detail used
   to advance the cursor, which broke the one case the boundary exists for: open
   a task, get called away, come back to a task that already counts as read.
5. **Leaving is not the same as unmounting.** Opening a task through a
   non-canonical link replaces the address a beat later and remounts the detail,
   so the consume is scheduled with a short delay and a fresh mount of the same
   task cancels it. A browser killed with a task open leaves it unread — the
   forgiving direction of the two.
6. **Your own activity is never new to you.** The dot, the boundary and the count
   all drop the current user's own entries. It is also why «Позначити
   непрочитаним» is offered only when somebody else acted last: marking your own
   change unread would light nothing.
7. **Marking unread never resets a cursor that already sits further back.** The
   cursor moves to just before the newest activity, so the dot returns and the
   boundary lands on the change that made you want to come back — while older
   changes you never saw stay unseen.
8. **The comparison is server clock against server clock.** `audit.createdAt` is
   written by Firestore, and the cursor it is measured against was copied from the
   task's own `lastActivityAt`. That is why the boundary needs no cursor of its
   own and no per-entry timestamp written by a client.

### Deliberate omissions

- **Time logs do not move the boundary.** Logging time deliberately does not
  touch `lastActivityAt` (see the comment in `issueReadState.mjs`), so counting it
  here would draw a line for something no card ever announced.
- **Comments are not audit entries.** A message is its own thing in the feed with
  its own read receipts; mirroring it into the history would be a second copy of
  the same fact.
- **Creating a task is not a change to it.** A new task is new in full; it has no
  fields that changed.
- **Marking a selection read is not implemented.** `ISSUE_BULK_ACTIONS` is a
  server-validated registry of writes to task documents, and a read cursor is a
  document of the user's own in another collection. It would be a client-only
  action wearing a server action's clothes, and it is a separate change.

### Extending it

Add the field to `AUDITED_ISSUE_FIELDS`, give it a label (and a value formatter
if it is not a plain string) in the same module, and write it from wherever that
field is saved. Server routes that already write `lastActivity*` also write their
own audit entry in the same transaction — `api/issues/[issueId]/status` is the
example to copy.

---

## Notification delivery

QuickTeam has two notification paths. They share channel preferences, but their
triggers and reliability guarantees are different.

### Event-driven notifications

Assignments, comments, mentions and chat messages originate in an authenticated
server request. That request writes the in-app notification and immediately
attempts the enabled external channels. No scheduler is involved.

This path is intentionally low-latency, but it does not yet have a durable retry
queue for a provider failure. Adding the immediate events to the same outbox is
remaining reliability work.

Лічильник на екрані вибору організації не походить із активного live-вікна і не
покладається на Zustand/localStorage. `GET /api/notifications/unread-counts`
бере uid з перевіреного токена, організації — з `orgMemberships`, а кількість —
через серверні `count()` aggregation queries. Від загального unread віднімаються
лише документи з явним `inapp: false`; legacy-документи без поля лишаються
in-app. Незавершені запити дедуплікуються окремо для кожного uid, тому зміна
акаунта не може опублікувати чужий результат.

### Time-driven notifications

Calendar reminders and deadline notifications use
`scheduledNotifications/{id}`. Each row has its own delivery time, status,
attempt count, per-channel success timestamps and last error. Deterministic row
IDs make repeated materialisation and dispatch idempotent.

The worker is split into two modes:

- `materialise` runs the more expensive half. Every twenty minutes it performs
  bounded reads of upcoming calendar events and issues, fills the outbox three
  hours ahead, corrects moved reminders and cancels pending rows whose source is
  no longer valid.
- `dispatch` runs the cheap half. It reads at most 50 pending rows whose
  `nextAttemptAtMs` is due, sends them and records `sent`, `failed` or a backed-
  off retry. An idle pass is one bounded indexed query.
- `full` runs both halves; materialisation remains internally throttled.

Email and Telegram outcomes are tracked separately. If email succeeds and
Telegram fails, only Telegram is retried; a successful channel is not sent a
second time. Telegram failures are recorded per recipient, so one successful
digest cannot hide another recipient's blocked bot.

The dispatch and materialisation watermarks are also separate. A frequent
dispatch pass therefore cannot shorten the recovery window after the
materialiser was unavailable.

Materialisation is still a bounded periodic derivation, not yet a write-time
derivation. The final architecture is to rewrite affected outbox rows in every
server path that creates, moves or completes an event/deadline. Until that
invariant is implemented and tested, the twenty-minute materialiser is required.

### Trigger during hosted testing

`GET /api/cron/notifications` validates `Authorization: Bearer $CRON_SECRET` and
accepts `?mode=full|dispatch|materialise`.

The free external scheduler is an accepted temporary dependency while QuickTeam
is hosted on test infrastructure. Configure either:

- `?mode=full` every minute (the server self-throttles the expensive work); or
- `?mode=dispatch` every minute and `?mode=materialise` every twenty minutes.

Keep `.github/workflows/scheduled-notifications.yml` only as a fallback. GitHub
scheduled workflows are not punctual enough to be the primary production
trigger. `CRON_SECRET` must be identical in the deployed environment and in
every scheduler that calls the route.

### Trigger after moving to the own server

Run the same worker from a long-lived Node process under the service manager:
call `runScheduledNotificationSweep({ mode: 'full' })` every 30–60 seconds. The
outbox, idempotency and retry logic do not change; only the HTTP scheduler is
removed. For more than one application instance, ensure only one scheduler is
leader or let all instances call the idempotent endpoint with a distributed
claim before outbound delivery.

### Remaining operational visibility

- Show `system/notificationSweep` health and last successful materialisation in
  Settings.
- Show the last successful email/Telegram delivery and terminal channel errors.
- Mark a Telegram connection as needing attention after a permanent recipient
  error.
- Move event-driven external delivery onto a durable retry path.

## Вартість читання

Продакшн живе на жорсткому денному ліміті читань Firestore. Обидва падіння
сервісу сталися не від навантаження, а від трьох рядків коду кожне — і жоден із
них не виглядав дорогим у місці виклику. Тому вартість читання тут описана як
частина архітектури, а не як порада.

### Три способи витратити квоту, які вже траплялись

**Питати сервер там, де відповідь уже була.** Капсула `#QT-12` дізнавалась назву
задачі через `/api/search`. Пошук не може знати, які документи містять слово, —
він читає всі задачі, всі проєкти, всі членства й усі події організації та
ранжує їх у памʼяті. Один раз на питання людини це нормально; на кожну капсулу —
це тисячі читань, щоб намалювати вісім слів. Тепер назва **записується в саме
повідомлення** тим композером, який її вже показав автору (`issueMentions`), а
історичні повідомлення розвʼязуються одним пакетним запитом за точним ключем
(`/api/issues/lookup`). Пошук лишається пошуком: нічого, що малюється на кожен
елемент, не має права його викликати — це перевіряє
`tests/firestore-read-cost.test.mjs`.

**Читати колекцію, щоб порахувати її.** Журнал змін задачі читався повністю,
сортувався в браузері й обрізався до пʼятдесяти рядків — чотириста документів
заради пʼятдесяти. Сортування й обмеження — робота бази: `orderBy` + `limit` у
запиті. Те саме стосується лічильників: непрочитане в каналі рахується з
`messageCount` каналу і курсора читача, а не з самих повідомлень.

**Підписуватись двічі на те саме.** Бічна панель і міст сповіщень кожен окремо
слухали список каналів організації, а картка проєкту на головній тримала пару
слухачів на кожну картку — над каналом `project_*`, у який продукт давно не
пише. Правило «один публікує, багато читають» уже описане у сторі для
`unreadChatCount` та `issueReadState`; воно поширюється на все, що потрібно
більш ніж одному екрану.

### Правила

- Живий слухач над колекцією або має `limit()`, або внесений у
  `BOUNDED_WITHOUT_LIMIT` у `tests/firestore-read-cost.test.mjs` з причиною, чому
  він не може рости. Тест падає на новому необмеженому слухачі.
- Історія, що росте вічно (повідомлення, коментарі, журнал змін, списаний час),
  відкривається вікном найновішого і розширюється на вимогу — спільний елемент
  `LoadOlderButton`.
- Звітний екран читає рівно той період, який показує. Період — це
  `where('loggedAt', …)`, а не `.filter()` після читання всієї колекції; див.
  «Аналітика» → «Вікно, а не історія». `tests/firestore-read-cost.test.mjs`
  падає, якщо в `useWorkspaceAnalytics` зʼявиться запит `timeLogs` без вікна.
- Живий слухач лишається там, де людина діє з даними, поки вони змінюються:
  дошка, задача, чат, планування спринту, архів. Звіт — не з них. Аналітика
  бере один замір (`live: false`), показує `RefreshStamp` — «Оновлено о HH:MM» —
  і кнопку взяти новий. Екран, який перестав оновлюватись і не сказав про це,
  гірший за слухача, якого прибрали.
- Те, що вже відоме під час запису, записується під час запису. Назва згаданої
  задачі, імʼя автора, кількість повідомлень у каналі — це поля, а не запити.
- Дані, потрібні кільком екранам, підписуються один раз на межі робочого
  простору й публікуються у стор.
- Ранжування в памʼяті означає читання всього корпусу. `/api/search` тримає
  прочитане organization-корпус разом із профілями учасників 60 секунд,
  пропускає людей і календар у режимі згадки, і не викликається нічим, що
  малюється на кожен елемент.
- `count()` коштує одне читання на тисячу документів — рахувати треба ним, а не
  читанням документів.

### Сеанси облікового запису

«Налаштування» → «Безпека» показує, з яких пристроїв заходили в обліковий запис.
Це один документ — `users/{uid}/settings/sessions`, мапа за ідентифікатором
пристрою, який браузер тримає у власному сховищі, — а не підколекція: панель
читає одна людина про себе, і мапа коштує одне читання незалежно від кількості
пристроїв. Документ читається лише поки відкрито саме цей розділ.

Пише його сервер (`/api/account/sessions`), бо місце береться із заголовків
хостингу, яких браузер не бачить; клієнт лише позначає пристрій не частіше ніж
раз на дванадцять годин. Мапа обрізається до `MAX_REMEMBERED_SESSIONS` під час
того ж запису, тож документ не росте нескінченно.

Завершення сеансу відкликає refresh-токени всього облікового запису: Firebase
вміє відкликати їх лише цілком, окремого пристрою не існує. Підтвердження це
проговорює, і після нього застосунок виходить із акаунта тут-таки.

### Що лишилось дорогим навмисно

Дашборд підписаний на задачі всіх проєктів, які користувач може відкрити, а
дошка — на задачі свого проєкту. Це і є основний набір даних продукту, і саме з
нього рахуються прогрес проєкту, «активні», «прострочені» та «мої». Постійний
кеш Firestore (`persistentLocalCache`, увімкнений у продакшні) робить повторні
візити дешевими, але перший візит у новому браузері платить повну ціну, і вона
росте разом із віком робочого простору.

Наступний крок, коли це стане проблемою, — денормалізовані лічильники на
документі проєкту (`total`, `delivered`, `overdue`), які підтримують ті самі
серверні маршрути, що вже пишуть задачі. Це замінює читання всіх задач на
читання одного документа проєкту. Робити це варто разом із переходом на платний
тариф або власний сервер, бо воно змінює те, що картка може показувати наживо.

## Звіти про помилки

Тост із помилкою має найтихішу кнопку в застосунку — «Повідомити про помилку».
Вона надсилає те, що людина побачила, те, що сталося насправді, і де це було:
одним натисканням, бо помилка, яку треба описати словами, не буде описана ніколи.

Записує `POST /api/error-reports`: клієнт не може сам вирішувати, ким він є,
обмеження частоти живе на сервері, а колекція лишається закритою для читання з
браузера — жодне правило Firestore її не описує, а Firestore забороняє все, що
не дозволено явно.

Читання — не функція робочого простору, і це головне, що варто розуміти. Звіт
містить екран, шлях і збій конкретної людини, і адресований він тому, хто це
полагодить. Раніше це було записано як «власник організації» — правильна людина
рівно доти, доки організація одна і вона наша: власником простору клієнта є
клієнт, а той, хто лагодить, мусив би обходити всі простори, щоб зібрати свій
список.

Тому:

- звіти лежать в одній кореневій колекції `errorReports`, а робочий простір —
  поле в документі (`organizationId`, `organizationName`). Всередині організації
  вони лежали саме так, як треба, щоб її власник виглядав природним читачем;
- читає їх `/errors` — сторінка поза `(app)`, без організації і без сесії, через
  `POST /api/error-reports/inbox`;
- двері — пароль, записаний однією константою в самому маршруті
  (`src/app/api/error-reports/inbox/route.js`). Змінювати його там і більше
  ніде. Це навмисно не змінна оточення: сторінку відчиняє одна людина, і
  налаштування на рівні деплою не давало нічого, крім зайвого кроку. Пароль
  перевіряється на сервері, порівнюється як дайджест сталої довжини і
  обмежений десятьма спробами на адресу за пʼять хвилин;
- пароль ніде не зберігається на клієнті — ні в cookie, ні в storage. Він живе в
  стані сторінки, поки вкладка на ній, і після перезавантаження його питають
  знову.
