import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitTelegramTask,
  telegramCommandPayload,
  telegramConnectToken,
  telegramTaskContent,
} from '../src/lib/utils/telegramTask.mjs';

test('parses Telegram commands with bot suffixes', () => {
  assert.equal(telegramCommandPayload('/quickteam_connect@QuickTeamBot qtg_abc', 'quickteam_connect'), 'qtg_abc');
  assert.equal(telegramCommandPayload('not a command', 'start'), null);
});

test('accepts /task and direct bot mentions', () => {
  assert.equal(telegramTaskContent('/task Зробити реліз | до п’ятниці', 'QuickTeamBot'), 'Зробити реліз | до п’ятниці');
  assert.equal(telegramTaskContent('@QuickTeamBot, задача: Перевірити оплату', 'QuickTeamBot'), 'Перевірити оплату');
  assert.equal(telegramTaskContent('звичайне повідомлення', 'QuickTeamBot'), '');
});

test('splits title and description without losing multiline context', () => {
  assert.deepEqual(splitTelegramTask('Назва | Детальний опис'), { title: 'Назва', description: 'Детальний опис' });
  assert.deepEqual(splitTelegramTask('Назва\nРядок 1\nРядок 2'), { title: 'Назва', description: 'Рядок 1\nРядок 2' });
});

// The `startgroup` deep link makes the Telegram client type `/start qtg_…`
// into the group by itself; the screen used to ask for `/quickteam_connect`
// on top of it. Both spell the same token — in the kind of chat it belongs to.
test('reads the connection token from either spelling, in the chat it belongs to', () => {
  assert.deepEqual(telegramConnectToken('/start qtg_abc', 'supergroup'), { kind: 'organization', token: 'abc' });
  assert.deepEqual(telegramConnectToken('/start@QuickTeamBot qtg_abc', 'group'), { kind: 'organization', token: 'abc' });
  assert.deepEqual(telegramConnectToken('/quickteam_connect qtg_abc', 'group'), { kind: 'organization', token: 'abc' });
  assert.deepEqual(telegramConnectToken('/start qt_abc', 'private'), { kind: 'user', token: 'abc' });
  // A payload in the wrong room is nobody's token, and an empty one is nothing.
  assert.equal(telegramConnectToken('/start qtg_abc', 'private'), null);
  assert.equal(telegramConnectToken('/start qt_abc', 'group'), null);
  assert.equal(telegramConnectToken('/quickteam_connect qtg_abc', 'private'), null);
  assert.equal(telegramConnectToken('/start qt_', 'private'), null);
  assert.equal(telegramConnectToken('/start', 'private'), null);
  assert.equal(telegramConnectToken('/task Назва', 'group'), null);
});
