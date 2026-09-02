import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { authorizeOrgRequest, getAdminDb } from '@/lib/server/firebaseAdmin';
import { readJsonBody, routeErrorResponse } from '@/lib/server/apiErrors';
import { telegramRequest, telegramStatus } from '@/lib/server/telegram';

// «Перевірити» asks Telegram, not this database.
//
// The button used to re-read the organization's own record and report «бот
// відповідає» — a claim about a service nobody had contacted. A group the bot
// had been thrown out of a week earlier passed that check every time. `getChat`
// is the cheapest question Telegram answers only while the bot is still a
// member: it costs the group no message, and a kicked bot gets a refusal that
// names the reason.
//
// A refusal is an answer, not a failure of this route: it comes back as
// `ok: false` with the reason in the reader's words, and the row stays as it
// was — whether to re-add the bot is the administrator's call.
function explain(message) {
  const text = String(message || '');
  if (/kicked|not a member|removed/i.test(text)) return 'Бота вилучили з групи. Додайте його знову.';
  if (/chat not found/i.test(text)) return 'Групу не знайдено — можливо, її видалили або перетворили на іншу.';
  if (/not configured/i.test(text)) return 'Інтеграцію не налаштовано в цьому середовищі.';
  return `Telegram відповів: ${text || 'невідома помилка'}`;
}

export async function POST(request) {
  try {
    const body = await readJsonBody(request);
    const organizationId = typeof body.organizationId === 'string' ? body.organizationId.trim() : '';
    const authorization = await authorizeOrgRequest(request, organizationId, ['owner', 'admin']);
    if (authorization.error) return NextResponse.json({ error: authorization.error }, { status: authorization.status });
    const ref = getAdminDb().collection('organizations').doc(organizationId).collection('private').doc('telegram');
    const snapshot = await ref.get();
    const data = snapshot.exists ? snapshot.data() : {};
    if (!data.chatId) return NextResponse.json({ error: 'Групу ще не підключено' }, { status: 400 });
    if (!telegramStatus().configured) return NextResponse.json({ ok: false, error: explain('not configured') });
    try {
      const chat = await telegramRequest('getChat', { chat_id: data.chatId });
      const chatTitle = chat?.title || data.chatTitle || '';
      // A renamed group renames its row. Nothing else here writes.
      if (chatTitle && chatTitle !== data.chatTitle) {
        await ref.set({ chatTitle, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      return NextResponse.json({ ok: true, chatTitle });
    } catch (error) {
      return NextResponse.json({ ok: false, error: explain(error.message) });
    }
  } catch (error) {
    return routeErrorResponse(error, { context: 'telegram group check', fallbackMessage: 'Не вдалося зв’язатися з Telegram' });
  }
}
