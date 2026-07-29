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

- `npm run kit:scan` — inventory shared UI, реальні usages і live previews.
- `npm run kit:audit` — native controls, labels, overlays, pills, surfaces,
  icon actions, typography contexts, chrome overrides і name collisions.
- `npm run test:unit` — перевіряє актуальність обох generated reports та
  забороняє новий unreviewed drift.

Generated reports:

- `src/app/ui-kit/kit-usage.generated.json`
- `src/app/ui-kit/fidelity-audit.generated.json`
