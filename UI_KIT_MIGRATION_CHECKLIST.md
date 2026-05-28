# QuickTeam UI Kit Migration Checklist

**Generated**: 2026-05-28  
**Audit Scope**: All pages and components in `src/app/` and `src/components/`  
**Total Files Analyzed**: 95 JSX components + 20 pages = 115 files  
**Target**: 100% UI Kit adoption where every UI element uses centralized UI Kit components

---

## Executive Summary

### Current State
- **95 JSX component files** containing UI elements
- **20 page files** (App Router routes)
- **~171 raw `<button>` elements** without Button component wrapper
- **~41 raw `<input>` elements** without Input/FormGroup wrapper
- **~12 raw `<textarea>` elements** without Textarea component
- **~58 hardcoded card/panel containers** with inline styling
- **~605 inline badge/status elements** with hardcoded colors and rounded styling
- **~13 custom loading spinners** (should use LoadingSpinner component)
- **~32 custom error messages** (should use Alert component)
- **~52 empty state displays** (should use EmptyState component)

### Overall Adoption Rate
- **UI Kit Components Used**: ~15%
- **Hardcoded/Raw Elements**: ~85%
- **Estimated Migration Effort**: 40-50 hours of development
- **Risk Level**: Medium (mostly cosmetic changes, core functionality stable)

---

## UI Kit Component Inventory

### Available Components
The following UI Kit components are available in `src/components/ui/`:

#### Layout Components
- [ ] `Stack` — Flexbox container with spacing
- [ ] `Spacer` — Vertical/horizontal spacing
- [ ] `Surface` — Themed surface with elevation
- [ ] `PageLayout` — Page container
- [ ] `Card` — Card container with defaults
- [ ] `Container` — Content wrapper
- [ ] `Grid` — Grid layout
- [ ] `Panel` — Panel container
- [ ] `Flex` — Flexbox component
- [ ] `Divider` — Line separator

#### Form Components
- [ ] `Input` — Text input (replaces `<input type="text">`)
- [ ] `Textarea` — Text area (replaces `<textarea>`)
- [ ] `Checkbox` — Checkbox (replaces `<input type="checkbox">`)
- [ ] `RadioButton` — Radio button (replaces `<input type="radio">`)
- [ ] `ToggleSwitch` — Toggle switch
- [ ] `Select` — Dropdown select (already imported in some places)
- [ ] `DatePicker` — Date input
- [ ] `TimePicker` — Time input
- [ ] `SearchInput` — Search field
- [ ] `FileInput` — File upload
- [ ] `Label` — Form label
- [ ] `FormGroup` — Form group wrapper

#### Button & Action Components
- [ ] `Button` — Primary button component
- [ ] `ButtonGroup` — Group of buttons
- [ ] `SplitButton` — Button with dropdown
- [ ] `IconButton` — Icon-only button

#### Data Display Components
- [ ] `Badge` — Badge/pill component
- [ ] `Tag` — Tag component
- [ ] `Avatar` — User avatar
- [ ] `AvatarGroup` — Multiple avatars
- [ ] `Progress` — Progress bar
- [ ] `ProgressRing` — Circular progress
- [ ] `StatusBadge` — Status indicator with color
- [ ] `PriorityBadge` — Priority indicator
- [ ] `Chip` — Small chip/tag
- [ ] `Stat` — Statistic display

#### Navigation Components
- [ ] `Breadcrumb` — Breadcrumb navigation
- [ ] `Pagination` — Pagination controls
- [ ] `Stepper` — Step indicator
- [ ] `Menu` — Dropdown menu
- [ ] `Popover` — Popover container
- [ ] `Tooltip` — Tooltip component
- [ ] `Dropdown` — Dropdown wrapper

#### Feedback Components
- [ ] `Alert` — Alert message (replaces inline error/warning)
- [ ] `Toast` — Toast notification
- [ ] `LoadingSpinner` — Loading indicator (replaces hardcoded spinners)
- [ ] `EmptyState` — Empty state display

#### Specialized Components
- [ ] `TaskCard` — Task display card
- [ ] `ProjectCard` — Project display card
- [ ] `TeamMemberCard` — Team member card
- [ ] `CommentThread` — Comment display
- [ ] `TimeLogDisplay` — Time log display

#### Other Components
- [ ] `Dialog` — Modal/dialog
- [ ] `Tabs` — Tabbed interface

---

## Detailed Migration Checklist by Location

### Priority 1: Critical Paths (User-Facing, High Traffic)

