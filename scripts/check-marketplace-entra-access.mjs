import { createPrivateKey, randomUUID, sign, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const identity = Object.freeze({
  tenant: '98c88ff6-1c8a-4943-97d1-dd2774508ee9',
  client: 'f357cdfe-d7cf-441e-9cb0-889fb8cf8897',
  principal: '5e2339f2-50c5-4b0c-82bd-4857dff6f790',
  thumbprint: '490FD4FE9CB6A31479EC3D1572D79A2EE55C2603',
  publisherId: '5ece82ef-e623-4c63-ae77-ee9261e4ca19',
  extensionId: '8082245e-9666-438c-8680-4e447f5eef72',
});
const tokenUrl = `https://login.microsoftonline.com/${identity.tenant}/oauth2/v2.0/token`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signAssertion(key, thumbprint, now = Date.now()) {
  if (!/^[0-9a-f]{40}$/i.test(thumbprint)) throw new Error('Invalid certificate thumbprint');
  const issued = Math.floor(now / 1000);
  const header = encode({ alg: 'RS256', typ: 'JWT', x5t: Buffer.from(thumbprint, 'hex').toString('base64url') });
  const payload = encode({ aud: tokenUrl, iss: identity.client, sub: identity.client,
    jti: randomUUID(), nbf: issued - 10, exp: issued + 300 });
  const input = `${header}.${payload}`;
  return `${input}.${sign('RSA-SHA256', Buffer.from(input), key).toString('base64url')}`;
}

function assertionFromCertificate(pem) {
  const certificateBlock = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/u)?.[0];
  if (!certificateBlock) throw new Error('Certificate PEM is missing its public certificate');
  const certificate = new X509Certificate(certificateBlock);
  const thumbprint = certificate.fingerprint.replaceAll(':', '');
  if (thumbprint !== identity.thumbprint || Date.parse(certificate.validTo) <= Date.now()
      || Date.parse(certificate.validFrom) > Date.now()) throw new Error('Certificate identity or validity differs from the approved credential');
  let key;
  try { key = createPrivateKey(pem); } catch { throw new Error('Could not load the private key (details withheld)'); }
  if (!certificate.checkPrivateKey(key)) throw new Error('Private key does not match the approved certificate');
  return signAssertion(key, thumbprint);
}

export async function probeEntra({ assertion, mode = 'verify', request = fetch, report = console.log, verifyClient } = {}) {
  if (!['identity', 'verify'].includes(mode) || !assertion) throw new Error('A signed certificate assertion and valid probe mode are required');
  async function json(url, options, stage) {
    let response;
    try { response = await request(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
    catch { throw new Error(`${stage}: request failed (details withheld to protect credentials)`); }
    if (!response.ok) {
      let codes = [];
      try { const body = await response.json(); codes = Array.isArray(body.error_codes) ? body.error_codes.filter(Number.isSafeInteger) : []; } catch { /* Error bodies are never logged. */ }
      throw new Error(`${stage}: HTTP ${response.status}${codes.length ? `; Entra codes ${codes.join(',')}` : ''}`);
    }
    try { return await response.json(); } catch { throw new Error(`${stage}: invalid JSON`); }
  }
  const token = await json(tokenUrl, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: identity.client, grant_type: 'client_credentials',
      scope: '499b84ac-1321-427f-aa17-267ca6975798/.default',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: assertion }),
  }, 'Entra certificate exchange');
  let claims;
  try { claims = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64url')); }
  catch { throw new Error('Entra returned no valid access token'); }
  if (claims.tid !== identity.tenant || claims.oid !== identity.principal
      || (claims.appid ?? claims.azp) !== identity.client) throw new Error('Unexpected Entra application identity');
  const headers = { authorization: `Bearer ${token.access_token}`, accept: 'application/json' };
  const profile = await json('https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1', { headers }, 'Marketplace profile');
  if (typeof profile.id !== 'string' || !uuid.test(profile.id)) throw new Error('No valid Marketplace profile id');
  report(JSON.stringify({ application: identity.client, principal: identity.principal, profileId: profile.id, mode, published: false }));
  if (mode === 'identity') return;
  const roles = await json('https://marketplace.visualstudio.com/_apis/securityroles/scopes/gallery.publisher/roleassignments/resources/openspec-ui?api-version=7.1-preview.1', { headers }, 'Publisher roles');
  if (!roles.value?.some((assignment) => assignment.identity?.id?.toLowerCase() === profile.id.toLowerCase()
      && assignment.role?.name === 'Contributor')) throw new Error('Exact Marketplace profile lacks Contributor on openspec-ui');
  const gallery = await json('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json;api-version=7.1-preview.1' },
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: 'openspec-ui.openspec-ui-vscode' }] }], flags: 513 }),
  }, 'Extension identity');
  if (!gallery.results?.flatMap((result) => result.extensions ?? []).some((extension) =>
    extension.extensionId === identity.extensionId && extension.extensionName === 'openspec-ui-vscode'
      && extension.publisher?.publisherId === identity.publisherId && extension.publisher?.publisherName === 'openspec-ui')) {
    throw new Error('Existing extension/publisher identity differs from the baseline');
  }
  if (verifyClient) await verifyClient(token.access_token);
  report(JSON.stringify({ publisher: 'openspec-ui', publisherId: identity.publisherId,
    extensionId: identity.extensionId, role: 'Contributor', clientVerified: Boolean(verifyClient), published: false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    const file = process.env.OPENSPEC_MARKETPLACE_CERTIFICATE;
    if (!file) throw new Error('Set OPENSPEC_MARKETPLACE_CERTIFICATE to the protected PEM file');
    const assertion = assertionFromCertificate(await readFile(file, 'utf8'));
    await probeEntra({ assertion, mode: process.argv[2] ?? 'verify' });
  })().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
