# UI Kit Migration - Quick Reference Guide

## One-Pagers by Element Type

### Buttons - 171 elements to migrate

**Current**: Raw `<button>` with inline `className`
```jsx
<button onClick={handleClick} className="bg-[#1f1f1f] hover:bg-[#303030] rounded-[12px] px-4 py-2 text-white">
  Click me
</button>
```

**Target**: Use `Button` component
```jsx
import { Button } from '@/components/ui';

<Button onClick={handleClick} variant="primary" size="md">
  Click me
</Button>
```

**Available Button Variants**:
- `primary` — Dark button (primary action)
- `secondary` — Light button (secondary action)
- `outline` — Bordered button
- `text` — Text-only button
- `icon` — Icon button (no padding)

**Also Available**:
- `IconButton` — Icon-only, circular
- `ButtonGroup` — Multiple buttons
- `SplitButton` — Button with dropdown

---

### Form Inputs - 41 elements to migrate

**Current**: Raw `<input>` with inline styling
```jsx
<input 
  type="text"
  value={value}
  onChange={e => setValue(e.target.value)}
  placeholder="Enter text..."
  className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f]"
/>
```

**Target**: Use `Input` component with `FormGroup`
```jsx
import { Input, FormGroup } from '@/components/ui';

<FormGroup label="Name" error={error}>
  <Input 
    value={value}
    onChange={e => setValue(e.target.value)}
    placeholder="Enter text..."
  />
</FormGroup>
```

**Input Types**:
- `Input` — Text input
- `Textarea` — Multi-line input
- `SearchInput` — Search field
- `DatePicker` — Date picker
- `TimePicker` — Time picker
- `FileInput` — File upload
- `Checkbox` — Checkbox
- `RadioButton` — Radio button
- `ToggleSwitch` — Toggle
- `Select` — Dropdown select

---

### Cards/Panels - 58 elements to migrate

**Current**: Raw `<div>` with inline card styling
```jsx
<div className="bg-white rounded-[12px] shadow-sm border border-[#e9e9e9] p-4">
  Content here
</div>
```

**Target**: Use `Card` component
```jsx
import { Card } from '@/components/ui';

<Card>
  Content here
</Card>
```

**Card Variations**:
- `Card` — Standard card with padding
- `Surface` — Themed surface
- `Panel` — Panel container
- `Container` — Content wrapper

**Also Useful**:
- `Stack` — Flexbox container with spacing
- `Flex` — Flexbox with options
- `Grid` — Grid layout
- `Spacer` — Vertical/horizontal spacing

---

### Badges & Status - 605 elements to migrate

**Current**: Inline `<span>` with hardcoded colors
```jsx
<span 
  className="text-[11px] font-bold px-2 py-1 rounded-full"
  style={{ 
    color: priority.color, 
    background: priority.color + '18' 
  }}
>
  {priority.label}
</span>
```

**Target**: Use Badge components
```jsx
import { Badge, StatusBadge, PriorityBadge } from '@/components/ui';

// For status
<StatusBadge status="in-progress" />

// For priority
<PriorityBadge priority="high" />

// For custom badges
<Badge variant="info">Custom Label</Badge>
```

**Badge Types**:
- `Badge` — Generic badge (color variants)
- `StatusBadge` — Status indicator (todo, in-progress, review, done)
- `PriorityBadge` — Priority level (low, medium, high, critical)
- `Tag` — Tag component
- `Chip` — Small chip/tag with optional close

---

### Modals/Dialogs - 15 elements to migrate

**Current**: Custom overlay with hardcoded positioning
```jsx
<div className="fixed inset-0 bg-black/30 z-50">
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[520px]">
      {/* Modal content */}
    </div>
  </div>
</div>
```

**Target**: Use `Dialog` component
```jsx
import { Dialog } from '@/components/ui';

<Dialog isOpen={isOpen} onClose={onClose} title="Dialog Title">
  {/* Content here */}
</Dialog>
```

**Dialog Features**:
- Built-in overlay
- Keyboard handling (ESC to close)
- Focus management
- Accessibility (ARIA)
- Smooth animations
- Responsive sizing

---

### Loading States - 13 elements to migrate

**Current**: Custom spinner animation
```jsx
<div className="w-8 h-8 border-4 border-[#e9e9e9] border-t-[#1f1f1f] rounded-full animate-spin" />
```

**Target**: Use `LoadingSpinner` component
```jsx
import { LoadingSpinner } from '@/components/ui';

<LoadingSpinner size="md" />
```

**Spinner Sizes**:
- `sm` — 16px
- `md` — 24px (default)
- `lg` — 32px
- `xl` — 48px

---

### Error Messages - 32 elements to migrate

**Current**: Raw text or inline error styling
```jsx
{error && <p className="text-red-500 text-sm">{error}</p>}
```

