// Imported from its own file, not the kit barrel: a `loading.js` is a Server
// Component, and the barrel pulls in every client module the kit has.
import PageSkeleton from '@/components/ui/Feedback/PageSkeleton';

export default function Loading() {
  return <PageSkeleton context="settings" />;
}
