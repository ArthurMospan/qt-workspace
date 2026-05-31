'use client';

// Re-export the actual, real IssueCard used on the site to ensure a single source of truth.
// The real card is conditionally draggable, so it works perfectly in the UI Kit without DND context errors.
import IssueCard from '@/components/workspace/IssueCard';
export default IssueCard;
