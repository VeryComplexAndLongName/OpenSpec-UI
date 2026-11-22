// Fixed destinations, bounded responses and installation tokens, never owner PATs.
import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const SOURCE = 'http://hppiigit:3000';
export const PUBLIC = 'VeryComplexAndLongName/OpenSpec-UI';
export const INTERNAL = 'root/OpenSpec-Workbench';

export async function bytes(url, { token, method = 'GET', body, type = 'application/json', accept = 'application/json', missing = false, limit = 100_000_000 } = {}) {
  const parsed = new URL(url);
  if (![SOURCE, 'https://api.github.com', 'https://uploads.github.com', 'https://github.com',
    'https://registry.npmjs.org', 'https://marketplace.visualstudio.com', 'https://raw.githubusercontent.com'].includes(parsed.origin)) {
    throw new Error('Unapproved producer destination');
  }
  const headers = { Accept: accept, 'User-Agent': 'openspec-gitea-release' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = type;
  let response = await fetch(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(90_000) });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const next = new URL(response.headers.get('location'), url);
    const artifactHost = next.origin === SOURCE || next.hostname.endsWith('.githubusercontent.com')
      || next.hostname === 'release-assets.githubusercontent.com' || next.hostname === 'objects.githubusercontent.com';
    if (method !== 'GET' || !artifactHost || (next.origin !== SOURCE && next.protocol !== 'https:')) throw new Error('Unapproved producer redirect');
    // Never forward a repository credential to an asset storage host.
    response = await fetch(next, { redirect: 'error', signal: AbortSignal.timeout(90_000) });
  }
  if (missing && response.status === 404) return null;
  if (!response.ok) throw new Error(`Producer request to ${parsed.hostname} failed: HTTP ${response.status}`);
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Producer response exceeds limit');
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('Producer response exceeds limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function json(url, options) {
  const data = await bytes(url, { limit: 4_000_000, ...options });
  return data === null ? null : data.length ? JSON.parse(data) : {};
}

export function gitea(route, options = {}) {
  return json(`${SOURCE}/api/v1/repos/${process.env.GITEA_REPOSITORY || INTERNAL}${route}`,
    { token: process.env.GITEA_TOKEN, ...options, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
}

export function decodeKey(value) {
  if (typeof value !== 'string' || !value || Buffer.from(value, 'base64').toString('base64') !== value) throw new Error('Expected a canonical base64-encoded private key');
  return Buffer.from(value, 'base64');
}

export async function githubToken(repository, { env: configuration = process.env, call = json } = {}) {
  if (!['OpenSpec-UI', 'OpenSpec-UI-Homepage'].includes(repository)) throw new Error('Unapproved mirror repository');
  const { GITHUB_APP_ID: app, GITHUB_APP_PRIVATE_KEY_BASE64: encoded, GITHUB_APP_PRIVATE_KEY_FILE: file } = configuration;
  if (!/^\d+$/u.test(app || '')) throw new Error('Mirror App id is missing');
  const key = createPrivateKey(encoded ? decodeKey(encoded) : readFileSync(file));
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 30, exp: now + 300, iss: app })}`;
  const jwt = `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), key).toString('base64url')}`;
  const installation = await call(`https://api.github.com/repos/VeryComplexAndLongName/${repository}/installation`, { token: jwt });
  const issued = await call(`https://api.github.com/app/installations/${installation.id}/access_tokens`, {
    token: jwt, method: 'POST', body: JSON.stringify({ repositories: [repository], permissions: { contents: 'write' } }) });
  if (!issued.token || issued.permissions?.contents !== 'write') throw new Error('Mirror App lacks scoped contents write');
  return issued.token;
}

export function mirrorGit(repository, commit, token, branch = 'main', invoke = execFileSync) {
  if (!['OpenSpec-UI', 'OpenSpec-UI-Homepage'].includes(repository)
      || !/^[a-f0-9]{40}$/u.test(commit) || !['main', 'release-manifest'].includes(branch)) throw new Error('Invalid mirror identity');
  const remote = `https://github.com/VeryComplexAndLongName/${repository}.git`;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader',
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}` };
  try {
    // A normal push refuses divergent history. Never force a mirror or remove refs.
    invoke('git', ['push', remote, `${commit}:refs/heads/${branch}`], { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
  } catch { throw new Error('Mirror push failed; reconcile history or protected-branch policy (details withheld)'); }
}
