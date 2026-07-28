# QuickTeam Workspace — Design System

> **Portable design-system spec.** This single file describes the entire visual
> language and component API of the QuickTeam Workspace app so that **any AI or
> developer can import / reproduce the design system without reading the source
> code.** Values are the single source of truth taken from
> `src/app/globals.css` and `src/components/ui/`.
>
> Stack: **Next.js (App Router) + Tailwind CSS v4 + React (JSX)**.
> Tailwind v4 config lives in CSS (`@theme`), there is **no** `tailwind.config.js`.

---

## 1. Design Principles

- **Light, minimal, dense.** A neutral grey canvas with white surfaces and one
  near-black "ink" accent. No brand color beyond ink; color is reserved for
  status/semantics only.
- **Single source of truth.** Product code references design tokens
  (`bg-ink`, `text-muted`, `border-line`, …), never raw hex. Change a token →
  it propagates everywhere.
- **One master component per primitive.** e.g. every button in the app is the
  single `<Button>` component; never hand-roll variants.
- **App-shell layout.** `body` is fixed to `100dvh` with `overflow: hidden`;
  children scroll individually. Thin custom scrollbars everywhere.
- **Accessibility first.** Visible focus rings on interactive elements,
  `prefers-reduced-motion` respected, `sr-only` labels on icon-only buttons.

---

## 2. Design Tokens

### 2.1 Brand / neutral palette (core tokens)

Defined in `@theme` in `globals.css`. Each maps to a Tailwind utility.

| Token            | Hex       | Tailwind utility            | Usage                                   |
| ---------------- | --------- | --------------------------- | --------------------------------------- |
| `--color-ink`    | `#1f1f1f` | `bg-ink` / `text-ink`       | Primary dark: text, buttons, sidebar    |
| `--color-ink-hover` | `#303030` | `bg-ink-hover`           | Dark hover / pill                       |
| `--color-canvas` | `#f4f4f5` | `bg-canvas`                 | App canvas / element grey               |
| `--color-surface`| `#ffffff` | `bg-surface`                | Cards, modals, content background       |
| `--color-line`   | `#e9e9e9` | `border-line`               | Borders / dividers                      |
| `--color-muted`  | `#9a9a9a` | `text-muted`                | Secondary text, placeholders            |
| `--color-faint`  | `#cfcfcf` | `text-faint`                | Disabled / very light text              |

### 2.2 Semantic (status) colors

Used for badges, alerts, statuses. Not registered as `@theme` tokens — applied
as literal hex in components.

| Name    | Hex       | Meaning       |
| ------- | --------- | ------------- |
| Success | `#10b981` | Успіх         |
| Warning | `#eab308` | Попередження  |
| Danger  | `#ef4444` | Небезпека / delete |
| Error   | `#f97316` | Помилка       |
| Info    | `#6366f1` | Інформація    |

Common danger derivatives: hover `#dc2626`, soft bg `#fee2e2`.
Secondary button greys: bg `#f5f5f5`, hover `#ebebeb`, ghost hover `#f0f0f0`.

### 2.3 Typography

| Token          | Family                          | Tailwind      | Use                         |
| -------------- | ------------------------------- | ------------- | --------------------------- |
| `--font-inter` | `'Inter', sans-serif`           | `font-inter`  | Default UI / body           |
| `--font-roboto`| `'Roboto Condensed', sans-serif`| `font-roboto` | Condensed labels / accents  |

Loaded via Google Fonts: Inter (300–700), Roboto Condensed (400/500/700).
`body` uses Inter, antialiased.

**Type scale (observed):** `11px` micro, `12px` caption, `13px` button/body-sm,
`14px` body, `24px` section heading. Buttons use `font-bold` + `leading-none`.

### 2.4 Radius

- Buttons / inputs: `10px`
- Cards / surfaces: `12px`
- Swatches / small chips: `8px`
- Pills / scrollbar thumb: `99px` (full)

### 2.5 Spacing & layout tokens

- Page horizontal gutter: `24px` mobile → `32px` at `md` (≥768px). Apply via
  `.page-gutter` or `.workspace-page-layout`; use `.full-bleed` for edge-to-edge
  rows (kanban, tabs, timesheet).
