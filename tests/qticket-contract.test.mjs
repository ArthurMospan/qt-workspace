import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createQTicketSignedRequest,
  qTicketIntegrationConfig,
  signQTicketRequest,
} from '../src/lib/integrations/qticketContract.mjs';

const environment = {
  NEXT_PUBLIC_QTICKET_URL: 'https://qticket.example.com/',
  QUICKTEAM_QTICKET_SHARED_SECRET: 'test-shared-secret-with-at-least-32-characters',
};

test('qTicket config requires both an origin and a server-only shared secret', () => {
  assert.deepEqual(qTicketIntegrationConfig(environment), {
    origin: 'https://qticket.example.com',
    secret: environment.QUICKTEAM_QTICKET_SHARED_SECRET,
    configured: true,
  });
  assert.equal(qTicketIntegrationConfig({ NEXT_PUBLIC_QTICKET_URL: environment.NEXT_PUBLIC_QTICKET_URL }).configured, false);
  assert.equal(qTicketIntegrationConfig({ QUICKTEAM_QTICKET_SHARED_SECRET: environment.QUICKTEAM_QTICKET_SHARED_SECRET }).configured, false);
});

test('signed requests preserve the exact body used to calculate the HMAC', () => {
  const request = createQTicketSignedRequest({ version: 1, revision: 3 }, {
    environment,
    timestamp: 2_000_000_000,
    nonce: 'nonce_0123456789abcdef',
  });
  assert.equal(request.origin, 'https://qticket.example.com');
  assert.equal(request.headers['X-QT-Timestamp'], '2000000000');
  assert.equal(request.headers['X-QT-Nonce'], 'nonce_0123456789abcdef');
  assert.equal(
    request.headers['X-QT-Signature'],
    signQTicketRequest(environment.QUICKTEAM_QTICKET_SHARED_SECRET, {
      timestamp: 2_000_000_000,
      nonce: 'nonce_0123456789abcdef',
      body: request.body,
    }),
  );
});

test('deactivation is an owner-only inactive provisioning snapshot, not local UI state', async () => {
  const route = await readFile(new URL('../src/app/api/integrations/qticket/route.js', import.meta.url), 'utf8');
  assert.match(route, /export async function DELETE/);
  assert.match(route, /authorizeOrgRequest\(request, organizationId, \['owner'\]\)/);
  assert.match(route, /entitlement: 'inactive'/);
  assert.match(route, /await provisionQTicket\(\{ \.\.\.desired, revision \}\)/);
});