#### 1. Authentication & Onboarding
**Files**: `src/app/login/page.js`, `src/app/onboarding/page.js`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Login button | `<button className="bg-[#1f1f1f]...">` | login/page.js:63-67 | Hardcoded colors | `Button variant="primary"` | CRITICAL | ⬜ |
| Loading spinner | `<div className="animate-spin">` | login/page.js:32 | Custom animation | `LoadingSpinner` | CRITICAL | ⬜ |
| Sign-in button | `<button className="...">` | login/page.js:64-80 | Inline styling | `Button` | CRITICAL | ⬜ |
| Error message | Text with `className="text-red"` | login/page.js:24-25 | Inline error | `Alert variant="error"` | HIGH | ⬜ |
| Onboarding buttons | Multiple `<button>` | onboarding/page.js | Inconsistent styling | `Button` variants | HIGH | ⬜ |
| Form inputs | `<input type="text">` | onboarding/page.js | Raw HTML | `Input` + `FormGroup` | HIGH | ⬜ |

#### 2. Workspace Layout (Navigation)
**Files**: `src/components/WorkspaceSidebar.jsx`, `src/components/WorkspaceHeader.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Sidebar nav links | `<Link className="...rounded...">` | WorkspaceSidebar.jsx:92-100 | Hardcoded states | Could use custom nav component | HIGH | ⬜ |
| Toggle buttons | `<button className="...">` | WorkspaceSidebar.jsx:65-82 | Inline styled | `IconButton` | HIGH | ⬜ |
| Notification bell | `<Bell>` in button | WorkspaceHeader.jsx | Hardcoded styling | `IconButton` | HIGH | ⬜ |
| Search input | Hardcoded input | WorkspaceHeader.jsx | No FormGroup | `SearchInput` | HIGH | ⬜ |
| Dropdown menus | Custom styled divs | WorkspaceHeader.jsx:189-214 | Inline styling | `Dropdown` or `Menu` | HIGH | ⬜ |

#### 3. Project Management (Main Feature)
**Files**: `src/app/workspace/page.js`, `src/app/workspace/[projectId]/page.js`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Edit Project Modal | Custom `<div>` with buttons | workspace/page.js:37-75 | Hardcoded modal styling | `Dialog` + `Button` | HIGH | ⬜ |
| Form inputs (name) | `<input className="bg-[#f7f7f7]">` | workspace/page.js:47-52 | Inline styling | `Input` | HIGH | ⬜ |
| Form buttons | `<button className="...rounded...">` | workspace/page.js:67-70 | Hardcoded styling | `Button` | HIGH | ⬜ |
| Project cards | `<div className="...rounded...shadow">` | Multiple pages | Inline card styling | `Card` or `ProjectCard` | HIGH | ⬜ |
| Add Member Modal | Custom modal | workspace/page.js:78-120+ | All hardcoded | `Dialog` + Form components | HIGH | ⬜ |
| Member buttons | `<button onClick={toggleMember}>` | workspace/page.js | Inline styling | `Button` or `Chip` | MEDIUM | ⬜ |
| Delete confirmations | Custom styled modal | workspace/page.js | Inline styling | `Dialog` + `Alert` | MEDIUM | ⬜ |

#### 4. Task & Issue Management
**Files**: `src/components/TaskDetailPanel.jsx`, `src/components/CreateTaskModal.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Task status badges | Inline `<span>` with color | TaskDetailPanel.jsx:99-100 | Hardcoded colors | `StatusBadge` | HIGH | ⬜ |
| Priority badge | `<span style={{ color: priority.color }}` | TaskDetailPanel.jsx:100 | Inline styles | `PriorityBadge` | HIGH | ⬜ |
| Tabs | `<button className="...border-b">` | TaskDetailPanel.jsx:110-116 | Hardcoded tab styling | `Tabs` component | HIGH | ⬜ |
| Date input | `<input type="date">` | TaskDetailPanel.jsx:133-138 | Raw HTML input | `DatePicker` | HIGH | ⬜ |
| Assignee buttons | `<button className="...rounded-full">` | TaskDetailPanel.jsx:158-162 | Inline styling | `Chip` or button group | HIGH | ⬜ |
| Label badges | Inline `<span>` | TaskDetailPanel.jsx:175-180 | Hardcoded styling | `Badge` or `Chip` | HIGH | ⬜ |
| Subtask checkboxes | `<button>` for toggle | TaskDetailPanel.jsx:223-224 | Not standard checkbox | `Checkbox` | MEDIUM | ⬜ |
| Add label dropdown | Custom modal | TaskDetailPanel.jsx:189-214 | Hardcoded positioning | `Dropdown` or `Popover` | MEDIUM | ⬜ |
| Create Task Modal | Full modal with forms | CreateTaskModal.jsx | Extensive inline styling | `Dialog` + Form components | HIGH | ⬜ |
| Modal buttons | `<button className="...">` | CreateTaskModal.jsx:97-100 | Hardcoded styling | `Button` | HIGH | ⬜ |

