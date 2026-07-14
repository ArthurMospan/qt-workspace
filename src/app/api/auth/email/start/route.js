import { NextResponse } from 'next/server';
import { admin, enforceRateLimit } from '@/lib/server/firebaseAdmin';
import {
  createEmailOtp,
  EMAIL_OTP_TTL_SECONDS,
  getEmailOtpRef,
  hashEmailOtp,
  normalizeEmail,
  sendEmailOtp,
} from '@/lib/server/emailOtp';

export async function POST(request) {
  try {
    const { email: rawEmail } = await request.json();
    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [emailAllowed, ipAllowed] = await Promise.all([
      enforceRateLimit('auth-email-start-email', email, 5, 15 * 60),
      enforceRateLimit('auth-email-start-ip', ip, 20, 15 * 60),
    ]);
    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json({ error: 'Too many login code requests' }, { status: 429 });
    }

    const code = createEmailOtp();
    await getEmailOtpRef(email).set({
      email,
      codeHash: hashEmailOtp(email, code),
      attempts: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + EMAIL_OTP_TTL_SECONDS * 1000),
    });

    const delivery = await sendEmailOtp(email, code);
    return NextResponse.json({
      success: true,
      expiresIn: EMAIL_OTP_TTL_SECONDS,
      ...delivery,
    });
  } catch (error) {
    console.error('[auth-email-start] Failed:', error);
    return NextResponse.json({ error: 'Failed to send login code' }, { status: 500 });
  }
}