**Target**: Use `Alert` component
```jsx
import { Alert } from '@/components/ui';

{error && <Alert variant="error">{error}</Alert>}
```

**Alert Variants**:
- `error` — Error message (red)
- `warning` — Warning (orange)
- `info` — Information (blue)
- `success` — Success (green)

**Alert Features**:
- Built-in icons
- Dismissible option
- Title support
- Proper semantic HTML

---

### Empty States - 52 elements to migrate

**Current**: Simple text message
```jsx
{items.length === 0 && <p className="text-[#9a9a9a]">No items found</p>}
```

**Target**: Use `EmptyState` component
```jsx
import { EmptyState } from '@/components/ui';

{items.length === 0 && (
  <EmptyState 
    title="No items"
    description="Create your first item to get started"
    action={{ label: 'Create', onClick: onCreateNew }}
  />
)}
```

**EmptyState Features**:
- Title and description
- Optional icon
- Call-to-action button
- Consistent styling
- Better UX

---

### Dropdowns/Popovers - 20 elements to migrate

**Current**: Custom positioned `<div>` with manual z-index
```jsx
{showDropdown && (
  <>
    <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
    <div className="absolute top-full left-0 mt-1 bg-white border rounded-[12px] shadow-lg z-20">
      {/* Items */}
    </div>
  </>
)}
```

**Target**: Use `Dropdown` or `Menu` component
```jsx
import { Dropdown } from '@/components/ui';

<Dropdown 
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete }
  ]}
  trigger={<Button>Options</Button>}
/>
```

**Alternatives**:
- `Dropdown` — Dropdown menu
- `Menu` — Context menu
- `Popover` — Popover container

---

## Common Migration Patterns

### Pattern 1: Simple Button Replacement
**Before**:
```jsx
<button onClick={save} className="bg-[#1f1f1f] hover:bg-[#303030] rounded-[12px] px-4 py-2 text-white font-bold">
  Save
</button>
```

**After**:
```jsx
<Button onClick={save} variant="primary">Save</Button>
```

---

### Pattern 2: Form with Validation
**Before**:
```jsx
<div>
  <label className="text-xs font-bold text-[#9a9a9a]">Email</label>
  <input
    type="email"
    value={email}
    onChange={e => setEmail(e.target.value)}
    className="w-full px-3 py-2 bg-[#f7f7f7] rounded-[12px] border border-[#e9e9e9] focus:border-[#1f1f1f]"
  />
  {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
</div>
```

**After**:
```jsx
<FormGroup label="Email" error={error}>
  <Input
    type="email"
    value={email}
    onChange={e => setEmail(e.target.value)}
  />
</FormGroup>
```

---

### Pattern 3: Status Indicator
**Before**:
```jsx
<span 
  className="text-xs font-bold px-2 py-1 rounded-full"
  style={{ 
    color: status === 'done' ? '#10b981' : '#f97316',
    background: status === 'done' ? '#10b98118' : '#f9731618'
  }}
>
  {status === 'done' ? 'Done' : 'In Progress'}
</span>
```

**After**:
```jsx
<StatusBadge status={status} />
```

---

### Pattern 4: Modal with Form
**Before**:
```jsx
<div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
  <div className="bg-white rounded-[24px] w-full max-w-[520px]">
    <div className="px-6 py-5 border-b">
      <h2>Add Item</h2>
    </div>
    <div className="p-6">
      <input type="text" className="..." placeholder="Name" />
    </div>
    <div className="flex gap-2 px-6 pb-6">
      <button onClick={onCancel} className="...">Cancel</button>
      <button onClick={onSave} className="...">Save</button>
    </div>
  </div>
</div>
```

**After**:
```jsx
<Dialog 
  isOpen={isOpen} 
  onClose={onCancel}
  title="Add Item"
>
  <FormGroup label="Name">
    <Input value={name} onChange={e => setName(e.target.value)} />
  </FormGroup>
  <div className="flex gap-2 mt-6">
    <Button onClick={onCancel} variant="secondary">Cancel</Button>
    <Button onClick={onSave} variant="primary">Save</Button>
  </div>
</Dialog>
```

---

### Pattern 5: Card with Actions
**Before**:
```jsx
<div className="bg-white rounded-[12px] shadow border border-[#e9e9e9] p-4">
  <h3 className="font-bold mb-2">{title}</h3>
  <p className="text-sm text-[#9a9a9a] mb-4">{description}</p>
  <button className="bg-[#1f1f1f] text-white rounded-[8px] px-3 py-1 text-sm">
    View
  </button>
</div>
```

