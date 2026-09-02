import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { refuseWithoutCapability } from '@/lib/server/planLimits';
import {
  createIssueFromTelegram,
  sendTelegramMessage,
  telegramStatus,
  telegramTokenId,
  validTelegramWebhookSecret,
} from '@/lib/server/telegram';
import {
  splitTelegramTask,
  telegramConnectToken,
  telegramTaskContent,
} from '@/lib/utils/telegramTask.mjs';
import { issuePath } from '@/lib/utils/issueKeys.mjs';

async function connectPrivateChat(message, token) {
  const db = getAdminDb();
  const tokenRef = db.collection('telegramConnectTokens').doc(telegramTokenId(token));
  const connectionRefHolder = {};
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(tokenRef);
    const data = snapshot.exists ? snapshot.data() : null;
    if (!data || data.type !== 'user' || data.expiresAt?.toMillis?.() < Date.now()) {
      throw new Error('LINK_EXPIRED');
    }
    const connectionRef = db.collection('users').doc(data.userId).collection('private').doc('telegram');
    connectionRefHolder.ref = connectionRef;
    transaction.set(connectionRef, {
      provider: 'telegram',
      chatId: String(message.chat.id),
      chatTitle: message.chat.username ? `@${message.chat.username}` : message.chat.first_name || 'Telegram',
      telegramUserId: String(message.from?.id || ''),
      telegramUsername: message.from?.username || '',
      organizationId: data.organizationId,
      connectedAt: FieldValue.serverTimestamp(),
    });
    transaction.delete(tokenRef);
  });
  await sendTelegramMessage(message.chat.id, '✅ Telegram підключено. Сповіщення QuickTeam надходитимуть сюди після увімкнення каналу в налаштуваннях.')
    .catch(error => console.warn('[telegram] private connect confirmation failed:', error.message));
  return Boolean(connectionRefHolder.ref);
}

async function connectGroup(message, token) {
  const db = getAdminDb();
  const tokenRef = db.collection('telegramConnectTokens').doc(telegramTokenId(token));
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(tokenRef);
    const data = snapshot.exists ? snapshot.data() : null;
    if (!data || data.type !== 'organization' || data.expiresAt?.toMillis?.() < Date.now()) {
      throw new Error('LINK_EXPIRED');
    }
    const organizationRef = db.collection('organizations').doc(data.organizationId).collection('private').doc('telegram');
    const chatRef = db.collection('telegramChats').doc(String(message.chat.id));
    // One group per organization. Linking a second one replaces the first,
    // and the first's routing record goes with it — otherwise the old group
    // kept creating tasks in a project nobody had pointed it at any more.
    // Read before any write, as the transaction demands.
    const previous = await transaction.get(organizationRef);
    const previousChatId = previous.exists ? String(previous.data().chatId || '') : '';
    if (previousChatId && previousChatId !== String(message.chat.id)) {
      transaction.delete(db.collection('telegramChats').doc(previousChatId));
    }
    transaction.set(organizationRef, {
      provider: 'telegram',
      chatId: String(message.chat.id),
      chatTitle: message.chat.title || 'Telegram group',
      defaultProjectId: data.projectId,
      connectedByTelegramUserId: String(message.from?.id || ''),
      connectedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(chatRef, {
      provider: 'telegram',
      organizationId: data.organizationId,
      defaultProjectId: data.projectId,
      connectedAt: FieldValue.serverTimestamp(),
    });
    transaction.delete(tokenRef);
  });
  await sendTelegramMessage(message.chat.id, '✅ Групу підключено до QuickTeam.\n\nСтворення задачі:\n/task Назва | детальний опис\n\nАбо зверніться до бота через @username і напишіть задачу.')
    .catch(error => console.warn('[telegram] group connect confirmation failed:', error.message));
  return true;
}

