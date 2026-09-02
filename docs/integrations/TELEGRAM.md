# Telegram integration

QuickTeam uses one application bot for two independent flows:

- a private chat receives personal notifications;
- an organization group creates tasks in one configured default project.

Bot credentials are global server configuration. Users and organizations never enter or see the bot token.

## Server configuration

```text
NEXT_PUBLIC_APP_URL=https://workspace.example.com
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_BOT_USERNAME=<username without @>
TELEGRAM_WEBHOOK_SECRET=<32+ URL-safe random characters>
CRON_SECRET=<random production-only bearer secret>
```

`NEXT_PUBLIC_APP_URL` must be the public HTTPS production origin. The webhook is registered automatically through Bot API `setWebhook` when someone starts either connection flow.

The protected `/api/cron/notifications` route creates calendar and deadline notifications even when no browser tab is open. During hosted testing, an external HTTP scheduler should call `?mode=dispatch` every minute and `?mode=materialise` every twenty minutes using `Authorization: Bearer $CRON_SECRET`; the GitHub workflow is a fallback only. `CRON_SECRET` must hold the same value in the deployed environment and every scheduler. Notification and outbox IDs are deterministic, and channel outcomes are recorded separately, so a late/retried pass does not resend a channel that already succeeded. See [notification delivery](../ARCHITECTURE.md).

Recommended BotFather settings:

- allow adding the bot to groups;
- keep privacy mode enabled — `/task`, `/quickteam_connect` and direct `@bot` mentions still reach the bot;
- register `/task` as a bot command.

## Personal notifications

In **Налаштування → Інтеграції → Telegram** («Підключити Telegram»), or through the channel switch in **Налаштування → Сповіщення**, the user opens a 15-minute deep link and presses Start in the private bot chat. The one-time token links only that Firebase UID to that Telegram chat. The settings screen polls for the webhook's answer and re-checks when the tab regains focus; linking also turns the Telegram delivery preference on.

Disconnecting removes the server-only chat binding. The normal notification preference is also turned off in the UI.

Local development normally omits the bot credentials and therefore cannot create a new Telegram connection or replace the production webhook. It can still report and delete an existing server-side binding; the settings switch must never disable disconnect merely because the local process has no bot token.

## Group task capture

An owner or admin opens **Налаштування → Інтеграції → Telegram**, chooses the default project and presses «Додати бота в групу». The button opens a `startgroup` deep link carrying a 30-minute one-time token; once the bot is added, the Telegram client itself sends `/start qtg_<token>` into the group, the webhook links the group, and the screen — which polls while the setup is open — shows the group's name within seconds. The same token is also shown under the button as a fallback command for a client that did not send it:

```text
/quickteam_connect qtg_<one-time-token>
```

Either spelling is accepted only in a group, and `/start qt_<token>` only in a private chat (`telegramConnectToken` in `src/lib/utils/telegramTask.mjs`). Every member of the organization can read which group is linked and how to write a task; linking and unlinking stay owner/admin.

After connection, group members can use:

```text
/task Назва задачі | Детальний опис
```

or:

```text
@QuickTeamBot задача: Назва задачі
додатковий контекст у наступних рядках
```

The bot replies with the new issue key and link. Telegram message receipts prevent repeated webhook deliveries from creating duplicate issues.

## Stored data

- `users/{uid}/private/telegram` — personal chat binding, denied to browser Firestore.
- `organizations/{orgId}/private/telegram` — organization group binding and default project, denied to browser Firestore.
- `telegramChats/{chatId}` — webhook routing record, default-denied.
- `telegramConnectTokens/{sha256}` — short-lived one-time connection tokens, default-denied.
- `telegramMessageReceipts/{chatId_messageId}` — idempotency receipts, default-denied.

The integration never stores the BotFather token in Firestore.