**After**:
```jsx
<Card>
  <h3 className="font-bold mb-2">{title}</h3>
  <p className="text-sm text-[#9a9a9a] mb-4">{description}</p>
  <Button onClick={onView} size="sm">View</Button>
</Card>
```

---

## Files to Update - Priority Order

### CRITICAL (Update First)
1. `src/app/login/page.js` — Login/auth
2. `src/app/onboarding/page.js` — Onboarding
3. `src/components/WorkspaceHeader.jsx` — Navigation
4. `src/components/WorkspaceSidebar.jsx` — Navigation
5. `src/components/TaskDetailPanel.jsx` — Core feature
6. `src/components/CreateTaskModal.jsx` — Core feature

### HIGH (Update Second)
7. `src/app/workspace/page.js` — Project dashboard
8. `src/app/workspace/[projectId]/page.js` — Project page
9. `src/components/workspace/BoardConfigModal.jsx` — Modals
10. `src/components/workspace/IssueModal.jsx` — Modals

### MEDIUM (Update Third)
- All workspace feature tabs (Analytics, Billing, Time, etc.)
- Team management pages
- Settings pages

### LOW (Update Last)
- Utility components
- Data display components
- Portal/billing pages

---

## Testing Checklist per File

For each file migrated:
- [ ] All buttons work and are properly styled
- [ ] All form inputs accept input correctly
- [ ] All modals open/close properly
- [ ] All dropdowns position correctly
- [ ] Error messages display with proper styling
- [ ] Loading states show spinners correctly
- [ ] Empty states display properly
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Mobile responsive design maintained
- [ ] Accessibility passes (a11y audit)
- [ ] No console errors or warnings
- [ ] Page load time unchanged or improved

---

## Component Import Syntax

All UI Kit components are imported from a single barrel export:

```jsx
// Correct ✅
import { Button, Input, Card, Badge } from '@/components/ui';

// Incorrect ❌
import Button from '@/components/ui/Button/Button.jsx';
import Input from '@/components/ui/Forms/Input.jsx';
```

This keeps imports clean and makes refactoring easier.

---

## Tips for Efficient Migration

### Tip 1: Use Find & Replace
Many components can be migrated using find & replace:

```
Find: className="[^"]*\bbg-\[\#1f1f1f\][^"]*"[^>]*<button
Replace: <Button variant="primary"
```

### Tip 2: Batch Similar Components
Migrate similar elements together:
- All buttons at once
- All form inputs at once
- All badges at once

### Tip 3: Create Feature Branch
One PR per phase to keep changes manageable:
```bash
git checkout -b ui-kit/phase-1-auth
```

### Tip 4: Reference Working Examples
Look at existing UI Kit usage in:
- `src/app/ui-kit/page.js` — Showroom
- `src/components/ui/*` — Component implementations

### Tip 5: Keep Git History Clean
Use atomic commits for easy rollback:
```bash
git commit -m "refactor: migrate login buttons to Button component"
git commit -m "refactor: migrate login form inputs to Input component"
```

---

## Common Mistakes to Avoid

### ❌ Don't
```jsx
import Button from '@/components/ui/Button/Button.jsx';  // Wrong path
<Button className="..." />  // UI Kit Button doesn't need extra styling
<button className="...">Click</button>  // Use Button component instead
<input className="..." />  // Use Input component instead
<div className="bg-white rounded-[12px]">  // Use Card instead
```

### ✅ Do
```jsx
import { Button } from '@/components/ui';  // Correct import
<Button variant="primary" size="md">Click</Button>  // Use component props
<Button variant="primary">Click</Button>  // Component handles styling
<Input placeholder="..." />  // Input component
<Card>Content</Card>  // Use Card component
```

---

## Help & Support

### Can't Find a Component?
Check `src/components/ui/index.js` for complete list of exported components.

### Component Not Behaving Right?
- Check the component file: `src/components/ui/ComponentName.jsx`
- Look for prop definitions and usage examples
- Check tests for usage patterns

### Need to Customize?
- Check if UI Kit component has variant prop
- Check if UI Kit component accepts custom className
- If not available, consider extending the component

### Questions?
Refer to:
1. `UI_KIT_MIGRATION_CHECKLIST.md` — Full audit
2. `src/app/ui-kit/page.js` — Component showroom
3. Component source code — Real implementation

---

## Metrics to Track

### Progress Tracking
- Elements migrated per week
- Files completed per phase
- Bundle size changes
- Performance metrics (LCP, FID, CLS)

### Quality Metrics
- Test coverage maintained/improved
- Accessibility score (Lighthouse)
- No new console errors
- User complaints/issues

### Team Metrics
- Estimation accuracy
- Actual vs planned hours
- Blocking issues
- Code review turnaround

---

**Keep this reference handy while migrating!**

For detailed information, see: `UI_KIT_MIGRATION_CHECKLIST.md`
