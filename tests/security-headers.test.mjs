import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../next.config.mjs';

test('every route receives the baseline browser security headers', async () => {
  const rules = await nextConfig.headers();
  const globalRule = rules.find(rule => rule.source === '/:path*');
  assert.ok(globalRule, 'missing global header rule');

  const headers = new Map(globalRule.headers.map(header => [header.key, header.value]));
  assert.equal(headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(headers.get('X-Frame-Options'), 'SAMEORIGIN');
  assert.equal(headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.match(headers.get('Permissions-Policy'), /camera=\(\)/);
  assert.match(headers.get('Permissions-Policy'), /geolocation=\(\)/);
});
