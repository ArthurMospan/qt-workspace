/**
 * Send email notifications
 *
 * Requires setup:
 * 1. Firebase Cloud Functions OR
 * 2. Next.js API route (POST /api/send-email)
 *
 * Example Firebase Cloud Function:
 *
 * const functions = require('firebase-functions');
 * const nodemailer = require('nodemailer');
 *
 * const transporter = nodemailer.createTransport({
 *   service: 'gmail',
 *   auth: {
 *     user: functions.config().gmail.email,
 *     pass: functions.config().gmail.password,
 *   },
 * });
 *
 * exports.sendEmailNotification = functions.https.onCall(async (data, context) => {
 *   const { to, subject, html } = data;
 *   await transporter.sendMail({
 *     from: 'noreply@quickteam.com',
 *     to,
 *     subject,
 *     html,
 *   });
 * });
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Reference to Cloud Function (if using Firebase)
const sendEmailFunction = httpsCallable(functions, 'sendEmailNotification');

/**
 * Send email notification (requires backend setup)
 * @param {string} email - recipient email
 * @param {string} type - notification type ('commented', 'assigned', 'blocked', etc)
 * @param {string} title - email subject/title
 * @param {string} body - email body text
 * @param {string} link - link to the issue
 * @param {object} issue - issue data for context
 */
export async function sendEmailNotification({
  email,
  type,
  title,
  body,
  link,
  issue = {},
}) {
  // This requires either:
  // 1. Firebase Cloud Function
  // 2. Next.js API route
  // 3. External email service (SendGrid, Mailgun, Resend)

  try {
    // Option 1: Using Next.js API route (recommended for simplicity)
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        type,
        title,
        body,
        link,
        issueKey: issue.issueKey,
        projectName: issue.projectName,
      }),
    });

    if (!response.ok) {
      console.error('Email send failed:', await response.text());
    }
  } catch (err) {
    console.error('[sendEmailNotification]', err);
    // Fail silently - email is optional, don't break the app
  }
}

/**
 * Generate email HTML template
 */
export function generateEmailTemplate({
  type,
  title,
  body,
  issueKey,
  link,
  projectName,
  userName,
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const fullLink = baseUrl + link;

  const templates = {
    commented: `
      <h2>${title}</h2>
      <p><strong>${userName}</strong> написав коментар до задачи <code>${issueKey}</code>:</p>
      <blockquote style="border-left: 4px solid #e9e9e9; padding-left: 16px; margin: 16px 0; color: #666;">
        ${body}
      </blockquote>
      <p><a href="${fullLink}" style="display: inline-block; padding: 12px 24px; background: #1f1f1f; color: white; border-radius: 8px; text-decoration: none;">Переглянути задачу</a></p>
    `,
    assigned: `
      <h2>${title}</h2>
      <p>Вам призначена задача <code>${issueKey}</code> в проекті <strong>${projectName}</strong>.</p>
      <p>${body}</p>
      <p><a href="${fullLink}" style="display: inline-block; padding: 12px 24px; background: #1f1f1f; color: white; border-radius: 8px; text-decoration: none;">Переглянути задачу</a></p>
    `,
    blocked: `
      <h2>${title}</h2>
      <p>Задача <code>${issueKey}</code> заблокована іншою задачею.</p>
      <p>${body}</p>
      <p><a href="${fullLink}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; border-radius: 8px; text-decoration: none;">Переглянути деталі</a></p>
    `,
    default: `
      <h2>${title}</h2>
      <p>${body}</p>
      <p><a href="${fullLink}" style="display: inline-block; padding: 12px 24px; background: #1f1f1f; color: white; border-radius: 8px; text-decoration: none;">Переглянути</a></p>
    `,
  };

  const template = templates[type] || templates.default;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f1f1f; line-height: 1.6; }
        a { color: #6366f1; text-decoration: none; }
        code { background: #f7f7f7; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
      </style>
    </head>
    <body>
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        ${template}
        <hr style="border: none; border-top: 1px solid #e9e9e9; margin: 30px 0;">
        <p style="font-size: 12px; color: #9a9a9a;">
          Це автоматичне повідомлення від QuickTeam.
          <a href="${baseUrl}/workspace/settings">Керування сповіщеннями</a>
        </p>
      </div>
    </body>
    </html>
  `;
}
