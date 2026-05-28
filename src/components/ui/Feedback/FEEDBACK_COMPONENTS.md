# Feedback Components

A suite of 4 feedback components for displaying user feedback, loading states, and empty states. All components use design tokens for consistency and support 200ms transitions.

## Components

### 1. Alert

Display important messages with color-coded variants and optional close action.

**Props:**
- `variant`: `'info'` | `'success'` | `'warning'` | `'error'` | `'danger'` (default: `'info'`)
- `title`: string (optional)
- `children`: ReactNode (description/content)
- `onClose`: () => void (optional, shows close button if provided)
- `className`: string (optional, additional Tailwind classes)

**Features:**
- Semantic color scheme (blue/green/orange/red)
- Icon + title + description layout
- Left border accent (4px)
- Close button (X)
- Minimum height: 36px (h-9)
- Smooth 200ms transitions

**Usage:**
```jsx
import { Alert } from '@/components/ui';

<Alert variant="success" title="Success!" onClose={() => {}}>
  Your task has been completed.
</Alert>

<Alert variant="error" title="Error">
  Something went wrong. Please try again.
</Alert>
```

---

### 2. Toast

Auto-dismissing notification that slides in from bottom-right with optional action button.

**Props:**
- `variant`: `'info'` | `'success'` | `'warning'` | `'error'` | `'loading'` (default: `'info'`)
- `message`: string
- `action`: string (optional, action button text)
- `onAction`: () => void (optional)
- `autoClose`: number (milliseconds, default: 3000, disabled if `loading`)
- `onClose`: () => void (optional)

**Features:**
- Fixed position (bottom-right, z-50)
- Icon for each variant (loading variant spins)
- Auto-dismiss after 3-5 seconds
- Optional action button
- Stacking support (absolute positioning)
- Smooth slide-in animation (slideInRight)
- Max width: 360px

**Usage:**
```jsx
import { Toast } from '@/components/ui';

<Toast
  variant="success"
  message="Task created successfully"
  action="View"
  onAction={() => navigateToTask()}
/>

<Toast variant="loading" message="Saving..." />

<Toast
  variant="error"
  message="Failed to save"
  autoClose={5000}
/>
```

---

### 3. LoadingSpinner

Animated spinning circle indicator with optional label.

**Props:**
- `size`: `'sm'` | `'md'` | `'lg'` (default: `'md'`)
- `label`: string (optional, centered below spinner)
- `className`: string (optional)

**Features:**
- Animated SVG circle with stroke dash
- Three sizes: 20px, 32px, 48px
- Smooth spin animation (1s, linear, infinite)
- Dark color (#1f1f1f)
- Optional label with muted text color
- Centered layout with flexbox

**Sizes:**
- `sm`: 20px (for compact inline use)
- `md`: 32px (default, general purpose)
- `lg`: 48px (for large loading overlays)

**Usage:**
```jsx
import { LoadingSpinner } from '@/components/ui';

<LoadingSpinner size="md" label="Loading..." />

<LoadingSpinner size="lg" />

<LoadingSpinner size="sm" className="inline-flex" />
```

---

### 4. EmptyState

Centered layout for "no results" or empty data states.

**Props:**
- `icon`: React component (optional, lucide-react icon)
- `title`: string
- `description`: string
- `action`: string (optional, button text)
- `onAction`: () => void (optional)
- `className`: string (optional)

**Features:**
- Centered vertical layout
- Icon above title (muted, 48px)
- Large title (24px bold)
- Muted description (13px)
- Optional action button (secondary blue style)
- Full padding and spacing for breathing room
- Smooth transitions

**Usage:**
```jsx
import { EmptyState } from '@/components/ui';
import { Inbox } from 'lucide-react';

<EmptyState
  icon={Inbox}
  title="No tasks yet"
  description="Create your first task to get started"
  action="Create Task"
  onAction={() => openCreateModal()}
/>

<EmptyState
  title="No search results"
  description="Try a different search term"
/>
```

---

## Design Tokens Used

All components use centralized design tokens from `@/lib/design/tokens`:

- **Colors**: status colors, semantic backgrounds, text colors
- **Sizing**: button heights, icon sizes, border radius
- **Typography**: font sizes, weights
- **Transitions**: 200ms default transition duration
- **Z-Index**: notification layer (z-50)

---

## Import Methods

**Default export (recommended):**
```jsx
import Alert from '@/components/ui/Feedback/Alert';
import Toast from '@/components/ui/Feedback/Toast';
```

**Named export:**
```jsx
import { Alert } from '@/components/ui/Feedback/Alert';
import { Alert, Toast, LoadingSpinner, EmptyState } from '@/components/ui';
```

---

## Accessibility

- Close buttons have `aria-label`
- Icons are decorative (no duplicate text)
- Buttons have focus states with ring outlines
- Loading spinner respects prefers-reduced-motion (via Tailwind)
- Text contrast meets WCAG AA standards

---

## Animation Details

- **Alert & Toast**: 200ms ease-in-out transitions for all properties
- **Toast**: slideInRight animation on mount
- **LoadingSpinner**: 1s linear infinite spin animation
- **EmptyState**: smooth 200ms transitions on property changes

---

## Example Page Usage

```jsx
import { useState } from 'react';
import { Alert, Toast, LoadingSpinner, EmptyState } from '@/components/ui';
import { Search } from 'lucide-react';

export default function DemoPage() {
  const [showAlert, setShowAlert] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="space-y-6 p-6">
      {showAlert && (
        <Alert
          variant="info"
          title="Welcome"
          onClose={() => setShowAlert(false)}
        >
          This is an informational alert.
        </Alert>
      )}

      <button onClick={() => setShowToast(true)}>
        Show Toast
      </button>
      {showToast && <Toast message="This is a toast" onClose={() => setShowToast(false)} />}

      {isLoading ? (
        <LoadingSpinner label="Loading data..." />
      ) : (
        <EmptyState
          icon={Search}
          title="No data"
          description="No results found for your query"
          action="Clear Search"
          onAction={() => {}}
        />
      )}
    </div>
  );
}
```

---

## Notes

- **Alert** minimum height is enforced via `min-h-9` (36px)
- **Toast** uses fixed positioning with z-50 (notification layer)
- **LoadingSpinner** uses SVG for crisp rendering at any size
- **EmptyState** button style is secondary blue (secondary, color="blue")
- All components export both default and named exports
