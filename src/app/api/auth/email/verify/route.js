import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import {
  InvalidJsonBodyError,
  readJsonBody,
  routeErrorResponse,
} from '@/lib/server/apiErrors';
import { enforceRateLimit, getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  EMAIL_OTP_MAX_ATTEMPTS,
  getEmailOtpRef,
  hashEmailOtp,
  normalizeEmail,
  safeCompareHex,
  upsertEmailAuthUser,
} from '@/lib/server/emailOtp';

const EMAIL_LOGIN_ENABLED = process.env.EMAIL_LOGIN_ENABLED === 'true';

export async function POST(request) {
  try {
    if (!EMAIL_LOGIN_ENABLED) {
      return NextResponse.json({ error: 'Email login is temporarily disabled' }, { status: 503 });
    }

    const { email: rawEmail, token: rawToken } = await readJsonBody(request);
    const email = normalizeEmail(rawEmail);
    const token = typeof rawToken === 'string' ? rawToken.replace(/\D/g, '') : '';
    if (!email || token.length !== 6) {
      return NextResponse.json({ error: 'Valid email and code are required' }, { status: 400 });
    }

    // A six-digit code with five tries is a ceiling only if the five are
    // counted one at a time. Read-compare-increment let a burst of parallel
    // guesses all see «four so far», and nothing else on this route counted
    // anything — `start` is limited per address and per IP, `verify` was not.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [emailAllowed, ipAllowed] = await Promise.all([
      enforceRateLimit('auth-email-verify-email', email, 10, 15 * 60),
      enforceRateLimit('auth-email-verify-ip', ip, 30, 15 * 60),
    ]);
    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }

    const otpRef = getEmailOtpRef(email);
    const codeHash = hashEmailOtp(email, token);
    // The compare and the count are one transaction, so the fifth wrong guess
    // is the fifth whatever else is in flight, and a right guess consumes the
    // code before anything is minted for it.
    const verdict = await getAdminDb().runTransaction(async transaction => {
      const otpSnap = await transaction.get(otpRef);
      const otp = otpSnap.exists ? otpSnap.data() : null;
      const expiresAt = otp?.expiresAt?.toMillis?.() || 0;
      if (!otp || otp.email !== email || expiresAt <= Date.now()) {
        if (otpSnap.exists) transaction.delete(otpRef);
        return 'expired';
      }
      if ((otp.attempts || 0) >= EMAIL_OTP_MAX_ATTEMPTS) {
        transaction.delete(otpRef);
        return 'locked';
      }
      if (!safeCompareHex(codeHash, otp.codeHash)) {
        transaction.update(otpRef, {
          attempts: FieldValue.increment(1),
          lastAttemptAt: FieldValue.serverTimestamp(),
        });
        return 'invalid';
      }
      transaction.delete(otpRef);
      return 'ok';
    });
    if (verdict === 'expired') {
      return NextResponse.json({ error: 'Login code expired' }, { status: 401 });
    }
    if (verdict === 'locked') {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
    }
    if (verdict === 'invalid') {
      return NextResponse.json({ error: 'Invalid login code' }, { status: 401 });
    }

    const userRecord = await upsertEmailAuthUser(email);

    const customToken = await getAdminAuth().createCustomToken(userRecord.uid, {
      auth_provider: 'email',
    });

    return NextResponse.json({ customToken });
  } catch (error) {
    if (error instanceof InvalidJsonBodyError) {
      return routeErrorResponse(error, {
        context: 'auth-email-verify',
        fallbackMessage: 'Failed to verify login code',
      });
    }
    console.error('[auth-email-verify] Failed:', error);
    const status = error.status || 500;
    return NextResponse.json({ error: status === 403 ? error.message : 'Failed to verify login code' }, { status });
  }
}
