// src/app/(app)/loading.js — the workspace's route-transition skeleton.
//
// There was none, so every navigation held the previous screen until the next
// one was ready and gave no sign that anything was happening. The pause is
// short; the absence of feedback during it is what reads as "did my click
// register?".
//
// This file covers the dashboard and anything that has not named its own shape.
// The shapes live in `PageSkeleton`: one skeleton for the whole workspace was
// three columns of task cards, which is what a board looks like and what
// Аналітика, Календар, Команда, Чат and Налаштування emphatically do not.
// Imported from its own file, not the kit barrel: a `loading.js` is a Server
// Component, and the barrel pulls in every client module the kit has.
import PageSkeleton from '@/components/ui/Feedback/PageSkeleton';

export default function WorkspaceLoading() {
  return <PageSkeleton context="cards" />;
}
