import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { identity, probeEntra, signAssertion } from './check-marketplace-entra-access.mjs';

const profileId = '11111111-1111-4111-8111-111111111111';
function harness({ role = 'Contributor', roleIdentity = profileId, principal = identity.principal, extensionId = identity.extensionId } = {}) {
  const calls = [], logs = [];
  const accessToken = `header.${Buffer.from(JSON.stringify({ tid: identity.tenant, oid: principal, appid: identity.client })).toString('base64url')}.PRIVATE_ACCESS`;
  const responses = [{ access_token: accessToken }, { id: profileId },
    { value: [{ identity: { id: roleIdentity }, role: { name: role } }] },
    { results: [{ extensions: [{ extensionId, extensionName: 'openspec-ui-vscode',
      publisher: { publisherId: identity.publisherId, publisherName: 'openspec-ui' } }] }] }];
  return { calls, logs, options: { assertion: 'PRIVATE_ASSERTION', report: (line) => logs.push(line), request: async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => responses.shift() };
  } } };
}

test('certificate assertion has a verifiable signature, exact audience and short expiry', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const assertion = signAssertion(privateKey, identity.thumbprint, 1_000_000);
  const [header, payload, signature] = assertion.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  assert.equal(claims.sub, identity.client);
  assert.equal(claims.iss, identity.client);
  assert.equal(claims.exp, 1300);
  assert.equal(claims.nbf, 990);
  assert.match(claims.aud, /^https:\/\/login\.microsoftonline\.com\/[^/]+\/oauth2\/v2\.0\/token$/);
  assert.ok(verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), publicKey, Buffer.from(signature, 'base64url')));
  assert.notEqual(assertion, signAssertion(privateKey, identity.thumbprint, 1_000_000));
});

test('identity discovery does not claim publishing authorization', async () => {
  const h = harness(); await probeEntra({ ...h.options, mode: 'identity' });
  assert.equal(h.calls.length, 2);
  assert.equal(JSON.parse(h.logs[0]).profileId, profileId);
  assert.equal(JSON.parse(h.logs[0]).published, false);
});

test('strict verification requires exact profile Contributor and immutable extension identifiers', async () => {
  const h = harness(); let clientCalls = 0;
  await probeEntra({ ...h.options, verifyClient: async (token) => { assert.match(token, /PRIVATE_ACCESS$/); clientCalls++; } });
  assert.equal(clientCalls, 1);
  assert.equal(h.calls.length, 4);
  assert.ok(h.calls.every(({ options }) => options.redirect === 'error'));
  assert.doesNotMatch(h.logs.join('\n'), /PRIVATE_/);
  assert.equal(JSON.parse(h.logs.at(-1)).role, 'Contributor');
});

test('Reader, foreign profile, foreign application and replaced extension all fail', async () => {
  for (const patch of [{ role: 'Reader' }, { roleIdentity: 'other' }, { principal: 'other' }, { extensionId: 'other' }]) {
    const h = harness(patch);
    await assert.rejects(probeEntra(h.options));
    assert.doesNotMatch(h.logs.join('\n'), /"clientVerified"/);
  }
});

test('request failures and Entra error bodies never disclose credentials', async () => {
  for (const request of [async () => { throw new Error('PRIVATE_ASSERTION'); },
    async () => ({ ok: false, status: 400, json: async () => ({ error_codes: [700027], error_description: 'PRIVATE_ASSERTION' }) })]) {
    await assert.rejects(probeEntra({ assertion: 'PRIVATE_ASSERTION', request }), (error) => {
      assert.doesNotMatch(error.message, /PRIVATE_/); return true;
    });
  }
});
