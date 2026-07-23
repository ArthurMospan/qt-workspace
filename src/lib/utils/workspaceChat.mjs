export function directMessageRoomId(firstUserId, secondUserId) {
  const ids = [firstUserId, secondUserId].filter(value => typeof value === 'string' && value.length > 0);
  if (ids.length !== 2) return '';
  return ids.sort((a, b) => a.localeCompare(b)).join('_');
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return 0;
}

export function isVisibleChatChannel(channel, userId) {
  if (!channel?.id || channel.id === 'DM' || channel.id.startsWith('project_') || /^\d+$/.test(channel.id)) return false;
  if (channel.type === 'dm') {
    if (Array.isArray(channel.participants)) return channel.participants.includes(userId);
    // Deployed Firestore rules do not allow adding `participants` to existing
    // channel documents. Deterministic DM ids still let us scope the room.
    return Boolean(userId) && (
      channel.id.startsWith(`${userId}_`) || channel.id.endsWith(`_${userId}`)
    );
  }
  if (!channel.name) return false;
  return !Array.isArray(channel.members) || channel.members.length === 0 || channel.members.includes(userId);
}

export function channelUnreadCount(channel, readCursor, userId) {
  if (!channel || channel.lastMessageSenderId === userId) return 0;
  const lastMessageAt = toMillis(channel.lastMessageAt);
  const lastReadAt = toMillis(readCursor?.lastReadAt || readCursor);
  if (!lastMessageAt || lastMessageAt <= lastReadAt) return 0;

  const messageCount = Number(channel.messageCount || 0);
  const readMessageCount = Number(readCursor?.messageCount || 0);
  if (messageCount > 0) return Math.max(1, messageCount - readMessageCount);
  return 1;
}
