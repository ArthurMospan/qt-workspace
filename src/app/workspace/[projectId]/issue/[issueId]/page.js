'use client';
import { use } from 'react';
import IssueDetail from '@/components/workspace/IssueDetail';

export default function IssuePage({ params }) {
  const { projectId, issueId } = use(params);
  return <IssueDetail issueId={issueId} projectId={projectId} isModal={false} />;
}