// src/components/ui/index.js
// Centralized barrel export for all UI components
// This is the single source of truth for all component imports across the application

// ===== CORE LAYOUT COMPONENTS =====
export { default as Stack } from './Stack'
export { default as Spacer } from './Spacer'
export { default as Surface } from './Surface'
export { default as PageLayout } from './PageLayout'

// ===== FORM COMPONENTS =====
export { default as Input } from './Input'
export { default as Textarea } from './Forms/Textarea'
export { default as Checkbox } from './Forms/Checkbox'
export { default as RadioButton } from './Forms/RadioButton'
export { default as ToggleSwitch } from './Forms/ToggleSwitch'
export { default as Select } from './Select'
export { DatePicker } from './Forms/DatePicker'
export { TimePicker } from './Forms/TimePicker'
export { SearchInput } from './Forms/SearchInput'
export { FileInput } from './Forms/FileInput'
export { default as Label } from './Forms/Label'
export { default as FormGroup } from './Forms/FormGroup'

// ===== BUTTON COMPONENTS =====
export { default as Button } from './Button'
// Button variants (NEW)
export { default as ButtonGroup } from './Button/ButtonGroup'
export { default as SplitButton } from './Button/SplitButton'
export { default as IconButton } from './Button'

// ===== DATA DISPLAY COMPONENTS =====
export { default as Badge } from './DataDisplay/Badge'
export { default as Tag } from './DataDisplay/Tag'
export { default as Avatar } from './DataDisplay/Avatar'
export { default as Progress } from './DataDisplay/Progress'
export { default as StatusBadge } from './DataDisplay/StatusBadge'
export { default as AvatarGroup } from './DataDisplay/AvatarGroup'
export { default as ProgressRing } from './DataDisplay/ProgressRing'
export { default as Chip } from './DataDisplay/Chip'
export { default as Stat } from './DataDisplay/Stat'
export { default as PriorityBadge } from './DataDisplay/PriorityBadge'

// ===== NAVIGATION COMPONENTS (NEW) =====
export { default as Breadcrumb } from './Navigation/Breadcrumb'
export { default as Pagination } from './Navigation/Pagination'
export { default as Stepper } from './Navigation/Stepper'
export { default as Menu } from './Navigation/Menu'
export { default as Popover } from './Navigation/Popover'
export { default as Tooltip } from './Navigation/Tooltip'
export { default as Dropdown } from './Navigation/Dropdown'

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
export { default as Divider } from './Divider'
export { default as Panel } from './Layout/Panel'
export { default as Flex } from './Layout/Flex'

// ===== SPECIALIZED COMPONENTS (NEW) =====
export { default as TaskCard } from './TaskManagement/TaskCard'
export { default as ProjectCard } from './TaskManagement/ProjectCard'
export { default as TeamMemberCard } from './TaskManagement/TeamMemberCard'
export { default as CommentThread } from './TaskManagement/CommentThread'
export { default as TimeLogDisplay } from './TaskManagement/TimeLogDisplay'

// ===== EXISTING COMPONENTS =====
export { default as Dialog } from './Dialog'
export { default as Tabs } from './Tabs'
