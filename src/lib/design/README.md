# QuickTeam Layout & Surface Hierarchy Guidelines

This document outlines the foundation rules of the QuickTeam interface, ensuring consistency in spacing, layout structures, and surface hierarchy across all views.

## 1. Global Layout Grid

```
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│                         │  Main Content (Always White: #ffffff)                  │
│                         │ ┌────────────────────────────────────────────────────┐ │
│                         │ │ Header (Search + Notifications + User Menu)        │ │
│                         │ ├────────────────────────────────────────────────────┤ │
│  Sidebar                │ │ Title Bar (Title + Actions + Tabs)                 │ │
│  (Always Dark: #1f1f1f) │ │ Filter Bar (Variant inputs & status selections)     │ │
│                         │ ├────────────────────────────────────────────────────┤ │
│                         │ │                                                    │ │
│                         │ │  Content Zone (Surfaces & Cards Area)              │ │
│                         │ │                                                    │ │
│                         │ └────────────────────────────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

1. **Sidebar**: Located on the left, always dark (`#1f1f1f`). It serves as the primary workspace switcher and main navigation.
2. **Main Content**: Located to the right of the Sidebar, always white (`#ffffff`). It contains the Header, Title Bar, and Content Zone.
3. **Molecules in Main Content**:
   * **Header**: Contains global search, notification alerts, and the user profile dropdown.
   * **Title Bar**: Contains the page title, main action buttons, page navigation tabs, and the Filter Bar directly below them.
   * **Content Zone**: The active workspace area where the actual data (Kanban boards, tables, backlogs, chat screens) is displayed.

---

## 2. Surface Hierarchy (Content Zone)

The Content Zone is divided and layered using standard `Surface` components, following strict nesting rules:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Gray Surface Panel (bg-[#f7f7f7], rounded-[16px])                          │
│                                                                            │
│  ┌─────────────────────────────────┐      ┌─────────────────────────────┐  │
│  │ White Card Surface              │      │ Inset Surface               │  │
│  │ (bg-white, rounded-[16px])       │      │ (bg-[#f0f0f0], rounded-12)  │  │
│  │ border-[#e9e9e9]/50             │      │                             │  │
│  └─────────────────────────────────┘      └─────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

* **Level 1: Main Panel**: Usually a gray panel with background `#f7f7f7` and `16px` border-radius (`rounded-[16px]`). It serves as the container for columns or sections.
* **Level 2: Cards & Nested Surfaces**:
  * **White Card Surface**: Floating white card (`bg-white`), `16px` border-radius (`rounded-[16px]`), subtle border (`border-[#e9e9e9]/50`) and shadow. Used for tasks, project summaries, and details.
  * **Colored Card Surface**: Soft glassy colors (e.g., info, success) with `16px` border-radius (`rounded-[16px]`).
  * **Surface Inset**: Inset block nested inside the main gray panel. Has background `#f0f0f0` and `12px` border-radius (`rounded-[12px]`). Used for nested lists, stage sections, and inner blocks.

---

## 3. Border-Radius (Rounding) Hierarchy

To avoid visual distortion and achieve "concentric corners," inner elements must have smaller border-radius tokens than their containers:
$$\text{Inner Radius } (R_{\text{inner}}) = \text{Outer Radius } (R_{\text{outer}}) - \text{Padding}$$

We define the following standard rounding tokens across the application:

| Token Level | Value | Tailwind Class | Usage / Target Elements |
| :--- | :--- | :--- | :--- |
| **L0 (Global Containers)** | **`24px`** | `rounded-[24px]` | Main Content screen area, overlay dialog modals. |
| **L1 (Surfaces / Panels)** | **`16px`** | `rounded-[16px]` | Main Gray Panels (`Surface variant="panel"`), White Floating Cards (`Surface variant="card"`), Sidebar card wrappers. |
| **L2 (Medium Components)**| **`12px`** | `rounded-[12px]` | Inset Surfaces (`Surface variant="inset"`), Sidebar links, Dialog inner wrapper areas. |
| **L2.5 (Standard Forms)** | **`10px`** | `rounded-[10px]` | Buttons (all sizes), Text Inputs, Textareas, Select dropdown buttons, Page navigation tabs. |
| **L3 (Small Accents)**    | **`8px`**  | `rounded-[8px]`  | MultiSelect dropdown filters, inner buttons. |
| **L4 (Micro Details)**    | **`6px`**  | `rounded-[6px]`  | Badges (Status, Priority, Roles), Tag chips. |
