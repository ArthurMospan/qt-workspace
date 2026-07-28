// src/components/ui/index.js
// Centralized barrel export for all UI components
// This is the single source of truth for all component imports across the application

// ===== CORE LAYOUT COMPONENTS =====
export { default as Stack } from './Stack'
export { default as Spacer } from './Spacer'
export { default as Surface } from './Surface'
export { default as PageLayout } from './PageLayout'
export { default as PageContentWrapper } from './PageContentWrapper'
export { default as ImageUpload } from './ImageUpload'

// ===== FORM COMPONENTS =====
export { Input } from './Input'
export { Textarea } from './Forms/Textarea'
export { default as Checkbox } from './Forms/Checkbox'
export { default as RadioButton } from './Forms/RadioButton'
export { default as ToggleSwitch } from './Forms/ToggleSwitch'
export { Select } from './Select'
export { DatePicker } from './Forms/DatePicker'
export { TimePicker } from './Forms/TimePicker'
export { SearchInput } from './Forms/SearchInput'
export { HeaderSearch } from './Forms/HeaderSearch'
export { FileInput } from './Forms/FileInput'
export { default as Label } from './Forms/Label'
export { default as FormGroup } from './Forms/FormGroup'

// ===== BUTTON COMPONENTS =====
export { default as Button } from './Button'
// Button variants (NEW)
export { default as ButtonGroup } from './Button/ButtonGroup'
export { default as IconButton } from './Button'

// ===== DATA DISPLAY COMPONENTS =====
export { default as Badge } from './DataDisplay/Badge'
export { default as Tag } from './DataDisplay/Tag'
export { default as Avatar } from './DataDisplay/Avatar'
export { default as UserAvatar } from './DataDisplay/UserAvatar'
export { default as Progress } from './DataDisplay/Progress'
export { default as StatusBadge } from './DataDisplay/StatusBadge'
export { default as AvatarGroup } from './DataDisplay/AvatarGroup'
export { default as ProgressRing } from './DataDisplay/ProgressRing'
export { default as Chip } from './DataDisplay/Chip'
export { default as Stat } from './DataDisplay/Stat'
export { default as PriorityBadge } from './DataDisplay/PriorityBadge'
export { default as Counter } from './DataDisplay/Counter'
export { default as KpiCard } from './DataDisplay/KpiCard'


// ===== NAVIGATION COMPONENTS (NEW) =====
export { default as Breadcrumb } from './Navigation/Breadcrumb'
export { default as Pagination } from './Navigation/Pagination'
export { default as Stepper } from './Navigation/Stepper'
export { Dropdown } from './Navigation/Dropdown'
export { Popover } from './Navigation/Popover'
export { Tooltip } from './Navigation/Tooltip'
export { default as InnerNavigation } from './Navigation/InnerNavigation'


// ===== FEEDBACK COMPONENTS (NEW) =====
export { default as Alert } from './Feedback/Alert'
export { default as Toast } from './Feedback/Toast'
export { default as LoadingSpinner } from './Feedback/LoadingSpinner'
export { default as EmptyState } from './Feedback/EmptyState'

// ===== LAYOUT COMPONENTS (NEW) =====
export { default as Card } from './Layout/Card'
export { default as Container } from './Layout/Container'
export { default as Grid } from './Layout/Grid'
export { default as ListItem } from './Layout/ListItem'
export { default as Table } from './Layout/Table'
export { default as TaskAttributesPanel } from './Layout/TaskAttributesPanel'
export { default as SidebarLayout } from './Layout/SidebarLayout'
export { default as PageHeader } from './Layout/PageHeader'

// ===== EXISTING COMPONENTS =====
export { default as Dialog } from './Dialog'
export { ConfirmProvider, useConfirm } from './ConfirmProvider'
export { default as Tabs } from './Tabs'
export { default as ContextMenu } from './ContextMenu'
export { default as FilterBar } from './FilterBar'
export { default as Segmented } from './Segmented'
