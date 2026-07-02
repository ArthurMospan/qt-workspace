/**
 * POST /api/send-email
 *
 * Send email notifications
 *
 * Setup required:
 * 1. Install: npm install resend
 * 2. Set RESEND_API_KEY in .env.local
 *
 * Or use another service like SendGrid, Mailgun, etc.
 */

import { generateEmailTemplate } from '@/lib/utils/sendEmail';

export async function POST(request) {
  // Require INTERNAL_API_KEY to be configured — no soft fallback
  if (!process.env.INTERNAL_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = request.headers.get('x-api-key');
  if (apiKey !== process.env.INTERNAL_API_KEY) {
    // Allow from same origin only (exact match, not substring)
    const origin = request.headers.get('origin');
    if (!origin || origin !== process.env.NEXT_PUBLIC_APP_URL) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const { email, type, title, body, link, issueKey, projectName, userName } = await request.json();

    if (!email || !title || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate HTML template
    const html = generateEmailTemplate({
      type,
      title,
      body,
      issueKey,
      link,
      projectName,
      userName,
    });

    // Option 1: Using Resend (recommended for simplicity)
    if (process.env.RESEND_API_KEY) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      const result = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'notifications@quickteam.com',
        to: email,
        subject: title,
        html,
      });

      if (result.error) {
        console.error('Resend error:', result.error);
        return Response.json({ error: result.error.message }, { status: 500 });
      }

      return Response.json({ success: true, messageId: result.data.id });
    }

    // Option 2: Using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = await import('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);

      const msg = {
        to: email,
        from: process.env.EMAIL_FROM || 'notifications@quickteam.com',
        subject: title,
        html,
      };

      const result = await sgMail.send(msg);
      return Response.json({ success: true, messageId: result[0].headers['x-message-id'] });
    }

    // Option 3: Using NodeMailer (requires SMTP config)
    if (process.env.SMTP_HOST) {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const result = await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'notifications@quickteam.com',
        to: email,
        subject: title,
        html,
      });

      return Response.json({ success: true, messageId: result.messageId });
    }

    // No email service configured
    console.warn('Email service not configured. Install Resend, SendGrid, or configure SMTP.');
    return Response.json({
      warning: 'Email service not configured',
      success: false,
    }, { status: 503 });
  } catch (error) {
    console.error('[send-email]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