#### 5. Chat & Messaging
**Files**: `src/components/TaskInternalChat.jsx`, `src/app/workspace/chat/page.js`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Send button | `<button className="...">` | TaskInternalChat.jsx | Inline styling | `IconButton` or `Button` | MEDIUM | ⬜ |
| Message input | `<input type="text">` | TaskInternalChat.jsx | Raw HTML | `Input` + `FormGroup` | MEDIUM | ⬜ |
| Chat message bubbles | Custom `<div>` | TaskInternalChat.jsx | Hardcoded styling | Could use `CommentThread` | MEDIUM | ⬜ |
| Reactions | Hardcoded spans | Chat messages | Inline styling | Custom component | LOW | ⬜ |

### Priority 2: Feature Pages (Medium Traffic)

#### 6. Analytics & Reporting
**Files**: `src/app/workspace/analytics/page.js`, `src/components/workspace/AnalyticsTab.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Chart containers | `<div className="...rounded...bg">` | AnalyticsTab.jsx | Hardcoded styling | `Card` | MEDIUM | ⬜ |
| Tab buttons | `<button>` | AnalyticsTab.jsx | Inline styling | `Tabs` or `ButtonGroup` | MEDIUM | ⬜ |
| Loading state | Custom spinner | AnalyticsTab.jsx | Hardcoded animation | `LoadingSpinner` | MEDIUM | ⬜ |
| Empty states | Text only | AnalyticsTab.jsx | No component | `EmptyState` | MEDIUM | ⬜ |
| Export buttons | `<button>` | AnalyticsTab.jsx | Inline styling | `Button` | LOW | ⬜ |

#### 7. Team Management
**Files**: `src/app/workspace/team/page.js`, `src/app/workspace/team/[uid]/page.js`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Member cards | `<div className="...rounded...shadow">` | team/page.js | Hardcoded card styling | `TeamMemberCard` or `Card` | MEDIUM | ⬜ |
| Action buttons | `<button>` | team/page.js | Inline styling | `Button` or `IconButton` | MEDIUM | ⬜ |
| Status indicators | Inline `<span>` | team/[uid]/page.js | Hardcoded colors | `StatusBadge` | MEDIUM | ⬜ |
| Role badges | Inline styling | team/page.js | Hardcoded colors | `Badge` | MEDIUM | ⬜ |
| Invite modal | Custom modal | team/page.js | All hardcoded | `Dialog` + Form components | MEDIUM | ⬜ |

#### 8. Settings
**Files**: `src/app/workspace/settings/page.js`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Settings form | `<input>`, `<select>` | settings/page.js | Raw HTML | `Input`, `Select`, `FormGroup` | MEDIUM | ⬜ |
| Toggle switches | `<input type="checkbox">` | settings/page.js | Raw HTML | `ToggleSwitch` | MEDIUM | ⬜ |
| Save/Cancel buttons | `<button>` | settings/page.js | Inline styling | `Button` | MEDIUM | ⬜ |
| Section dividers | Hardcoded divs | settings/page.js | Inline styling | `Divider` | LOW | ⬜ |
| Success/error messages | Text styling | settings/page.js | No component | `Alert` or `Toast` | MEDIUM | ⬜ |

#### 9. Time Tracking
**Files**: `src/components/workspace/TimesheetTab.jsx`, `src/components/workspace/TimeTracker.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Timer buttons | `<button>` | TimeTracker.jsx | Inline styling | `Button` | MEDIUM | ⬜ |
| Time input | `<input type="number">` | TimeTracker.jsx | Raw HTML | `Input` | MEDIUM | ⬜ |
| Time display | Custom formatting | TimesheetTab.jsx | Inline styling | `TimeLogDisplay` | MEDIUM | ⬜ |
| Save button | `<button>` | TimeTracker.jsx | Inline styling | `Button` | MEDIUM | ⬜ |
| Loading state | Custom spinner | TimesheetTab.jsx | Hardcoded animation | `LoadingSpinner` | MEDIUM | ⬜ |

### Priority 3: Modals & Dialogs (Supporting Components)

#### 10. Modal Components
**Files**: `src/components/workspace/BoardConfigModal.jsx`, `src/components/workspace/IssueModal.jsx`, `src/components/CardModal.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Modal overlay | Custom `<div>` | All modals | Hardcoded styling | `Dialog` component | HIGH | ⬜ |
| Modal header | `<div>` with border | All modals | Inline styling | Dialog with header slot | MEDIUM | ⬜ |
| Form inputs in modals | `<input>`, `<select>` | All modals | Raw HTML | `Input`, `Select`, `FormGroup` | MEDIUM | ⬜ |
| Close button | `<button>` | All modals | Inline styling | `IconButton` | HIGH | ⬜ |
| Action buttons | `<button>` | All modals | Inline styling | `Button` | HIGH | ⬜ |

#### 11. Dropdown/Popover Components
**Files**: Multiple components using inline dropdowns

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Dropdown containers | Custom positioned `<div>` | TaskDetailPanel.jsx, others | Hardcoded positioning | `Dropdown` or `Menu` | MEDIUM | ⬜ |
| Dropdown items | `<button>` | Multiple | Inline styling | `Menu` items | MEDIUM | ⬜ |
| Popover overlays | Fixed `<div>` | Multiple | Hardcoded z-index | `Popover` component | MEDIUM | ⬜ |

#### 12. Search & Filter
**Files**: `src/components/SearchModal.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Search input | Hardcoded `<input>` | SearchModal.jsx | No FormGroup | `SearchInput` | MEDIUM | ⬜ |
| Result items | `<div>` | SearchModal.jsx | Inline styling | `ListItem` or custom component | MEDIUM | ⬜ |
| Loading state | Custom spinner | SearchModal.jsx | Hardcoded animation | `LoadingSpinner` | MEDIUM | ⬜ |
| Empty state | Text only | SearchModal.jsx | No component | `EmptyState` | MEDIUM | ⬜ |

