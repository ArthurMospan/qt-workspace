// Server-side transactional email via Resend. Single delivery point so every
// route (invitations, notifications, OTP) talks to the provider the same way.
// Missing RESEND_API_KEY is a soft no-op: features must degrade, not crash.

export async function deliverEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || 'notifications@quickteam.com',
      to: [to],
      subject,
      html,
    }),
  });
  if (!response.ok) {
    console.error('[email] provider rejected request', await response.text());
    return false;
  }
  return true;
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

// The invitation email. `ctaPath` must be an app-relative path ('/login', …)
// so the link can never point outside our own domain.
export function invitationEmailHtml({ orgName, inviterName, role, ctaPath }) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const safePath = typeof ctaPath === 'string' && ctaPath.startsWith('/') ? ctaPath : '/login';
  const roleLabel = role === 'admin' ? 'адміністратора' : 'учасника';
  const org = escapeHtml(orgName || 'QuickTeam');
  const inviter = escapeHtml(inviterName || 'Колега');
  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f1f1f;line-height:1.6;margin:0;padding:0">
      <div style="max-width:600px;margin:0 auto;padding:24px 20px">
        <h2 style="margin:0 0 12px">Вас запрошено до «${org}»</h2>
        <p style="margin:0 0 16px"><strong>${inviter}</strong> запрошує вас приєднатися до організації <strong>${org}</strong> у QuickTeam у ролі ${roleLabel}.</p>
        <p style="margin:0 0 24px">Увійдіть з цією адресою пошти — і ви одразу потрапите в команду.</p>
        <p style="margin:0 0 24px"><a href="${baseUrl}${safePath}" style="display:inline-block;padding:12px 24px;background:#1f1f1f;color:#ffffff;border-radius:8px;text-decoration:none">Приєднатися</a></p>
        <hr style="border:none;border-top:1px solid #e9e9e9;margin:24px 0">
        <p style="font-size:12px;color:#9a9a9a;margin:0">Це автоматичне повідомлення від QuickTeam. Якщо ви не очікували цього запрошення — просто проігноруйте лист.</p>
      </div>
    </body>
    </html>
  `;
}
