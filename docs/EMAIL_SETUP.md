# Email Notifications Setup

QuickTeam supports email notifications for comments, assignments, and other events. Choose your email service provider.

## Option 1: Resend (Recommended for Simplicity)

### Step 1: Install Resend

```bash
npm install resend
```

### Step 2: Get API Key

1. Go to https://resend.com
2. Create an account or sign in
3. Go to API Keys and create a new key
4. Copy the API key

### Step 3: Configure Environment

Add to `.env.local`:

```
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=notifications@quickteam.com
```

> **Note:** For production, use a domain you own (e.g., `noreply@yourcompany.com`). Resend requires domain verification.

### Step 4: Test

Send a test email:

```javascript
import { sendEmailNotification } from '@/lib/utils/sendEmail';

await sendEmailNotification({
  email: 'test@example.com',
  type: 'commented',
  title: 'New comment on your task',
  body: 'Check out the latest comment',
  link: '/workspace/project-id/issue/issue-id',
  issue: { issueKey: 'PROJ-123' }
});
```

---

## Option 2: SendGrid

### Step 1: Install SendGrid

```bash
npm install @sendgrid/mail
```

### Step 2: Get API Key

1. Go to https://sendgrid.com
2. Sign up or log in
3. Create API Key: Settings → API Keys → Create API Key
4. Copy the key

### Step 3: Configure Environment

Add to `.env.local`:

```
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
EMAIL_FROM=notifications@yourcompany.com
```

### Step 4: Test

Same as Resend - the API route handles both automatically.

---

## Option 3: Custom SMTP (Gmail, Office365, etc.)

### Step 1: Get SMTP Credentials

For Gmail:
- Use [App Password](https://myaccount.google.com/apppasswords) (if 2FA enabled)
- Or your regular password

For Office365:
- Server: smtp.office365.com
- Port: 587
- Use your email and password

### Step 2: Configure Environment

Add to `.env.local`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

### Step 3: Dependencies

```bash
npm install nodemailer
```

### Step 4: Test

Same as above - the API route detects and uses SMTP.

---

## How to Enable Email Notifications in Code

### 1. When User Comments

Already implemented in `IssueModal.jsx`:

```javascript
await sendNotification({
  userIds: [mentionedUserId, assigneeId],
  type: 'commented',
  title: `User commented on your task`,
  body: comment.text,
  link: `/workspace/${projectId}/issue/${issueId}`,
});

// This will also trigger email if user has notifications enabled
```

### 2. When Task is Assigned

Add to `updateIssue` handler:

```javascript
import { sendEmailNotification } from '@/lib/utils/sendEmail';

if (previousAssignees !== newAssignees) {
  for (const userId of newAssignees) {
    const user = members.find(m => m.id === userId);
    if (user?.email) {
      await sendEmailNotification({
        email: user.email,
        type: 'assigned',
        title: `New task assigned: ${issue.title}`,
        body: `You've been assigned to: ${issue.title}`,
        link: `/workspace/${projectId}/issue/${issueId}`,
        issue: { issueKey: issue.issueKey, projectName: project.name },
        userName: currentUser.name,
      });
    }
  }
}
```

### 3. When Task is Blocked

```javascript
if (issue.isBlocked) {
  const blockerIssue = allIssues.find(i => i.id === issue.blockedBy);
  const assignees = members.filter(m => issue.assigneeIds.includes(m.id));
  
  for (const user of assignees) {
    if (user.email) {
      await sendEmailNotification({
        email: user.email,
        type: 'blocked',
        title: `Task blocked: ${issue.title}`,
        body: `Your task is blocked by ${blockerIssue.issueKey}`,
        link: `/workspace/${projectId}/issue/${issueId}`,
      });
    }
  }
}
```

---

## Email Preferences (Future)

Users should be able to control email notifications via:

```javascript
// Future: User notification preferences in Settings
{
  emailNotifications: {
    onComment: true,
    onAssign: true,
    onMention: true,
    onStatusChange: true,
    onBlocked: true,
  },
  emailFrequency: 'immediate' // or 'daily', 'weekly'
}
```

---

## Troubleshooting

### Emails not sending

1. **Check API key**: Verify it's correct in `.env.local`
2. **Check domain**: For Resend, verify your sending domain
3. **Check logs**: Look at Next.js console for error messages
4. **Test endpoint**: POST to `/api/send-email` manually

### Rate limits

- Resend: 1000 emails/day (free tier), unlimited on paid
- SendGrid: Based on plan
- SMTP: Depends on provider

### Spam folder

- Add DKIM/SPF records to your domain
- Use consistent sender email
- Include unsubscribe link (optional but recommended)

---

## Testing in Development

Use console logs to skip actual sending:

```javascript
// In /lib/utils/sendEmail.js
export async function sendEmailNotification(data) {
  if (process.env.NODE_ENV === 'development') {
    console.log('[EMAIL]', data); // Just log in dev
    return;
  }
  // ... actual sending code
}
```

---

## Security Notes

- Never commit API keys to git
- Use `.env.local` for local development
- Use environment variables in production (Vercel, etc.)
- Validate email addresses before sending
- Rate limit email sending to prevent abuse

