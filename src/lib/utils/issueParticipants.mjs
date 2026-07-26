// src/lib/utils/issueParticipants.mjs
// Who hears about activity on a task.
//
// The rule every issue tracker converges on, and the one people already expect:
// you are a participant if you have a stake in the task — you created it, it is
// assigned to you, you are watching it, or you joined the conversation by
// commenting. Activity goes to participants and never back to whoever caused it.
//
// Before this existed each sender picked its own audience. A status change went
// to assignees and watchers only, so the person who *created* the task never
// heard that it moved, and comments notified nobody at all unless they carried
// an @mention.

export function issueParticipants(issue, {
  actorId = '',
  commentAuthorIds = [],
  exclude = [],
} = {}) {
  // The actor is always excluded: nobody wants to be told about their own click.
  // `exclude` carries people already reached another way — someone who is being
  // @mentioned gets the mention, not a second, vaguer notification as well.
  const excluded = new Set([actorId, ...exclude].filter(Boolean));

  const candidates = [
    ...(Array.isArray(issue?.assigneeIds) ? issue.assigneeIds : []),
    issue?.reporterId,
    ...(Array.isArray(issue?.watcherIds) ? issue.watcherIds : []),
    ...(Array.isArray(commentAuthorIds) ? commentAuthorIds : []),
  ];

  return [...new Set(
    candidates.filter(uid => typeof uid === 'string' && uid.length > 0 && !excluded.has(uid)),
  )];
}