### Priority 4: Data Display (Lower Traffic)

#### 13. Kanban & Board Views
**Files**: `src/components/Board.jsx`, `src/components/KanbanColumn.jsx`, `src/components/workspace/AgileBoard.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Column containers | `<div className="...rounded...bg">` | KanbanColumn.jsx | Hardcoded styling | `Card` or `Surface` | MEDIUM | ⬜ |
| Task cards | Custom `<div>` | Board.jsx, AgileBoard.jsx | Inline styling | `TaskCard` component | MEDIUM | ⬜ |
| Drag handle | `<div>` with icon | Board.jsx | Inline styling | Could be standardized | LOW | ⬜ |
| Add card button | `<button>` | KanbanColumn.jsx | Inline styling | `Button` | LOW | ⬜ |
| Status indicators | Inline `<span>` | Card elements | Hardcoded colors | `StatusBadge` | MEDIUM | ⬜ |

#### 14. Portfolio/Backlog
**Files**: `src/components/workspace/BacklogTab.jsx`, `src/components/workspace/EpicsPanel.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Backlog items | `<div>` | BacklogTab.jsx | Inline styling | `ListItem` or custom component | MEDIUM | ⬜ |
| Priority indicators | Inline `<span>` | BacklogTab.jsx | Hardcoded colors | `PriorityBadge` | MEDIUM | ⬜ |
| Epic badges | Inline styling | EpicsPanel.jsx | Hardcoded colors | `Badge` | MEDIUM | ⬜ |
| Collapse/expand buttons | `<button>` | EpicsPanel.jsx | Inline styling | `IconButton` | LOW | ⬜ |