- Use Tailwind spacing scale + `gap-*` for spacing (avoid arbitrary px where a
  scale value exists). Existing code frequently uses arbitrary px (`gap-[6px]`,
  `px-[18px]`) — match that convention when editing existing components.
- Safe-area vars: `--sat` (top), `--sab` (bottom).

### 2.6 Focus & motion

```css
/* Focus ring on buttons, links, tabs */
outline: 2px solid rgb(31 31 31 / 35%);
outline-offset: 2px;
/* Inputs/textareas suppress the ring (rely on border) */
```

- All animation/transition durations collapse to ~0 under
  `prefers-reduced-motion: reduce`.

### 2.7 Utility classes (custom)

| Class               | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `.card`             | `bg-surface` + `1px solid line` + radius `12px`                |
| `.sidebar-glass`    | Dark sidebar background (`--color-ink`)                        |
| `.page-gutter`      | Responsive page horizontal padding                             |
| `.workspace-page-layout` | Flex column page shell, gutter + `padding-top: 56px`       |
| `.full-bleed`       | Negative-margin an element to page edges                       |
| `.full-bleed-mobile`| Same, only below `md`                                          |
| `.chat-composer-dock` | Composer that overlaps the scroll area by half its height    |
| `.hide-scrollbar`   | Scrollable but no visible scrollbar (prevents content reflow)  |

---

## 3. Tailwind v4 Setup (reproduce the theme)

Put this in `src/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Roboto+Condensed:wght@400;500;700&display=swap');
@import "tailwindcss";

@theme {
  --font-inter: 'Inter', sans-serif;
  --font-roboto: 'Roboto Condensed', sans-serif;

  --color-ink:        #1f1f1f;
  --color-ink-hover:  #303030;
  --color-canvas:     #f4f4f5;
  --color-surface:    #ffffff;
  --color-line:       #e9e9e9;
  --color-muted:      #9a9a9a;
  --color-faint:      #cfcfcf;
}

@layer base {
  body {
    font-family: var(--font-inter);
    @apply antialiased bg-canvas text-ink;
    width: 100%; height: 100dvh; margin: 0; padding: 0;
    overflow: hidden; /* App shell — children scroll individually */
  }
}
```

Registering `--color-*` in `@theme` auto-generates `bg-*`, `text-*`,
`border-*` utilities for each token name (e.g. `bg-ink`, `text-muted`).

---

## 4. Component Inventory

All components live under `src/components/ui/` and are re-exported from the
barrel `src/components/ui/index.js`. Import pattern:

```jsx
import { Button, Card, Input, Badge, StatusBadge } from '@/components/ui';
```

Organized by Atomic Design categories:

### 4.1 Core Layout
`Stack`, `Spacer`, `Surface`, `PageLayout`, `PageContentWrapper`,
`Container`, `Grid`, `SidebarLayout`, `PageHeader`, `ListItem`, `Table`, `Card`.

### 4.2 Forms
`Input`, `Textarea`, `Checkbox`, `RadioButton`, `ToggleSwitch`, `Select`,
`DatePicker`, `TimePicker`, `SearchInput`, `HeaderSearch`, `FileInput`,
`Label`, `FormGroup`.

### 4.3 Buttons
`Button` (master), `ButtonGroup`, `SplitButton`, `IconButton` (= `Button` with
icon-only size).

### 4.4 Data Display
`Badge`, `Tag`, `Chip`, `Avatar`, `AvatarGroup`, `Progress`, `ProgressRing`,
`StatusBadge`, `PriorityBadge`, `Stat`, `Counter`, `KpiCard`.

### 4.5 Navigation
`Breadcrumb`, `Pagination`, `Stepper`, `Dropdown`, `Popover`, `Tooltip`,
`Menu`, `InnerNavigation`.

### 4.6 Feedback
`Alert`, `Toast`, `LoadingSpinner`, `EmptyState`.

### 4.7 Overlays / Misc
`Dialog`, `ConfirmProvider` + `useConfirm`, `Tabs`, `ContextMenu`, `FilterBar`,
`Segmented`.

### 4.8 Task-management (domain organisms)
`TaskCard`, `TaskRow`, `ProjectCard`, `TeamMemberCard`, `CommentThread`,
`TimeLogDisplay`, `TaskAttributesPanel`.

