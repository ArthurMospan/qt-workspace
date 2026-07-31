// src/components/ui/index.js
// Centralized barrel export for all UI components
// This is the single source of truth for all component imports across the application
//
// Every name here is rendered by the product and previewed in /ui-kit. There is
// no third state: 31 components used to sit in this file exported and unused,
// which meant the barrel described an inventory nobody could see on a screen
// and half of it duplicated something already live (Avatar beside UserAvatar,
// Badge beside Pill, Chip beside Tag, Stat beside KpiCard). `npm run test:unit`
// now fails if an unused component reappears.

// ===== CORE LAYOUT COMPONENTS =====
export { default as Surface } from './Surface'
export { default as ImageUpload } from './ImageUpload'
export { default as ChatComposerCore } from './ChatComposerCore'
export { default as IconAction } from './IconAction'

// ===== FORM COMPONENTS =====
export { Input } from './Input'
export { Textarea } from './Forms/Textarea'
export { default as Checkbox } from './Forms/Checkbox'
export { default as ToggleSwitch } from './Forms/ToggleSwitch'
export { Select } from './Select'
export { DatePicker } from './Forms/DatePicker'
export { TimePicker } from './Forms/TimePicker'
export { default as Label } from './Forms/Label'
export { default as FormGroup } from './Forms/FormGroup'

// ===== BUTTON COMPONENTS =====
export { default as Button } from './Button'
export { default as IconButton } from './Button'

// ===== DATA DISPLAY COMPONENTS =====
export { default as Tag } from './DataDisplay/Tag'
export { default as UserAvatar } from './DataDisplay/UserAvatar'
export { default as StatusPill } from './DataDisplay/StatusPill'
export { default as PriorityBadge } from './DataDisplay/PriorityBadge'
export { default as TypeBadge } from './DataDisplay/TypeBadge'
export { default as Pill } from './DataDisplay/Pill'
export { default as Counter } from './DataDisplay/Counter'
export { default as KpiCard } from './DataDisplay/KpiCard'
export { default as TaskListView } from './TaskManagement/TaskListView'
export { default as ProjectSettingsForm } from './TaskManagement/ProjectSettingsForm'
export { default as StatusVisibilityPicker } from './TaskManagement/StatusVisibilityPicker'

// ===== NAVIGATION COMPONENTS =====
export { Popover } from './Navigation/Popover'
export { Tooltip } from './Navigation/Tooltip'
export { default as InnerNavigation } from './Navigation/InnerNavigation'

// ===== FEEDBACK COMPONENTS =====
export { default as Alert } from './Feedback/Alert'
export { default as LoadingSpinner } from './Feedback/LoadingSpinner'
export { default as EmptyState } from './Feedback/EmptyState'

// ===== LAYOUT COMPONENTS =====
export { default as Card } from './Layout/Card'
export { default as TaskAttributesPanel, getTaskAttributeChrome } from './Layout/TaskAttributesPanel'
export { default as SidebarLayout } from './Layout/SidebarLayout'
export { default as PageHeader } from './Layout/PageHeader'

// ===== EXISTING COMPONENTS =====
export { default as Dialog } from './Dialog'
export { ConfirmProvider, useConfirm } from './ConfirmProvider'
export { default as Tabs } from './Tabs'
export { default as ContextMenu } from './ContextMenu'
export { default as FilterBar } from './FilterBar'
export { default as Segmented } from './Segmented'
export { default as ChannelRail } from './Navigation/ChannelRail'
export { default as MemberRail } from './Navigation/MemberRail'

// ===== CHAT =====
// Chat is a structure, not a screen: the message row, the list around it, the
// header above it and the info panel beside it are all components the catalogue
// renders, so /ui-kit shows a conversation instead of a grey box where one goes.
export { default as MessageBubble } from './Chat/MessageBubble'
export { default as ChatMessageList } from './Chat/ChatMessageList'
export { default as ChatConversationHeader } from './Chat/ChatConversationHeader'
export { default as ChatSearchBanner } from './Chat/ChatSearchBanner'
export { default as ChannelInfoPanel } from './Chat/ChannelInfoPanel'
export { default as MentionMenu } from './Chat/MentionMenu'
export { ChatAttachmentList, PendingChatAttachments } from './Chat/ChatAttachmentList'
export { default as TextAction } from './TextAction'
export { default as AvatarButton } from './DataDisplay/AvatarButton'
export { default as FileInput } from './Forms/FileInput'
