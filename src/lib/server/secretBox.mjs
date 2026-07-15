import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Not knowing the key is as fatal as having the wrong one: a fallback here
 * would mean writing a QuickTeam+ refresh token to Firestore in the clear.
 */
function getKey() {
  const raw = process.env.QTPLUS_TOKEN_KEY;
  if (!raw) {
    throw new Error('QTPLUS_TOKEN_KEY is not configured — refusing to handle QuickTeam+ tokens.');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`QTPLUS_TOKEN_KEY must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

export function seal(plaintext) {
  // A fresh IV per seal. Reusing one under GCM leaks the plaintext relationship
  // between two ciphertexts and breaks the authentication guarantee outright.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);

  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64'),
  };
}

export function open(box) {
  if (!box || box.v !== 1) throw new Error('Unsupported sealed box.');

  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(box.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  // GCM: a wrong key or a single flipped byte makes final() throw. That is the
  // point — a tampered token must be an error, never a different value that
  // quietly gets used.
  return Buffer.concat([
    decipher.update(Buffer.from(box.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
