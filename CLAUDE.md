# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Running the App
- **Dev server**: `npm run dev` — starts Next.js dev server at http://localhost:3000
- **Production build**: `npm run build` → `npm start` — builds and runs prod server
- **Lint**: `npm run lint` — runs ESLint on the codebase

## Tech Stack

- **Framework**: Next.js 16.2.6 (App Router) with React 19.2.4
- **Backend**: Firebase (Firestore, Auth, Storage)
- **State Management**: 
  - Zustand for workspace UI state (timers, toasts, breadcrumbs, chat search)
  - React Context for app-level state (auth, organizations, projects)
- **Styling**: Tailwind CSS v4 with PostCSS
- **Animations**: Framer Motion
- **UI Libraries**: lucide-react (icons), emoji-picker-react, react-markdown (with GitHub Flavored Markdown)
- **Drag & Drop**: @hello-pangea/dnd
- **Real-time**: Firebase Firestore listeners for presence, chat, notifications

**Path alias**: `@/` → `src/` (jsconfig.json)

## Architecture

### Directory Structure
```
src/
  app/                      # Next.js App Router
    api/
      send-email/           # Cloud function for email
    login/                  # Google Auth login page
    onboarding/             # User onboarding flow
    workspace/              # Main authenticated app
      [projectId]/          # Project pages
        backlog/
        issue/[issueId]/
      team/[uid]/           # Team member details
      team/                 # Team management
      settings/             # Workspace/org settings
      my/                   # User's tasks
      analytics/            # Reporting (workload, velocity, timesheet)
      chat/                 # Real-time messaging
      portal/               # Client portal
      page.js               # Workspace home
  
  components/
    workspace/              # Features: analytics, billing, boards, modals, tabs
    ui/                     # Reusable: Select.jsx
    [Root components]       # TaskDetailPanel, OrgSwitcher, WorkspaceHeader, UserAvatar, etc.
  
  lib/
    context/
      AppContext.js         # Auth, onboarding, presence tracking
      OrgContext.js         # Org switching, members, invitations, permissions
    hooks/                  # Data fetching (useIssues, useTasks, useProjects, etc.)
    utils/
      can.js                # Permission checks
      sendEmail.js          # Email templating
      uploadFile.js         # File upload to Firebase Storage
      mentions.js           # @mention parsing
    migrations/             # One-time data migrations (runs on login)
    firebase.js             # Firebase SDK init, exports auth/db/storage
  
  store/
    useStore.js             # Old app state (minimal, legacy)
    useWorkspaceStore.js    # Zustand: timer, toasts, notifications, breadcrumbs
```

### Key Patterns

**Authentication & Org Context**:
- User authenticates via Google in /login
- AppContext wraps the app, runs migrations on login, tracks presence
- OrgContext manages org switching, members, invitations, role-based access
- Both are in `src/lib/context/` and needed at app root for deep tree access

**Data Fetching**:
- Custom hooks in `src/lib/hooks/` fetch from Firestore with real-time listeners
- Examples: `useIssues()`, `useTasks()`, `useProjects()`, `useTeamMembers()`, `useNotifications()`
- Hooks return `{ data, loading, error }` or similar
- Multiple hooks can be used in a single component to gather all needed data
- Firebase listeners keep data in sync with backend

**UI State**:
- Component-level: local `useState()`
- Workspace-level: Zustand store (useWorkspaceStore) for timers, toasts, live notifications, breadcrumbs
- App-level: React Context (AppContext, OrgContext) for auth, org, projects

**Multi-Tenancy**:
- Organization ID in firebase.js (`process.env.NEXT_PUBLIC_ORG_ID`)
- All Firestore queries filtered by org
- User presence tracked at `presence/{userId}`

### Core Features

**Issues & Tasks**:
- Issues have: title, description, status, assignee, sprint, labels, linked issues
- Comments attached to issues
- Time logs record effort (manual or from timer)

**Time Tracking**:
- Active timer in workspace store; stopTimer() returns `{ issueId, minutes }`
- Manual time logs via API
- Multiple hooks for different log views (weekly, project-wide, all-time)

**Chat & Messaging**:
- Real-time task chat (message, reactions, drafts)
- Draft auto-save
- Pin/mute features

**Notifications & Real-Time**:
- Firebase listeners for real-time updates
- Notification center (useNotifications hook)
- Live notification popup from store
- Audit log for activity tracking

**Analytics**:
- Workload (task distribution)
- Velocity (sprint burn-down)
- Timesheet (hours logged per week)
- Member stats (hours, completions)

**Permissions**:
- Backend enforces row-level security via Firebase rules
- `can.js` has client-side permission checks (owner, admin, member roles)
- Invitations system for adding team members

## Important Notes

### Next.js 16 Breaking Changes
This is Next.js 16.2.6. There are breaking changes from earlier versions:
- Read `node_modules/next/dist/docs/` before writing new routes
- Watch for deprecation warnings in console
- See AGENTS.md for notes on differences

### Firebase Multi-Tenancy
- All collections are org-scoped
- Firestore security rules are **authoritative**; client checks in `can.js` are defensive only
- Presence, notifications, chat all live-update via listeners

### Component Structure
- Functional components with hooks preferred
- Composition over prop drilling; use Context for deeply nested needs
- Modals (CreateTaskModal, IssueModal, BoardConfigModal) handle form state locally

### Migrations
- `runMigrations()` in AppContext runs once per user on login
- Idempotent and safe to call repeatedly
- Add new migrations to `src/lib/migrations/` as schema evolves

### Environment Setup
- Firebase config from `NEXT_PUBLIC_*` env vars in `.env.local`
- Required: API Key, Auth Domain, Project ID, Storage Bucket, Messaging ID, App ID, Measurement ID, ORG_ID

## Code Style

- ESLint: Next.js core web vitals config (eslint.config.mjs)
- Prefer path alias `@/` over relative imports
- Use Zustand for transient UI state, Context for persistent app state
- Firebase listeners in hooks; components subscribe via hooks
- No console.logs in production code (except for debugging during dev)
