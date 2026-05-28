# UI Kit Quick Reference

## Component Imports

```jsx
import PageLayout from '@/components/ui/PageLayout';
import Tabs from '@/components/ui/Tabs';
import Surface from '@/components/ui/Surface';
import Stack from '@/components/ui/Stack';
import Spacer from '@/components/ui/Spacer';
import Dialog from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, MultiSelect } from '@/components/ui/Select';
```

## Component Cheat Sheet

### PageLayout
```jsx
<PageLayout header={<div>Header here</div>}>
  Content with white bg and px-8 padding
</PageLayout>
```

### Button
```jsx
<Button variant="primary" size="lg">Primary 36px</Button>
<Button variant="secondary" size="md">Secondary 32px</Button>
<Button variant="primary" size="sm">Small 28px</Button>
<Button variant="ghost">Ghost variant</Button>
<Button icon={PlusIcon}>With icon</Button>
<Button icon={PlusIcon} size="lg">Text + Icon</Button>
```

### Input
```jsx
<Input placeholder="Enter text..." />
<Input placeholder="..." icon={SearchIcon} />
<Input error="Error message" />
```

### Select
```jsx
<Select 
  value={selected}
  onChange={setSelected}
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
  ]}
/>
```

### Tabs
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

### Surface
```jsx
<Surface variant="card" padding="lg">Card Content</Surface>
<Surface variant="panel" padding="lg">Panel Content</Surface>
<Surface variant="light" padding="lg">Light Content</Surface>
```

### Stack
```jsx
<Stack direction="horizontal" gap="md">
  <div>Item 1</div>
  <div>Item 2</div>
</Stack>

<Stack direction="vertical" gap="lg">
  <div>Item 1</div>
  <div>Item 2</div>
</Stack>
```

### Spacer
```jsx
<Spacer size="md" direction="vertical" />
<Spacer size="lg" direction="horizontal" />
```

### Dialog
```jsx
<Dialog 
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  size="md"
>
  Content here
</Dialog>
```

## Sizing Rules

### Button Heights (STRICT)
```
Primary (lg):    36px  ← DEFAULT
Action (md):     32px
Small (sm):      28px
Icon:            32px
```

### Control Heights (STRICT)
```
Input:           36px (h-9)
Select:          36px (h-9)
Tabs:            32px
```

### Typography (STRICT)
```
h1:    24px bold      (page title)
h2:    18px bold      (section title)
h3:    16px bold
body:  14px semibold
small: 13px semibold
xs:    12px semibold
label: 11px bold
tag:    9px bold
```

### Spacing (STRICT)
```
Page padding:    32px (px-8) — ALWAYS
Section gaps:    24px
Component gaps:  8px, 12px, 16px
Surface radius:  16px (rounded-2xl)
```

## Color Quick Reference

### Semantic Colors
```
Dark text:       #1f1f1f
Muted text:      #9a9a9a
Inactive:        #cfcfcf
Light bg:        #f7f7f7
White surface:   #ffffff
Primary border:  #e9e9e9
```

### Status Colors
```
Success:  #10b981
Warning:  #eab308
Danger:   #ef4444
Error:    #f97316
Info:     #6366f1
Cyan:     #0891b2
Purple:   #7c3aed
```

## Common Patterns

### Form Row (All 36px)
```jsx
<Stack direction="horizontal" gap="md">
  <Input placeholder="..." className="flex-1" />
  <Button size="lg">Submit</Button>
</Stack>
```

### Button Group
```jsx
<Stack direction="horizontal" gap="md">
  <Button variant="primary" size="lg" className="flex-1">Save</Button>
  <Button variant="secondary" size="md" className="flex-1">Cancel</Button>
</Stack>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <Surface key={item.id} variant="panel" padding="lg">
      <h3 className="text-[14px] font-bold">{item.title}</h3>
    </Surface>
  ))}
</div>
```

### Page with Header
```jsx
<PageLayout 
  header={
    <div className="px-[32px] py-[20px] flex items-center justify-between">
      <h1 className="text-[24px] font-bold">Title</h1>
      <Button size="lg" icon={Plus}>Action</Button>
    </div>
  }
>
  {/* Page content */}
</PageLayout>
```

## DON'Ts

❌ Don't hardcode button heights:
```jsx
<button className="h-[40px]">❌ Wrong height</button>
```

✅ Use Button component:
```jsx
<Button size="lg">✅ Correct</Button>
```

---

❌ Don't use arbitrary padding:
```jsx
<div className="px-[40px]">❌ Wrong padding</div>
```

✅ Use PageLayout or Surface:
```jsx
<PageLayout><div>✅ Correct px-8 padding</div></PageLayout>
```

---

❌ Don't mix input and button heights:
```jsx
<div className="flex gap-2">
  <input className="h-[32px]" /> {/* ❌ 32px */}
  <button className="h-[36px]">❌ Misaligned</button>
</div>
```

✅ Use UI Kit components:
```jsx
<Stack direction="horizontal" gap="md">
  <Input /> {/* ✅ 36px */}
  <Button size="lg">✅ 36px - Perfect alignment</Button>
</Stack>
```

---

❌ Don't create custom spacing:
```jsx
<div className="gap-[14px]">❌ Non-standard</div>
```

✅ Use spacing tokens:
```jsx
<Stack gap="md"> {/* 12px - from tokens */}
```

## Typography Classes

```jsx
{/* Page titles */}
<h1 className="text-[24px] font-bold">Title</h1>

{/* Section titles */}
<h2 className="text-[18px] font-bold">Section</h2>

{/* Subsection */}
<h3 className="text-[16px] font-bold">Subsection</h3>

{/* Body text */}
<p className="text-[14px] font-semibold">Body</p>

{/* Small text */}
<span className="text-[13px] font-semibold">Small</span>

{/* Labels */}
<label className="text-[11px] font-bold">Label</label>

{/* Muted text */}
<span className="text-[#9a9a9a]">Muted</span>
```

## Access UI Kit

```
http://localhost:3000/ui-kit
```

Tabs:
- Buttons — See all button sizes and variants
- Inputs — View input field states
- Colors — Review color palette
- Layouts — Check spacing and surfaces

## Resources

- **Migration Guide**: `UI_KIT_MIGRATION_GUIDE.md`
- **Summary**: `UI_KIT_IMPLEMENTATION_SUMMARY.md`
- **Example**: `src/components/workspace/ExamplePageTemplate.jsx`
- **Tokens**: `src/lib/design/tokens.js`

---

**Remember**: Consistency is key! Use the UI Kit components instead of hardcoding styles.