---

## 5. Master Component API — `Button`

The canonical example of the "one master component" rule. Every button MUST use
this; do not create ad-hoc buttons.

```jsx
<Button
  style="primary"   // 'primary' | 'secondary' | 'outline' | 'ghost'
  color="dark"      // 'dark' (default) | 'red'  (red = delete/danger only)
  size="lg"         // 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
  icon={PlusIcon}   // optional lucide-style icon component
  iconSize={16}     // optional override
  loading={false}   // shows spinner, disables
  disabled={false}
  collapseAt="md"   // 'sm' | 'md' — becomes square icon-only below breakpoint
  onClick={fn}
>
  Label
</Button>
```

### Size rules (strict)

| size      | Height     | Notes                                  |
| --------- | ---------- | -------------------------------------- |
| `lg`      | 36px (h-9) | Primary CTA — **default**              |
| `md`      | 32px (h-8) | Action buttons (edit, archive)         |
| `sm`      | 28px (h-7) | Compact contexts                       |
| `icon`    | 32×32      | Icon-only (label becomes `sr-only`)    |
| `icon-sm` | 28×28      | Icon-only compact                      |
| `icon-lg` | 36×36      | Icon-only large                        |

All sizes use radius `10px`. Padding: `sm` px-12/text-12, `md` px-16/text-13,
`lg` px-18/text-13.

### Style × color matrix

| style       | dark                                                | red                                                   |
| ----------- | --------------------------------------------------- | ----------------------------------------------------- |
| `primary`   | `bg-ink text-white hover:bg-ink-hover`              | `bg-[#ef4444] text-white hover:bg-[#dc2626]`          |
| `secondary` | `bg-[#f5f5f5] text-ink hover:bg-[#ebebeb]`          | `bg-[#f5f5f5] text-[#ef4444] hover:bg-[#ebebeb]`      |
| `outline`   | `bg-transparent text-ink border-2 border-ink hover:bg-canvas` | `... text-[#ef4444] border-[#ef4444] hover:bg-[#fee2e2]` |
| `ghost`     | `bg-transparent text-muted hover:text-ink hover:bg-[#f0f0f0]` | `... text-[#ef4444] hover:bg-[#fee2e2]`             |

Base classes: `inline-flex items-center justify-center gap-[6px] font-bold
leading-none transition-colors focus:outline-none disabled:opacity-50
disabled:cursor-not-allowed shrink-0`.

Default icon size by button size: `lg → 16`, `md → 14`, `sm → 12`.
Legacy `variant` prop is accepted as an alias for `style`.

---

## 6. Reusable Patterns

- **Card:** `.card` class or `<Card>` — white surface, `1px` line border,
  radius `12px`.
- **Page shell:** wrap pages in `.workspace-page-layout` (or `<PageLayout>`)
  for consistent gutter + top offset; use `<PageHeader>` for titles.
- **Edge-to-edge rows** (kanban/tables/tabs): apply `.full-bleed` inside a
  guttered page so the row matches the page's declared gutter.
- **Overflowing columns:** use `.hide-scrollbar` to avoid content shifting when
  a column crosses the overflow threshold.
- **Confirmations:** use `useConfirm()` from `ConfirmProvider` instead of native
  `confirm()`.
- **Danger actions:** `Button color="red"` only; never repurpose semantic red
  for non-destructive actions.

---

## 7. Import Checklist for an AI Reproducing This System

1. Set up Tailwind v4 with the `@theme` block from §3 (fonts + core tokens).
2. Add the base `body` app-shell rules and custom utilities from §2.7.
3. Reference tokens via utilities (`bg-ink`, `text-muted`, `border-line`); never
   hardcode brand hex. Use §2.2 semantic hex only for status.
4. Build one master component per primitive; follow the `Button` API in §5 as
   the template for strict size/style matrices.
5. Keep the barrel export (`components/ui/index.js`) as the single import
   surface: `import { X } from '@/components/ui'`.
6. Respect accessibility: focus rings (§2.6), `sr-only` on icon-only buttons,
   `prefers-reduced-motion`.

---

_Source of truth: `src/app/globals.css` (tokens) and `src/components/ui/`
(components). The live gallery is the app route `/ui-kit`._
