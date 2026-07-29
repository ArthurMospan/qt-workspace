# UI Kit fidelity audit

Дата повторної перевірки: 2026-07-28.

Аудит охоплює authenticated workspace: dependency graph починається у
`src/app/(app)` і проходить reachable local imports. Джерело істини —
`src/app/ui-kit/fidelity-audit.generated.json`.

## Поточний результат

- 157 reachable source files, 0 parser errors.
- 0 manual form labels.
- 0 manual modal/form shells.
- 0 manual pill candidates.
- 0 manual neutral icon-action candidates.
- 0 unclassified manual surfaces.
- 0 headings поза named typography contexts.
- 0 chrome overrides поверх shared UI.
- 0 local/shared component-name collisions.
- 68 reviewed local surface exceptions. Це media/editor/calendar/message/layout
  containers, які свідомо не видаються за універсальні Card/Surface.
- 161 native controls, із них 18 мають явний reviewed context
  (`branding-action`, `media-action`, `calendar-attribute-trigger` та інші).
- 0 повторюваних native-control fingerprints. Новий повторюваний visual pattern
  треба винести у shared UI або дати йому точний reviewed context; спеціалізований
  file input, drag handle, editor/media action чи branded control не
  нормалізується механічно.

## Що було синхронізовано

- Geometry controls, surfaces, pills і typography підключена до semantic CSS
  contract у `src/app/globals.css`.
- `Input`, `Button`, `Select`, `DatePicker`, `Textarea`, `Card`, `Surface`,
  `Dialog`, `Label` і `FormGroup` використовують named props/presets.
- Додані та реально використовуються `Pill` і `IconAction`.
- `StatusPill` і `TypeBadge` побудовані на спільній pill geometry.
- Form side sheets переведені на `Dialog`; viewers/responsive panes явно
  класифіковані окремо.
- Локальні `ProjectCard`, `Avatar` і `Toast` отримали точні context names.
- Всі 41 shared-компоненти, які рендерить authenticated workspace, мають живий
  preview у `/ui-kit`; unused-компоненти у доступний каталог не входять.

## Захист від нового drift

Зміна shared UI або його product usage вимагає:

1. оновити той самий semantic component/preset;
2. синхронізувати живий preview `/ui-kit`;
3. виконати `npm run kit:scan` і `npm run kit:audit`;
4. виконати `npm run lint`, `npm run test:unit` і `npm run build`.

Правила для майбутніх змін зафіксовані у `docs/UI_KIT_CONTRACT.md` та
кореневому `AGENTS.md`.
