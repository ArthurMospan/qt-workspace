# UI Kit contract

`/ui-kit` — жива бібліотека authenticated workspace QuickTeam. Це не окремий
демо-дизайн: preview рендерять ті самі shared-компоненти та semantic CSS
contracts, що й робочі екрани.

## Межі каталогу

- Сканування починається з `src/app/(app)` і рекурсивно проходить лише reachable
  local imports.
- Login, onboarding та інші непідключені до authenticated workspace екрани не
  визначають повноту каталогу.
- Невикористані legacy-файли під `src/components/ui` не показуються в
  `/ui-kit` і не вважаються частиною живого каталогу.
- Брендування залишається тільки у sidebar та його contrast-dependent
  дочірніх елементах.

## Правила для кожної майбутньої UI-зміни

1. Повторюваний visual pattern живе в `src/components/ui`.
2. Новий shared-компонент у тій самій зміні:
   - експортується з `src/components/ui/index.js`;
   - використовується authenticated workspace;
   - має живий preview у `/ui-kit`.
   Invariant: A new shared component is exported, used by the authenticated
   workspace, and rendered in `/ui-kit` in the same change.
3. Geometry і typography задаються semantic contract у `globals.css`, а не
   анонімним `h-[Npx]`, `text-[Npx]` чи radius override поверх shared API.
4. Контекстна різниця отримує named prop або attribute: `size`, `context`,
   `density`, `preset`, `composition`, `data-ui-*`.
5. `Label` відповідає за typography/required state; відступ до control задає
   `FormGroup` або layout.
6. Форми у side sheet/modal використовують `Dialog`. Media viewers, responsive
   panes і navigation overlays мають окремі чесно названі оболонки.
7. Pills/badges/counters належать semantic family (`Pill`, `Counter`,
   `StatusPill`, `TypeBadge`, `Tag`), але не змішують свою data semantics.
8. Neutral compact actions використовують `IconAction`; спеціальні media,
   editor чи branded actions мають named appearance.
9. Повторювані Card/Surface patterns використовують semantic surface presets.
   Справді одноразовий structural container позначається
   `data-ui-surface="local"` і залишається видимим в audit як reviewed exception.
10. Локальний компонент не може маскуватися назвою іншого UI Kit компонента:
    справжній повтор canonicalize, контекстний компонент отримує точну назву.

## Затверджені fidelity-рішення

1. Єдине джерело geometry та typography — Semantic CSS contract.
2. Form labels — один `Label`, gap задає layout.
3. Side sheets — `Dialog` для форм, viewers окремо.
4. Pills, badges та counters — semantic family.
5. Compact neutral icon actions — shared `IconAction`.
6. Виняткові висоти controls — named composition presets.
7. Компоненти-двійники — canonicalize або чесно перейменувати.
8. Card/Surface/local boundary — shared semantic surfaces із явними local
   exceptions.
9. Typography — named contexts.
10. Повнота каталогу — тільки authenticated workspace.

Попередні десять product-рішень (CTA dark/red, scale 24/18, sm/md/lg controls,
shared chat core, task/calendar chrome, surface/filter presets, `StatusPill`,
`EmptyState` contexts і extraction лише повторюваних controls) зберігаються в
read-only `DecisionLab` у `/ui-kit`.

## Затверджені follow-up рішення

1. Приховані Kanban-колонки мають context preset: у проєкті вони повністю
   приховані, у cross-project Kanban їхні задачі збираються у lane «Приховані».
2. `TaskListView` отримує `hiddenStatusIds` і збирає задачі прихованих статусів
   у явну секцію «Приховані». Це однакова shared-поведінка обох списків; у
   проєкті після зміни видимості задачі прихованих колонок серверно переходять
   у Беклог, тому секція з’являється лише коли в ній справді є задачі.
3. Створення з Kanban є context-aware: у проєкті лишається швидкий inline add,
   а cross-project view відкриває повну форму з вибором проєкту.
4. `IssueCard` і `TaskRow` показують назву проєкту лише з явним
   `showProjectName` у cross-project views.
5. Епік не є спеціальним рівнем ієрархії. Нові задачі використовують типи
   `Фіча`, `Задача`, `Баг`; наявні Епіки лишаються видимими як legacy-тип до
   окремої перевіреної міграції, але нові Епіки не створюються.
6. Справжня підзадача — повноцінний issue з `parentIssueId`, власним ключем,
   статусом, виконавцями, часом і оцінкою. Глибина — один рівень. Батьківська
   задача показує прогрес дітей і не закривається, доки відкриті діти або
   блокуючі залежності. Lightweight-кроки живуть лише як Markdown-checkbox в
   описі; legacy `subtasks[]` можна явно перенести в опис.
7. Логічні зв’язки не створюють ієрархію: доступні `Залежить від`, `Блокує`,
   `Пов’язана з`, `Дублює`. Directional `blocks` зберігається один раз як
   `source blocks target`; UI виводить правильну перспективу з обох боків.

Ці рішення зберігаються як read-only `FidelityFollowUpSurvey` у `/ui-kit`.

## Автоматичні перевірки

- `npm run kit:scan` — inventory shared UI, реальні usages, маршрути і live previews.
- `npm run kit:audit` — native controls, labels, overlays, pills, surfaces,
  icon actions, typography contexts, chrome overrides і name collisions.
