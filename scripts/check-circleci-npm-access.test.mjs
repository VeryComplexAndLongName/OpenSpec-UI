import assert from 'node:assert/strict';
import test from 'node:test';
import { circleIdentity, probeNpm } from './check-circleci-npm-access.mjs';

const context = '11111111-1111-4111-8111-111111111111';
function harness(patch = {}) {
  const claims = { iss: `https://oidc.circleci.com/org/${circleIdentity.organization}`,
    aud: 'npm:registry.npmjs.org', exp: Math.floor(Date.now() / 1000) + 300,
    'oidc.circleci.com/project-id': circleIdentity.project,
    'oidc.circleci.com/pipeline-definition-id': circleIdentity.pipeline,
    'oidc.circleci.com/vcs-origin': circleIdentity.origin,
    'oidc.circleci.com/config-source': circleIdentity.origin,
    'oidc.circleci.com/vcs-ref': circleIdentity.branch,
    'oidc.circleci.com/config-ref': circleIdentity.branch,
    'oidc.circleci.com/context-ids': [context], ...patch };
  const logs = [], calls = [];
  return { logs, calls, options: {
    token: `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.PRIVATE_ID`,
    env: { CIRCLECI: 'true' }, expected: { ...circleIdentity, context },
    report: (line) => logs.push(line), request: async (url, options) => {
      calls.push({ url, options }); return { ok: true, json: async () => ({ token: 'PRIVATE_NPM_ACCESS' }) };
    },
  } };
}

test('hosted identity discovery makes no registry request', async () => {
  const h = harness(); await probeNpm(h.options);
  assert.equal(h.calls.length, 0);
  assert.equal(JSON.parse(h.logs[0]).project, circleIdentity.project);
  assert.doesNotMatch(h.logs.join('\n'), /PRIVATE_|header\./);
});

test('exchange is exact-package only and never publishes or exposes credentials', async () => {
  const h = harness(); await probeNpm({ ...h.options, mode: 'exchange' });
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].url, 'https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/@openspec-ui%2fcli');
  assert.equal(h.calls[0].options.redirect, 'error');
  assert.equal(h.calls[0].options.headers.authorization, `Bearer ${h.options.token}`);
  assert.doesNotMatch(h.logs.join('\n'), /PRIVATE_|header\./);
  assert.equal(JSON.parse(h.logs.at(-1)).firstLegitimatePublishRequired, true);
});

test('wrong repository, config, audience, project, pipeline, expiry and SSH reruns fail before network', async () => {
  for (const patch of [{ aud: 'other' }, { exp: 0 }, { 'oidc.circleci.com/project-id': 'other' },
    { 'oidc.circleci.com/pipeline-definition-id': 'other' }, { 'oidc.circleci.com/vcs-origin': 'other' },
    { 'oidc.circleci.com/config-source': 'other' }, { 'oidc.circleci.com/config-ref': 'refs/heads/other' },
    { 'oidc.circleci.com/ssh-rerun': true }]) {
    const h = harness(patch); await assert.rejects(probeNpm({ ...h.options, mode: 'exchange' }));
    assert.equal(h.calls.length, 0);
  }
});

test('exchange requires a configured matching context', async () => {
  for (const patch of [{ 'oidc.circleci.com/context-ids': [] }, { 'oidc.circleci.com/context-ids': [42] }]) {
    const h = harness(patch); await assert.rejects(probeNpm({ ...h.options, mode: 'exchange' }), /context/);
    assert.equal(h.calls.length, 0);
  }
  const h = harness();
  await assert.rejects(probeNpm({ ...h.options, mode: 'exchange', expected: circleIdentity }), /context/);
});

test('failed exchanges never log response bodies or request secrets', async () => {
  const h = harness();
  for (const request of [async () => { throw new Error('PRIVATE_ID'); },
    async () => ({ ok: false, status: 403, json: async () => ({ message: 'PRIVATE_ID' }) })]) {
    await assert.rejects(probeNpm({ ...h.options, mode: 'exchange', request }), (error) => {
      assert.doesNotMatch(error.message, /PRIVATE_/); return true;
    });
  }
});
