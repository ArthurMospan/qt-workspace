# UI Kit Migration Guide

## Overview

The UI Kit has been successfully implemented with strict design rules to ensure consistency across all workspace pages. This guide shows how to migrate existing pages to use the new system.

## What Was Created

### 1. Design Tokens (`src/lib/design/tokens.js`)
Centralized configuration for:
- Colors (dark: #1f1f1f, light: #f7f7f7, surface: #ffffff)
- Typography (font sizes, weights)
- Spacing (4px, 8px, 12px, 16px, 20px, 24px, 32px)
- Sizing (button heights, border radius, shadows)
- Presets (common combinations)

### 2. Core UI Components

#### Dialog (`src/components/ui/Dialog.jsx`)
Modal wrapper with consistent styling
```jsx
<Dialog 
  isOpen={isOpen} 
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
>
  <div>Modal content</div>
</Dialog>
```

#### Tabs (`src/components/ui/Tabs.jsx`)
Tab navigation component
```jsx
<Tabs
  tabs={[
    { id: 'tab1', label: 'Tab 1', icon: IconComponent },
    { id: 'tab2', label: 'Tab 2' },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>
```

#### Layout Components
- **PageLayout** - Standard page wrapper (white bg, px-8 padding)
- **Surface** - Card surfaces (variants: card, panel, light)
- **Stack** - Flexbox wrapper (horizontal/vertical with gap)
- **Spacer** - Fixed spacing elements

### 3. Refactored UI Components
- **Button** - Updated default size to 36px (lg/h-9)
- **Input** - Now 36px height (h-9)
- **Select** - Button and items now 36px (h-9)

### 4. UI Kit Showcase (`src/app/ui-kit/page.js`)
Internal documentation page showing all components and design tokens
- Access at `/ui-kit` (not in user navigation)
- Reference for designers and developers

## Strict Design Rules Enforced

### Button Heights
- **Primary buttons**: 36px (h-9) — default
- **Action buttons**: 32px (h-8) — for secondary actions
- **Small buttons**: 28px (h-7) — for compact contexts
- **Default variant**: Primary (dark #1f1f1f)
- **Default size**: lg (36px) — changed from md

### Typography
- **Main headings (H1)**: 24px, bold — all page titles
- **Section headings (H2)**: 18px, bold
- **Subsection (H3)**: 16px, bold
- **Body text**: 14px, semibold
- **Small text**: 13px, semibold
- **Labels**: 11px, bold

### Layout & Spacing
- **Page padding**: 32px (px-8) — always on sides
- **Section gaps**: 24px (mb-[24px]) — between sections
- **Component gaps**: 8px, 12px, 16px — inside surfaces
- **No arbitrary padding/margins** — use spacing tokens

### Page Header Spacing
- Consistent distance from main header to page header
- Enforced via PageLayout wrapper

### Control Elements
- **Inputs**: 36px height (h-9)
- **Selects**: 36px height (h-9)
- **Tabs**: 32px height (fixed)
- **All must align horizontally** when in same row

### Surfaces
- **Content background**: White (#ffffff)
- **Logical block surfaces**: Gray (#f7f7f7)
- **Border radius**: 16px (rounded-2xl) for surfaces
- **Use Surface component** — not hardcoded styles

## Migration Pattern

### Before (Old Pattern)
```jsx
export default function OldPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white px-[20px] py-[16px] border-b">
        <h1 className="text-[32px]">Title</h1>
      </div>
      <div className="flex-1 overflow-y-auto bg-[#f7f7f7]">
        <div className="p-[20px]">
          <button className="bg-black text-white px-4 py-2">Save</button>
        </div>
      </div>
    </div>
  );
}
```

### After (New Pattern with UI Kit)
```jsx
import PageLayout from '@/components/ui/PageLayout';
import Surface from '@/components/ui/Surface';
import { Button } from '@/components/ui/Button';

export default function NewPage() {
  const header = (
    <div className="px-[32px] py-[20px]">
      <h1 className="text-[24px] font-bold">Title</h1>
    </div>
  );

  return (
    <PageLayout header={header}>
      <Surface variant="card" padding="lg">
        <Button variant="primary" size="lg">Save</Button>
      </Surface>
    </PageLayout>
  );
}
```

## Step-by-Step Migration

### 1. Replace Page Structure
```jsx
// OLD: Manual layout structure
<div className="flex-1 flex flex-col">
  <div className="bg-white border-b">Header</div>
  <div className="overflow-y-auto bg-[#f7f7f7]">Content</div>
</div>

// NEW: Use PageLayout
import PageLayout from '@/components/ui/PageLayout';

<PageLayout header={<YourHeader />}>
  {children}
</PageLayout>
```

### 2. Replace Hardcoded Buttons
```jsx
// OLD: Custom sizing
<button className="h-[36px] px-[20px] bg-[#1f1f1f]">Save</button>
<button className="h-[32px] px-[16px] bg-[#f5f5f5]">Cancel</button>

// NEW: Use Button component
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="lg">Save</Button>
<Button variant="secondary" size="md">Cancel</Button>
```

### 3. Replace Hardcoded Inputs
```jsx
// OLD: Custom input styling
<input className="bg-[#f7f7f7] rounded-[12px] py-[8px]" />

// NEW: Use Input component
import { Input } from '@/components/ui/Input';

<Input placeholder="..." />
```

### 4. Replace Card/Surface Elements
```jsx
// OLD: Hardcoded card styling
<div className="bg-white rounded-[12px] border border-[#e9e9e9] p-[16px]">
  Content
</div>

// NEW: Use Surface component
import Surface from '@/components/ui/Surface';

<Surface variant="card" padding="lg">
  Content
</Surface>
```

### 5. Use Stack for Layout
```jsx
// OLD: Manual flexbox
<div className="flex gap-[8px]">
  <button>Button 1</button>
  <button>Button 2</button>
</div>

// NEW: Use Stack component
import Stack from '@/components/ui/Stack';

<Stack direction="horizontal" gap="md">
  <button>Button 1</button>
  <button>Button 2</button>
</Stack>
```

## Common Patterns

### Button Row (Align with Form Fields)
All elements are 36px height:
```jsx
<Stack direction="horizontal" gap="md">
  <Input placeholder="..." />
  <Button size="lg">Submit</Button>
</Stack>
```

### Form Section
```jsx
<Surface variant="card" padding="lg">
  <Stack direction="vertical" gap="lg">
    <div>
      <label className="text-[11px] font-bold">Label</label>
      <Input placeholder="..." />
    </div>
    <Stack direction="horizontal" gap="md">
      <Button size="lg" variant="primary" className="flex-1">Save</Button>
      <Button size="md" variant="secondary" className="flex-1">Cancel</Button>
    </Stack>
  </Stack>
</Surface>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <Surface key={item.id} variant="panel" padding="lg">
      <h3 className="text-[14px] font-bold">{item.title}</h3>
      <p className="text-[13px] text-[#9a9a9a]">{item.description}</p>
    </Surface>
  ))}
</div>
```

## Pages Ready for Migration

Priority order:
1. `/workspace` — home page
2. `/workspace/my` — my tasks
3. `/workspace/chat` — chat
4. `/workspace/team` — team
5. `/workspace/settings` — settings
6. `/workspace/analytics` — analytics
7. `/workspace/[projectId]` — project board (most complex)

## Testing the Changes

### Visual Verification
1. Page uses white background (✓)
2. Sidebar is gray (#f7f7f7) (✓)
3. Content padding is 32px on sides (✓)
4. All buttons are 36px or 32px only (✓)
5. All inputs are 36px (✓)
6. Surfaces use 16px radius (✓)
7. Typography matches scale (✓)

### Dev Tools
Access `/ui-kit` page to verify:
- All components display correctly
- All variants work as expected
- Colors are accurate
- Spacing is consistent

## Gradual Migration Strategy

You don't need to update all pages at once. The UI Kit is backward compatible:

1. **Week 1**: Update critical pages (home, my tasks, settings)
2. **Week 2**: Update workspace components
3. **Week 3**: Update complex pages ([projectId], chat)
4. **Ongoing**: New pages automatically use UI Kit pattern

## Reference Implementation

See `src/components/workspace/ExamplePageTemplate.jsx` for a complete working example of the UI Kit pattern.

## Support & Troubleshooting

### Button sizes not working?
Ensure you're using the Button component from `@/components/ui/Button`, not custom button elements.

### Spacing looks off?
Check that you're using px-[32px] (px-8) for page padding, not custom values.

### Components not appearing?
Verify imports:
```jsx
import PageLayout from '@/components/ui/PageLayout';
import Surface from '@/components/ui/Surface';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import Tabs from '@/components/ui/Tabs';
import Dialog from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, MultiSelect } from '@/components/ui/Select';
```

## Next Steps

1. ✅ UI Kit foundation created
2. ✅ Components refactored to enforce strict heights
3. ✅ Design tokens centralized
4. ⏳ Gradually migrate workspace pages to new pattern
5. ⏳ Test all pages for visual consistency
6. ⏳ Update documentation as needed

All components are production-ready. Start migrating pages following the patterns above.
