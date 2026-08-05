'use client';

import { CornerDownRight } from 'lucide-react';
import { taskDisplayKey } from '@/lib/utils/issueKeys.mjs';

/**
 * What a task is called, above its title: its key, the project it belongs to on
 * a cross-project list, and the parent it hangs under.
 *
 * The card and the list row each drew this by hand, and both ran the three
 * through one uppercase monospace span joined by bullets — so the project name
 * read as part of the identifier rather than as the project, and a task with no
 * key got an invented one. They are three different things and they look like
 * three different things now: the key is monospace because it is an identifier
 * you retype, the project is ordinary text because it is a name you read, and
 * the parent is a link-shaped fragment behind a real icon.
 *
 * @param {object} props.issue The task.
 * @param {object} props.project Its project, for re-prefixing a legacy key.
 * @param {string} props.projectName Its project's name.
 * @param {boolean} props.showProjectName Whether to name the project — true only on cross-project lists.
 * @param {object} props.parentIssue The task this one hangs under, if any.
 * @param {string} props.className Placement in the parent only.
 */
export default function TaskIdentity({
  issue,
  project = null,
  projectName,
  showProjectName = false,
  parentIssue = null,
  className = '',
}) {
  const key = taskDisplayKey(issue, project || (projectName ? { name: projectName } : null));
  const showsProject = showProjectName && Boolean(projectName);
  if (!key && !showsProject && !parentIssue) return null;

  return (
    <span className={`flex min-w-0 items-center gap-[6px] ${className}`}>
      {key && (
        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-faint">
          {key}
        </span>
      )}
      {showsProject && (
        <>
          {key && <span aria-hidden className="h-[10px] w-px shrink-0 bg-line" />}
          <span className="min-w-0 truncate text-[10px] font-medium text-muted">
            {projectName}
          </span>
        </>
      )}
      {parentIssue && (
        <>
          {(key || showsProject) && <span aria-hidden className="h-[10px] w-px shrink-0 bg-line" />}
          {/* A real icon, drawn on the same grid as every other glyph. This was
              the literal character "↳", which has no consistent metrics: it sits
              below the baseline in some fonts and above it in others, and no
              font in the stack draws it at the weight of the text beside it. */}
          <span
            className="flex min-w-0 items-center gap-[3px] text-[10px] font-medium text-muted"
            title={parentIssue.title || 'Батьківське завдання'}
          >
            <CornerDownRight size={11} strokeWidth={2} className="shrink-0 text-faint" />
            <span className="min-w-0 truncate">
              {parentIssue.issueKey || parentIssue.title || 'Батьківське завдання'}
            </span>
          </span>
        </>
      )}
    </span>
  );
}