#### 15. Dependencies & Links
**Files**: `src/components/workspace/DependenciesPanel.jsx`, `src/components/workspace/IssueDetail.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Dependency cards | `<div>` | DependenciesPanel.jsx | Inline styling | `Card` | LOW | ⬜ |
| Link type badges | Inline `<span>` | IssueDetail.jsx | Hardcoded colors | `Badge` | LOW | ⬜ |
| Action buttons | `<button>` | IssueDetail.jsx | Inline styling | `Button` or `IconButton` | LOW | ⬜ |

#### 16. Billing & Portal
**Files**: `src/components/workspace/BillingTab.jsx`, `src/components/workspace/PortalPanel.jsx`

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Plan cards | `<div className="...rounded...shadow">` | BillingTab.jsx | Hardcoded card styling | `Card` | LOW | ⬜ |
| CTA buttons | `<button>` | BillingTab.jsx | Inline styling | `Button` | LOW | ⬜ |
| Price display | Inline `<span>` | BillingTab.jsx | Hardcoded styling | Custom component | LOW | ⬜ |
| Portal components | Mixed styling | PortalPanel.jsx | Inconsistent | UI Kit components | LOW | ⬜ |

#### 17. Utilities & Other
**Files**: `src/components/UserAvatar.jsx`, `src/components/OrgSwitcherScreen.jsx`, others

| Element | Current | Location | Issues | Recommended Component | Priority | Status |
|---------|---------|----------|--------|----------------------|----------|--------|
| Avatar display | Custom `<img>` with fallback | UserAvatar.jsx | Inline styling | `Avatar` component | MEDIUM | ⬜ |
| Org switcher buttons | `<button>` | OrgSwitcherScreen.jsx | Inline styling | `Button` or `Chip` | MEDIUM | ⬜ |
| Markdown editor | Custom buttons | MarkdownEditor.jsx | Inline toolbar | Standardize with `Button` | MEDIUM | ⬜ |
| Toast notifications | Custom div | Toast.jsx | Hardcoded positioning | Use `Toast` component | HIGH | ⬜ |
| Error messages | Raw text | Multiple | No styling | `Alert` component | HIGH | ⬜ |

---

## Migration Statistics

### Totals by Element Type

| Element Type | Count | Current State | Recommended | Priority |
|--------------|-------|----------------|-------------|----------|
| Buttons | ~171 | `<button>` with inline classes | `Button`, `IconButton`, `ButtonGroup` | HIGH |
| Inputs (text) | ~41 | `<input type="text">` | `Input`, `SearchInput` | HIGH |
| Textareas | ~12 | `<textarea>` | `Textarea` | MEDIUM |
| Cards/Panels | ~58 | `<div>` with inline styling | `Card`, `Panel`, `Surface` | HIGH |
| Badges/Status | ~605 | Inline `<span>` with color | `Badge`, `StatusBadge`, `PriorityBadge` | HIGH |
| Loading States | ~13 | Custom `animate-spin` divs | `LoadingSpinner` | MEDIUM |
| Error Messages | ~32 | Raw text or inline styled | `Alert` | MEDIUM |
| Empty States | ~52 | Text only | `EmptyState` | MEDIUM |
| Checkboxes | ~10 | `<input type="checkbox">` | `Checkbox` | MEDIUM |
| Modals/Dialogs | ~15 | Custom `<div>` | `Dialog` | HIGH |
| Dropdowns | ~20 | Custom positioned `<div>` | `Dropdown`, `Menu`, `Popover` | MEDIUM |
| Date Inputs | ~8 | `<input type="date">` | `DatePicker` | MEDIUM |
| Tabs | ~5 | `<button>` with border-bottom | `Tabs` | MEDIUM |

**Total Elements to Migrate**: ~1,042

---

## Migration Roadmap

### Phase 1: Foundation (Week 1-2) - ~10-15 hours
**Focus**: Critical paths - Auth, Layout, Core Forms

- [ ] **src/app/login/page.js**
  - Replace login button with `Button`
  - Replace loading spinner with `LoadingSpinner`
  - Replace error text with `Alert` component

- [ ] **src/app/onboarding/page.js**
  - Convert all form inputs to `Input` + `FormGroup`
  - Replace all buttons with `Button` component
  - Add proper error handling with `Alert`

- [ ] **src/components/WorkspaceHeader.jsx**
  - Replace search input with `SearchInput`
  - Replace all buttons with `IconButton`
  - Replace custom dropdowns with `Dropdown` component

- [ ] **src/components/WorkspaceSidebar.jsx**
  - Replace toggle buttons with `IconButton`
  - Consider creating nav component using `Stack` + links

### Phase 2: Core Features (Week 3-4) - ~15-20 hours
**Focus**: Task Management, Project Management

- [ ] **src/components/TaskDetailPanel.jsx**
  - Replace status badges with `StatusBadge`
  - Replace priority badge with `PriorityBadge`
  - Replace tabs with `Tabs` component
  - Replace date input with `DatePicker`
  - Replace assignee buttons with `Chip` or custom component
  - Replace label badges with `Badge`
  - Replace checkbox toggles with `Checkbox`
  - Replace dropdown with `Popover` or `Dropdown`

- [ ] **src/components/CreateTaskModal.jsx**
  - Wrap entire modal with `Dialog`
  - Convert all form inputs to UI Kit Form components
  - Replace all buttons with `Button`

- [ ] **src/app/workspace/page.js** & **[projectId]/page.js**
  - Convert EditProjectModal to use `Dialog` + Form components
  - Convert AddMemberModal to use `Dialog` + Form components
  - Replace all action buttons with `Button` or `IconButton`
  - Replace project cards with `ProjectCard` or `Card`

### Phase 3: Feature Pages (Week 5-6) - ~10-15 hours
**Focus**: Analytics, Team, Settings, Time Tracking

- [ ] **src/app/workspace/team/page.js** & **[uid]/page.js**
  - Replace member cards with `TeamMemberCard` or `Card`
  - Replace action buttons with `Button` or `IconButton`
  - Replace status/role badges with `StatusBadge` or `Badge`

- [ ] **src/app/workspace/settings/page.js**
  - Convert all form inputs to UI Kit Form components
  - Replace toggle switches with `ToggleSwitch`
  - Replace buttons with `Button`
  - Replace section dividers with `Divider`

- [ ] **src/components/workspace/TimesheetTab.jsx** & **TimeTracker.jsx**
  - Replace timer buttons with `Button`
  - Replace time inputs with `Input`
  - Replace loading spinner with `LoadingSpinner`
  - Consider using `TimeLogDisplay` component

- [ ] **src/app/workspace/analytics/page.js**
  - Replace chart containers with `Card`
  - Replace tabs with `Tabs` or `ButtonGroup`
  - Replace empty states with `EmptyState` component
  - Replace loading with `LoadingSpinner`

### Phase 4: Supporting Components (Week 7) - ~5-10 hours
**Focus**: Modals, Dropdowns, Utilities

- [ ] **All Modal Components**
  - Convert custom modals to use `Dialog` component
  - Standardize form inputs across all modals

- [ ] **Dropdown/Popover Components**
  - Convert custom dropdowns to `Dropdown` or `Menu`
  - Standardize positioning and styling

- [ ] **Utility Components**
  - Replace Avatar implementations with `Avatar`
  - Standardize Toast notifications
  - Use EmptyState for all empty displays

### Phase 5: Data Display (Week 8) - ~5-10 hours
**Focus**: Kanban, Backlog, Dependencies, etc.

- [ ] **src/components/Board.jsx** & **KanbanColumn.jsx**
  - Replace task cards with `TaskCard` component
  - Replace column containers with `Card` or `Surface`
  - Replace add button with `Button`

- [ ] **Backlog & Portfolio Components**
  - Replace backlog items with `ListItem` or custom component
  - Replace badges with appropriate UI Kit badges

- [ ] **Billing & Portal Components**
  - Replace plan cards with `Card`
  - Replace CTA buttons with `Button`

- [ ] **Other Data Display**
  - Replace dependency cards with `Card`
  - Standardize badge usage throughout

---

## Breaking Changes & Considerations

### Component Prop API Changes
When migrating, ensure:
1. **Button** expects `onClick`, `variant`, `size`, `disabled`
   - Old: `className="bg-[#1f1f1f] hover:bg-[#303030]"`
   - New: `<Button variant="primary" onClick={...}>`

2. **Input** expects `value`, `onChange`, `placeholder`, `type`
   - Old: `className="bg-[#f7f7f7] border border-[#e9e9e9]"`
   - New: `<Input value={...} onChange={...} />`

3. **Dialog** replaces custom modal `<div>`
   - Old: Manual z-index, backdrop, positioning
   - New: Built-in overlay, keyboard handling, animations

4. **Form Components** should be wrapped with `FormGroup`
   - Old: Loose `<input>` elements
   - New: `<FormGroup><Input /></FormGroup>`

5. **Badges** use predefined variants instead of inline colors
   - Old: `style={{ color: priority.color, background: ... }}`
   - New: `<StatusBadge status="critical" />` or similar

### Theme Consistency
- All hardcoded colors (`#1f1f1f`, `#f7f7f7`, `#e9e9e9`, `#9a9a9a`, `#cfcfcf`) should come from theme
- Spacing values (px-[14px], py-[10px]) should use standard scale
- Border radius (rounded-[12px], rounded-[24px]) should use predefined values
- Shadow values should use theme elevation system