async function createGroupTask(message, content) {
  if (!content || !['group', 'supergroup'].includes(message.chat?.type)) return false;
  const db = getAdminDb();
  const integration = await db.collection('telegramChats').doc(String(message.chat.id)).get();
  if (!integration.exists) return false;
  const { title, description } = splitTelegramTask(content);
  if (!title) {
    await sendTelegramMessage(message.chat.id, 'Формат: /task Назва задачі | детальний опис');
    return true;
  }

  const receiptRef = db.collection('telegramMessageReceipts').doc(`${message.chat.id}_${message.message_id}`);
  try {
    await receiptRef.create({
      status: 'processing',
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (error.code === 6 || error.code === 'already-exists') return true;
    throw error;
  }

  let createdIssue = null;
  try {
    const data = integration.data();
    // The bot is «Інтеграції», and a linked chat is a door that stays open on
    // its own. Nothing here had ever asked the plan: a group connected on Lite
    // went on posting tasks into a workspace that had gone back to Free, which
    // is the same failure as an API key that outlives its plan and harder to
    // notice, because the person typing is in Telegram. The link is not broken
    // for it — the chat is told why, and it works again with the plan.
    const refusal = await refuseWithoutCapability(
      getAdminDb(),
      data.organizationId,
      'integrations',
    );
    if (refusal) {
      const { error } = await refusal.json();
      await receiptRef.update({ status: 'refused', error: String(error).slice(0, 500) });
      await sendTelegramMessage(message.chat.id, error)
        .catch(sendError => console.warn('[telegram] plan refusal message failed:', sendError.message));
      return true;
    }
    createdIssue = await createIssueFromTelegram({
      organizationId: data.organizationId,
      projectId: data.defaultProjectId,
      title,
      description,
      telegramUser: message.from || {},
      telegramMessageId: message.message_id,
      telegramChatId: message.chat.id,
    });
    await receiptRef.update({ status: 'created', issueId: createdIssue.id, issueKey: createdIssue.issueKey });
    // The row that answers «а воно працює?» with a task rather than a status
    // word. Best effort: a missed stamp is a stale row, not a lost task.
    await db.collection('organizations').doc(data.organizationId).collection('private').doc('telegram').set({
      lastIssueKey: createdIssue.issueKey,
      lastIssueId: createdIssue.id,
      lastProjectId: data.defaultProjectId,
      lastTaskAt: FieldValue.serverTimestamp(),
      taskCount: FieldValue.increment(1),
    }, { merge: true }).catch(stampError => console.warn('[telegram] last task stamp failed:', stampError.message));
  } catch (error) {
    await receiptRef.update({ status: 'failed', error: String(error.message || error).slice(0, 500) });
    await sendTelegramMessage(message.chat.id, `Не вдалося створити задачу: ${error.message || 'невідома помилка'}`)
      .catch(sendError => console.warn('[telegram] task failure message failed:', sendError.message));
    return true;
  }
  const data = integration.data();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
  await sendTelegramMessage(
    message.chat.id,
    `✅ Створено ${createdIssue.issueKey}: ${title}${appUrl ? `\n${appUrl}${issuePath(createdIssue, data.defaultProjectId)}` : ''}`,
  ).catch(error => console.warn('[telegram] task confirmation failed:', error.message));
  return true;
}

export async function POST(request) {
  try {
    const secret = request.headers.get('x-telegram-bot-api-secret-token') || '';
    if (!validTelegramWebhookSecret(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const update = await readJsonBody(request);
    const message = update.message;
    if (!message?.text || !message.chat?.id) return NextResponse.json({ ok: true });

    // One reader for both one-time tokens — see `telegramConnectToken`. The
    // group's arrives as `/start qtg_…`, typed by the Telegram client itself
    // when the bot is added through the deep link, or as the
    // `/quickteam_connect` fallback the screen shows; the private one only
    // ever arrives as `/start qt_…`. The first spelling used to be dropped
    // here, so a group added the way the button suggested stayed unlinked
    // until somebody pasted the second.
    const connect = telegramConnectToken(message.text, message.chat?.type);
    if (connect) {
      try {
        const linked = connect.kind === 'user'
          ? await connectPrivateChat(message, connect.token)
          : await connectGroup(message, connect.token);
        if (linked) return NextResponse.json({ ok: true });
      } catch (error) {
        if (error.message === 'LINK_EXPIRED') {
          await sendTelegramMessage(message.chat.id, connect.kind === 'user'
            ? 'Посилання вже використане або протерміноване. Створіть нове в QuickTeam.'
            : 'Код підключення вже використаний або протермінований. Створіть новий у QuickTeam.');
          return NextResponse.json({ ok: true });
        }
        throw error;
      }
    }

    const content = telegramTaskContent(message.text, telegramStatus().username);
    await createGroupTask(message, content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram webhook', fallbackMessage: 'Telegram webhook failed' });
  }
}