- `npm run kit:drift` — розбіжності між продуктом і каталогом там, де продукт
  таки використовує shared-компонент: structural className overrides,
  значення пропів без preview і element children там, де preview передає текст.
- `npm run test:unit` — перевіряє актуальність усіх трьох generated reports та
  забороняє новий unreviewed drift.

Generated reports:

- `src/app/ui-kit/kit-usage.generated.json`
- `src/app/ui-kit/fidelity-audit.generated.json`
- `src/app/ui-kit/kit-drift.generated.json`

## Джерело істини і пропагація

Каталог `/ui-kit` — дзеркало, а не джерело. Зміна в ньому нічого не поширює.
Поширюють два рівні, і тільки вони:

1. `src/app/globals.css` — `@theme` токени, `--ui-*` semantic contract і
   `data-ui-*` правила (геометрія, типографіка, composition-пресети).
2. `src/components/ui/*` — самі компоненти та їхні lookup-мапи
   (`Button.ICON_SIZES`, `UserAvatar.AVATAR_SIZES`, `Surface.PRESETS`…).

Правило: **значення живе в одному з цих двох рівнів, ніколи на місці виклику.**
Вільний проп (`iconSize={16}`, `size={28}`) робить пропагацію неможливою — кожен
виклик тримає власну копію рішення. Такі пропси прибрані й не повертаються:
розмір іконки виводиться з `size`, розмір аватара — з іменованого токена.

Композиція (`flex-1`, `h-full`, зовнішні margin) на місці виклику дозволена: вона
розміщує компонент у батьку й нічого не перевизначає. Заборонено інше — власна
висота, padding, radius чи typography поверх компонента.

## Бюджет різноманіття

Каталог — канон. Варіант існує тоді, коли його вживають **щонайменше три рази**;
інакше це хардкод під іменем варіанта, і його зливають у найближчий канонічний.

Наслідок першого проходу: `Pill.size` 14 → 4 (`sm`/`md`/`lg`/`wide-sm`),
`IconAction.appearance` 16 → 11, `IconAction.size` 8 → 7, `Dialog.size` 6 → 4,
`Counter` numeric 4 → 3, `Card.preset` 3 → 2, `Button` icon-боксів 7 → 6.
Найбільші дублікати були буквальні: `Pill sm`/`compact-md` мали однакову
геометрію й різнились 1px шрифту, `IconAction pane`/`editor` — байт-у-байт
однакові класи, `neutral-hover` (#f5f5f5) проти `neutral` (#f4f4f5).

Правило має три винятки, і вони не «менше трьох використань, але шкода
видаляти» — вони про призначення:

1. **Семантичні тони** (`danger`, `dark`, `info`, `success`, `warning`) несуть
   значення, а не геометрію. Злити їх — не прибрати дублікат, а втратити сенс.
2. **Окремі кольори з роллю**: `accent`, `overlay`, `inverse-outline`,
   `auth-close` — інший контраст для темних чи накладених поверхонь.
3. **Найменший розмір, коли він функціональний**: `Counter size="xs"` (12px)
   тримає числовий бейдж на іконці дзвінка; `sm` (16px) там переллється.

Перед тим як додати новий варіант, перевір панель «Де використовується» на
preview компонента: рідкісні варіанти позначені жовтим саме для цього.

## Маніфест варіантів

`scripts/kit-variants.mjs` виводить перелік варіантів **із реалізації**: з
lookup-мап компонентів і з `data-ui-*` селекторів у `globals.css`. Рукописного
списку немає навмисно — перша спроба була рукописною і помилилась одразу
(пропустила `Pill tone="ink-subtle"`, `size="thin-md"`, чотири Button-composition
і два розміри Dialog). Це та сама хвороба, що й рукописні preview, лише рівнем
вище.

`/ui-kit` → «Матриця варіантів» рендерить кожне оголошене значення. Тому
«варіант існує, але його немає в каталозі» більше неможливий стан: щоб додати
варіант, треба додати запис у мапу або правило в CSS — і він з'явиться сам.
Компоненти, які не рендеряться окремо (Dialog, PageHeader, FilterBar…),
показують оголошені значення з явною причиною замість вигаданого прикладу.

`npm run kit:drift` тримає три нулі:

- значень, яких маніфест не оголошує — 0;
- пропів поза маніфестом — 0;
- `className`, що перевизначає компонент — 0.

`npm run test:unit` падає, якщо будь-який перестає бути нулем.

## Відкриті розбіжності

`kit:audit` питає, чи продукт узагалі бере компонент із кіту. `kit:drift` питає
інше: якщо бере — чи виглядає воно так, як показує preview. Компонент може бути
імпортований усюди, мати зелене покриття і все одно рендеритись на екрані
інакше, ніж у власному preview.

Відкриті знахідки живуть у `/ui-kit` → «Опитування розбіжностей»
(`KitDriftSurvey`). Це єдине опитування тут, яке ще не має відповідей:
`FidelitySurvey` і `FidelityFollowUpSurvey` — read-only архіви затверджених
рішень. Кожна тема має три виходи — версія сайту стає каноном, сайт
підрівнюється до кіту, або свідомий виняток у цьому файлі.

Правило для нової UI-роботи: не додавати черговий override поверх
shared-компонента, а закрити відповідну тему опитування.
