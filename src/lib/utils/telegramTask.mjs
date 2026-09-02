export function telegramCommandPayload(text, command) {
  const escaped = String(command || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`^/${escaped}(?:@\\w+)?(?:\\s+(.+))?$`, 'i'));
  return match ? (match[1] || '').trim() : null;
}

export function telegramTaskContent(text, botUsername) {
  const value = String(text || '').trim();
  const slashTask = value.match(/^\/task(?:@\w+)?(?:\s+|\n)([\s\S]+)$/i);
  if (slashTask) return slashTask[1].trim();
  if (!botUsername) return '';
  const escapedUsername = String(botUsername).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mention = new RegExp(`^@${escapedUsername}\\b[\\s,:-]*`, 'i');
  if (!mention.test(value)) return '';
  return value.replace(mention, '').replace(/^(задача|завдання|task)(?=\s|[,:-]|$)[\s,:-]*/i, '').trim();
}

export function splitTelegramTask(content) {
  const value = String(content || '').trim();
  const pipeIndex = value.indexOf('|');
  if (pipeIndex >= 0) {
    return {
      title: value.slice(0, pipeIndex).trim(),
      description: value.slice(pipeIndex + 1).trim(),
    };
  }
  const lines = value.split(/\r?\n/);
  return { title: lines.shift()?.trim() || '', description: lines.join('\n').trim() };
}

// The one-time connection payloads, wherever Telegram puts them.
//
// A group is linked by `/quickteam_connect qtg_<token>` — the command the card
// shows — but the client that added the bot through the `startgroup` deep link
// has already sent `/start qtg_<token>` into the group on the person's behalf,
// and the webhook let that one through as noise: `/start` was read for private
// chats only. So the screen asked people for a command Telegram had just typed
// for them, and the bot answered nothing until they did. Both spellings answer
// here, each in the room it belongs to: a private `/start` carries `qt_`, a
// group one `qtg_`, and a payload in the wrong kind of chat is nobody's token.
const PRIVATE_CHAT = 'private';
const GROUP_CHATS = new Set(['group', 'supergroup']);

export function telegramConnectToken(text, chatType) {
  const start = telegramCommandPayload(text, 'start');
  if (start !== null) {
    if (chatType === PRIVATE_CHAT && start.startsWith('qt_') && start.length > 3) {
      return { kind: 'user', token: start.slice(3) };
    }
    if (GROUP_CHATS.has(chatType) && start.startsWith('qtg_') && start.length > 4) {
      return { kind: 'organization', token: start.slice(4) };
    }
    return null;
  }
  const connect = telegramCommandPayload(text, 'quickteam_connect');
  if (connect !== null && GROUP_CHATS.has(chatType) && connect.startsWith('qtg_') && connect.length > 4) {
    return { kind: 'organization', token: connect.slice(4) };
  }
  return null;
}
