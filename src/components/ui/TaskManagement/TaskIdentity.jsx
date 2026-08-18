'use client';

import { ParentTaskIcon } from '@/lib/design/icons';
import { taskDisplayKey } from '@/lib/utils/issueKeys.mjs';

/**
 * What a task is called, above its title: its key, the parent it hangs under,
 * and the project it belongs to on a cross-project list — in that order, from
 * the task outwards. The project used to sit between the two keys, splitting
 * one thought in half with an unrelated one.
 *
 * The card and the list row each drew this by hand, and both ran the three
 * through one uppercase monospace span joined by bullets — so the project name
 * read as part of the identifier rather than as the project, and a task with no
 * key got an invented one.
 *
 * All three are monospace: two of them are identifiers, and setting the third
 * in the body face put a second typeface on a 10px line, which showed as a
 * seam rather than as a distinction. They are told apart by weight and colour
 * instead — only the card's own key carries any, and everything after it is
 * context, so the line reads as a name with its address behind it.
 *
 * Two keys sit here on a subtask, and they are not equals: the first names this
 * task, the second names the one it hangs under. They are set in the same type
 * for that reason — one kind of thing, read the same way — and told apart by
 * weight and colour alone. The parent used to be the darker and heavier of the
 * two, which read as the card's own name with something faint in front of it.
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
  const resolvedProject = project || (projectName ? { name: projectName } : null);
  const key = taskDisplayKey(issue, resolvedProject);
  // Through `taskDisplayKey` like the card's own key, not raw: a parent still
  // stored under the pre-prefix `WS-7` was printed as `WS-7` beside a child
  // called `DESIGN-363`, as though they belonged to different projects.
  const parentKey = parentIssue
    ? taskDisplayKey(
      parentIssue.issueKey ? parentIssue : { issueKey: issue?.parentIssueKey || '' },
      resolvedProject,
    )
    : '';
  const parentTitle = parentIssue?.title
    ? `Батьківське завдання: ${parentIssue.title}`
    : (parentKey ? `Батьківське завдання ${parentKey}` : 'Це підзавдання');
  const showsProject = showProjectName && Boolean(projectName);
  if (!key && !showsProject && !parentIssue) return null;

  // One line-height for every fragment. Without it each one sizes its own line
  // box from its own font — monospace and sans do not agree — and centring
  // three boxes of different heights left the project name sitting visibly
  // lower than the keys beside it.
  const divider = <span aria-hidden className="h-[10px] w-px shrink-0 bg-line" />;

  return (
    <span className={`flex min-w-0 items-center gap-[6px] leading-[14px] ${className}`}>
      {key && (
        <span className="shrink-0 font-mono text-[10px] font-bold tracking-wide text-muted">
          {key}
        </span>
      )}
      {parentIssue && (
        <>
          {key && divider}
          {/* A real icon, drawn on the same grid as every other glyph. This was
              the literal character "↳", which has no consistent metrics: it sits
              below the baseline in some fonts and above it in others, and no
              font in the stack draws it at the weight of the text beside it.
              The glyph itself comes from `design/icons`, because the task page
              states the same relation and was drawing `Layers` for it. */}
          <span
            className="flex min-w-0 items-center gap-[3px] font-mono text-[10px] font-medium tracking-wide text-faint"
            title={parentTitle}
          >
            <ParentTaskIcon size={11} strokeWidth={2} className="shrink-0" />
            {/* The key, or nothing at all.
                This slot printed «Батьківське завдання» whenever the parent
                could not be named — and a noun phrase where an identifier goes
                does not read as «unknown», it reads as the task's number. The
                parent is usually unnameable from the card's own data: it lives
                in another sprint, another column, or past the loaded page, and
                the card was searching the issues that happened to be on screen.
                Tasks written since carry `parentIssueKey`; for older ones the
                icon alone still says «this hangs under something», which is the
                whole truth the card has. */}
            {parentKey && <span className="min-w-0 truncate">{parentKey}</span>}
          </span>
        </>
      )}
      {showsProject && (
        <>
          {(key || parentIssue) && divider}
          <span className="min-w-0 truncate font-mono text-[10px] font-medium tracking-wide text-faint">
            {projectName}
          </span>
        </>
      )}
    </span>
  );
}