### Performance Considerations
- No breaking changes expected for performance
- Slightly smaller bundle size due to component reuse
- Possible improvement in rendering due to memoization in UI Kit components

---

## File-by-File Migration Status

### Top-Level Pages (20 files)

| Page | Status | Buttons | Inputs | Cards | Badges | Loading | Error | Empty | Priority |
|------|--------|---------|--------|-------|--------|---------|-------|-------|----------|
| /workspace | ⬜ | 12 | 3 | 5 | 2 | 1 | 1 | 2 | HIGH |
| /workspace/[projectId] | ⬜ | 18 | 4 | 8 | 3 | 2 | 2 | 3 | HIGH |
| /workspace/my | ⬜ | 8 | 2 | 4 | 2 | 1 | 1 | 2 | HIGH |
| /workspace/chat | ⬜ | 6 | 2 | 3 | 1 | 1 | 1 | 1 | MEDIUM |
| /workspace/team | ⬜ | 10 | 2 | 6 | 3 | 1 | 1 | 2 | MEDIUM |
| /workspace/team/[uid] | ⬜ | 5 | 1 | 3 | 2 | 0 | 1 | 1 | MEDIUM |
| /workspace/analytics | ⬜ | 8 | 1 | 4 | 2 | 2 | 1 | 3 | MEDIUM |
| /workspace/settings | ⬜ | 6 | 4 | 2 | 1 | 0 | 1 | 1 | MEDIUM |
| /workspace/sprints | ⬜ | 7 | 1 | 4 | 2 | 1 | 1 | 2 | MEDIUM |
| /workspace/[projectId]/issue/[issueId] | ⬜ | 12 | 2 | 5 | 3 | 1 | 1 | 2 | HIGH |
| /workspace/[projectId]/task/[taskId] | ⬜ | 10 | 3 | 4 | 2 | 1 | 1 | 2 | HIGH |
| /workspace/[projectId]/portal | ⬜ | 5 | 1 | 3 | 1 | 0 | 1 | 1 | MEDIUM |
| /workspace/[projectId]/reports | ⬜ | 6 | 1 | 4 | 2 | 1 | 1 | 2 | MEDIUM |
| /login | ⬜ | 1 | 0 | 0 | 0 | 1 | 1 | 0 | CRITICAL |
| /onboarding | ⬜ | 4 | 6 | 2 | 1 | 1 | 1 | 1 | CRITICAL |
| /ui-kit | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | DONE |
| /ui-kit-editor | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | DONE |
| / | ⬜ | 1 | 0 | 1 | 0 | 0 | 0 | 0 | LOW |
| /api/* | ✅ | N/A | N/A | N/A | N/A | N/A | N/A | N/A | DONE |

### Root Components (95 files)

#### Critical Components (10 files)
| Component | Status | Buttons | Inputs | Cards | Badges | Priority |
|-----------|--------|---------|--------|-------|--------|----------|
| TaskDetailPanel.jsx | ⬜ | 14 | 2 | 1 | 8 | CRITICAL |
| CreateTaskModal.jsx | ⬜ | 16 | 4 | 2 | 6 | CRITICAL |
| WorkspaceHeader.jsx | ⬜ | 12 | 2 | 3 | 2 | CRITICAL |
| WorkspaceSidebar.jsx | ⬜ | 8 | 0 | 1 | 0 | CRITICAL |
| Dialog.jsx | ✅ | - | - | - | - | DONE |
| UserAvatar.jsx | ⬜ | 0 | 0 | 0 | 0 | HIGH |
| SearchModal.jsx | ⬜ | 4 | 1 | 2 | 1 | HIGH |
| TaskInternalChat.jsx | ⬜ | 6 | 1 | 1 | 2 | HIGH |
| OrgSwitcherScreen.jsx | ⬜ | 8 | 1 | 2 | 1 | HIGH |
| Toast.jsx | ⬜ | 2 | 0 | 1 | 0 | HIGH |

#### Workspace Feature Components (25 files)
| Component | Status | Buttons | Inputs | Priority |
|-----------|--------|---------|--------|----------|
| AnalyticsTab.jsx | ⬜ | 6 | 1 | HIGH |
| BillingTab.jsx | ⬜ | 5 | 1 | MEDIUM |
| TimesheetTab.jsx | ⬜ | 4 | 2 | MEDIUM |
| TimeTracker.jsx | ⬜ | 6 | 3 | MEDIUM |
| BoardConfigModal.jsx | ⬜ | 8 | 4 | HIGH |
| IssueModal.jsx | ⬜ | 10 | 5 | HIGH |
| IssueDetail.jsx | ⬜ | 12 | 3 | HIGH |
| AgileBoard.jsx | ⬜ | 7 | 1 | MEDIUM |
| BacklogTab.jsx | ⬜ | 5 | 1 | MEDIUM |
| KanbanColumn.jsx | ⬜ | 4 | 1 | MEDIUM |
| Board.jsx | ⬜ | 6 | 0 | MEDIUM |
| CardModal.jsx | ⬜ | 8 | 3 | MEDIUM |
| DependenciesPanel.jsx | ⬜ | 4 | 0 | LOW |
| EpicsPanel.jsx | ⬜ | 5 | 1 | LOW |
| MaterialsTab.jsx | ⬜ | 3 | 1 | LOW |
| NotificationsPanel.jsx | ⬜ | 4 | 0 | LOW |
| PortalPanel.jsx | ⬜ | 3 | 1 | LOW |
| ProjectTeamTab.jsx | ⬜ | 5 | 2 | MEDIUM |
| VelocityTab.jsx | ⬜ | 2 | 0 | LOW |
| WorkloadTab.jsx | ⬜ | 3 | 1 | LOW |
| UnifiedTimeline.jsx | ⬜ | 4 | 0 | LOW |
| MessageContent.jsx | ⬜ | 2 | 0 | LOW |
| Others (5 files) | ⬜ | ~15 | ~3 | VARIOUS |

#### UI/Utility Components (60 files)
| Component | Status | Purpose | Notes |
|-----------|--------|---------|-------|
| UI Kit Components (25) | ✅ | Already UI Kit | These are the target components |
| Markdown Editor | ⬜ | Editing | Replace toolbar buttons |
| Markdown Viewer | ⬜ | Display | Minimal changes needed |
| Task Card | ⬜ | Task display | Could extend TaskCard |
| Kanban Board | ⬜ | Board view | Use TaskCard component |
| Client Project Viewer | ⬜ | Portal | Low priority |
| Auto Fix | ⬜ | Utility | Low priority |
| Others (30 files) | ⬜ | Various | Lower priority utilities |

---

## Quality Assurance Checklist

### For Each Migrated Component
- [ ] All styling is applied through UI Kit component props
- [ ] No inline `className` with hardcoded colors/sizing
- [ ] Form inputs wrapped with `FormGroup` for consistency
- [ ] Error messages use `Alert` component
- [ ] Loading states use `LoadingSpinner`
- [ ] Empty states use `EmptyState`
- [ ] Buttons use proper `Button` variants and sizes
- [ ] Modals use `Dialog` component with proper ARIA
- [ ] Dropdown/popover interactions use `Dropdown` or `Menu`
- [ ] Status/priority badges use appropriate badge components
- [ ] All props match UI Kit component API
- [ ] No breaking changes to parent component interfaces

### Browser Testing
- [ ] Desktop (Chrome, Firefox, Safari, Edge)
- [ ] Mobile (iOS Safari, Chrome Android)
- [ ] Dark mode (if applicable)
- [ ] Accessibility (keyboard nav, screen readers, ARIA)
- [ ] Performance (bundle size, render time)

### Regression Testing
- [ ] All existing features work identically
- [ ] All keyboard shortcuts still work
- [ ] All form submissions work
- [ ] All modal dialogs function correctly
- [ ] All animations/transitions smooth
- [ ] Z-index layers correct (overlays, popovers)

---

## Effort Estimation

### By Component Category

| Category | Component Count | Files Affected | Estimated Hours | Difficulty |
|----------|-----------------|----------------|-----------------|------------|
| Authentication | 2 | 2 | 3-4 | Easy |
| Layout/Navigation | 2 | 2 | 5-6 | Easy |
| Form Inputs | 41 | 25 | 8-10 | Easy |
| Buttons | 171 | 40 | 15-20 | Easy |
| Cards/Panels | 58 | 20 | 5-8 | Easy |
| Badges/Status | 605 | 35 | 12-18 | Medium |
| Modals/Dialogs | 15 | 12 | 8-12 | Medium |
| Dropdowns | 20 | 10 | 6-8 | Medium |
| Loading States | 13 | 8 | 3-4 | Easy |
| Error Messages | 32 | 15 | 4-5 | Easy |
| Empty States | 52 | 12 | 5-7 | Easy |
| Advanced Features | 150+ | 30 | 10-15 | Hard |

**Total Estimated Effort**: 84-117 hours (11-15 weeks at 8 hrs/week)

**Actual Timeline Recommendation**: 
- With 2 developers: 5-7 weeks
- With 1 developer: 10-14 weeks
- Recommended: Allocate 2 devs, 1 week per phase + 1 week QA

---

## Risk Assessment

### Low Risk
- Replacing `<button>` with `Button` component (styling only)
- Replacing `<input>` with `Input` component (props mapping clear)
- Replacing inline divs with `Card` component (layout only)
- Replacing custom spinners with `LoadingSpinner` (UX improvement)

### Medium Risk
- Replacing custom modals with `Dialog` (event handling, focus management)
- Replacing custom dropdowns with `Dropdown` (positioning, keyboard nav)
- Converting badge styling to component variants (color mapping)
- Converting form inputs to `FormGroup` wrapper (validation, layout)

### High Risk
- None identified (changes are mostly cosmetic and well-scoped)

### Mitigation
- Create feature branch for each phase
- Comprehensive testing after each phase
- Backup current implementation in git
- Gradual rollout to staging first
- Monitor for regression in production

---

## Success Criteria

### 100% Adoption Achieved When:
1. ✅ All pages use UI Kit components for layout
2. ✅ All buttons replaced with `Button` component (0 raw `<button>` elements)
3. ✅ All form inputs use UI Kit form components (0 raw `<input>` elements)
4. ✅ All cards/panels use `Card` or `Panel` component
5. ✅ All status indicators use appropriate badge components
6. ✅ All modals use `Dialog` component
7. ✅ All loading states use `LoadingSpinner`
8. ✅ All error messages use `Alert`
9. ✅ All empty states use `EmptyState`
10. ✅ No hardcoded colors or sizing in component files
11. ✅ All tests passing (no regressions)
12. ✅ Bundle size stable or reduced
13. ✅ Accessibility audit passing
14. ✅ Visual regression testing complete

### Current Progress: 0% (0 of 1,042 elements migrated)

---

## Next Steps

1. **Review This Checklist** with the team
2. **Prioritize Phases** based on business needs and resource availability
3. **Create Implementation Plan** with sprint assignments
4. **Start with Phase 1** (Critical paths) to establish patterns
5. **Document Component Usage** as you migrate for reusability
6. **Run Accessibility Audits** during migration
7. **Keep CLAUDE.md Updated** with UI Kit migration progress

---

## References

### UI Kit Documentation
- All components exported from: `src/components/ui/index.js`
- Component implementations: `src/components/ui/*` directories
- Available variants and props: Check individual component files

### Related Files
- ESLint config: `eslint.config.mjs`
- Tailwind config: `tailwind.config.ts`
- Path aliases: `jsconfig.json`
- Global styles: `src/app/globals.css`

### Testing Resources
- Lighthouse: Run accessibility/performance audits
- Chrome DevTools: Test responsive design and accessibility
- Jest: Unit test component migrations
- Playwright: E2E test user flows

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-28  
**Maintained By**: QuickTeam Dev Team  
**Status**: Active - Ready for Implementation
