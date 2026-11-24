import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { api, identity, run as actualRun, validateJob, publish, validatePackage, probeRequested, npmPublicationTag } from "./publication-worker.mjs";
import { signReceipt } from "./publication-receipt.mjs";

const bytes = Buffer.from("immutable release");
const job = { id: 1, channel: "npm", version: "1.2.3", lease: "a".repeat(32), commit: "b".repeat(40),
  sha256: createHash("sha256").update(bytes).digest("hex"),
  artifact_url: "https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/download/openspec-ui-cli@1.2.3/openspec-ui-cli-1.2.3.tgz" };

const receiptKeys = generateKeyPairSync('ed25519');
job.receipt = signReceipt(job, { id: 1, head_sha: job.commit, event: 'push', conclusion: 'success', workflow: 'quality.yml' },
  receiptKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
const run = (channel, options) => actualRun(channel, { ...options, receiptKey: receiptKeys.publicKey });

test('ambiguous probe environment values refuse work instead of publishing', () => {
  assert.equal(probeRequested('true'), true);
  assert.equal(probeRequested('false'), false);
  assert.equal(probeRequested(undefined), false);
  for (const value of ['1', '0', '', 'TRUE', 'yes']) assert.throws(() => probeRequested(value), /refusing to claim/u);
});

test("refuses untrusted artifact URL, malformed version and checksum", () => {
  assert.equal(validateJob(job, "npm"), "openspec-ui-cli-1.2.3.tgz");
  for (const override of [{ artifact_url: "https://evil.example/pkg.tgz" }, { version: "1.2.3;exec" },
    { sha256: "bad" }, { artifact_url: job.artifact_url.replace("OpenSpec-UI/", "other/") }, { channel: "devto" }]) {
    assert.throws(() => validateJob({ ...job, ...override }, "npm"));
  }
});

function platform({ published = false, mismatch = false } = {}) {
  return async (url) => {
    if (String(url).includes("@openspec-ui%2fcli/")) return published ? Response.json({
      name: "@openspec-ui/cli", version: "1.2.3", dist: { tarball: "https://registry.npmjs.org/@openspec-ui/cli/-/cli-1.2.3.tgz" },
    }) : new Response("", { status: 404 });
    return new Response(mismatch ? "different bytes" : bytes);
  };
}

test("publishes exact approved bytes and reports completion", async () => {
  const calls = [];
  let sent = false;
  await run("npm", { fetcher: platform(), call: async (_, action) => {
    calls.push(action);
    return action === "claim" ? { job } : { state: "published", url: "https://www.npmjs.com/package/@openspec-ui/cli" };
  }, publishArtifact: async (_, artifact) => { assert.deepEqual(await readFile(artifact), bytes); sent = true; } });
  assert.equal(sent, true);
  assert.deepEqual(calls, ["claim", "finish"]);
});

test("lost successful response reconciles without another write", async () => {
  let writes = 0;
  await run("npm", { fetcher: platform({ published: true }), call: async (_, action) =>
    action === "claim" ? { job } : { state: "published", url: "https://www.npmjs.com/package/@openspec-ui/cli" },
  publishArtifact: () => { writes++; } });
  assert.equal(writes, 0);
});

test("checksum failure reports finish but never publishes", async () => {
  let finished = false;
  await assert.rejects(run("npm", { fetcher: platform({ mismatch: true }), call: async (_, action) => {
    if (action === "claim") return { job };
    finished = true;
    return { state: "retry" };
  }, publishArtifact: () => assert.fail("must not publish") }), /checksum mismatch/u);
  assert.equal(finished, true);
});

test("a failed publish remains a failed run unless platform confirms", async () => {
  for (const state of ["retry", "published"]) {
    const work = run("npm", { fetcher: platform(), call: async (_, action) => action === "claim" ? { job } : { state },
      publishArtifact: () => { throw new Error("lost publish response"); } });
    if (state === "retry") await assert.rejects(work, /lost publish response/u);
    else await work;
  }
});

test("an empty queue and identity probe perform no platform calls", async () => {
  await run("npm", { call: async () => ({ job: null }), fetcher: () => assert.fail("no registry request") });
  await run("marketplace", { probe: true, call: async (_, action) => {
    assert.equal(action, "probe"); return { worker: "github:123:1:marketplace" };
  }, fetcher: () => assert.fail("no registry request"), registryProbe: async (channel) => assert.equal(channel, "marketplace") });
});

test("CircleCI uses the fixed Homepage audience and rejects GitHub or non-main identity", async () => {
  const env = { CIRCLECI: 'true', CIRCLE_BRANCH: 'main' };
  let issued;
  const invoke = (command, args) => { issued = [command, args]; return 'short-lived-jwt'; };
  let sent;
  await api('npm', 'probe', {}, { env, invoke, fetcher: async (url, options) => {
    sent = [String(url), options]; return Response.json({ worker: 'verified' });
  } });
  assert.deepEqual(issued, ['circleci', ['run','oidc','get','--v2','--aud','https://openspec-ui.dev/api/publications']]);
  assert.equal(sent[1].headers.Authorization, 'Bearer short-lived-jwt');
  assert.equal(sent[1].redirect, 'error');
  await assert.rejects(identity('https://openspec-ui.dev/api/publications', { ...env, CIRCLE_BRANCH: 'feature' }, invoke));
  await assert.rejects(identity('https://evil.example', env, invoke));
  await assert.rejects(identity('https://openspec-ui.dev/api/publications', { ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'old-token' }, invoke));
});

test('native publisher checks inner product identity before a registry write', async () => {
  const base = { name: '@openspec-ui/cli', version: job.version };
  validatePackage(job, '/tmp/file.tgz', () => JSON.stringify(base));
  for (const manifest of [{ ...base, name: 'another-package' }, { ...base, version: '1.2.4' }]) {
    assert.throws(() => validatePackage(job, '/tmp/file.tgz', () => JSON.stringify(manifest)));
  }
  const marketplace = { ...job, channel: 'marketplace' };
  assert.throws(() => validatePackage(marketplace, '/tmp/file.vsix', () => JSON.stringify({ name: 'other', publisher: 'openspec-ui', version: job.version })));
  let called;
  await publish(job, '/tmp/file.tgz', {
    env: { NPM_TOKEN: 'forbidden', NODE_AUTH_TOKEN: 'forbidden', VSCE_PAT: 'forbidden' },
    fetcher: async () => new Response(JSON.stringify({ name: '@openspec-ui/cli', version: '1.0.0' })),
    getIdentity: async () => 'ephemeral', inspect: () => JSON.stringify(base),
    invoke: (command, args, options) => { called = { command, args, options }; return { status: 0 }; },
  });
  assert.equal(called.options.env.NPM_ID_TOKEN, 'ephemeral');
  for (const name of ['NPM_TOKEN','NODE_AUTH_TOKEN','VSCE_PAT']) assert.equal(called.options.env[name], undefined);
  assert.ok(called.args.includes('--provenance=false'));
  assert.ok(called.args.includes('--ignore-scripts'));
});

test('an altered build receipt cannot cause a registry request', async () => {
  await assert.rejects(run('npm', { call: async (_, action) => action === 'claim'
    ? { job: { ...job, receipt: undefined } } : { state: 'failed' },
    fetcher: () => assert.fail('No registry lookup or artifact download'),
    publishArtifact: () => assert.fail('No registry write') }), /receipt/u);
});


test('late older npm recovery cannot move latest backwards', async () => {
  const remote = async () => new Response(JSON.stringify({ name: '@openspec-ui/cli', version: '2.10.0' }));
  assert.equal(await npmPublicationTag('2.9.99', remote), 'recovery-2-9-99');
  assert.equal(await npmPublicationTag('2.10.0', remote), 'latest');
  assert.equal(await npmPublicationTag('2.11.0', remote), 'latest');
  assert.equal(await npmPublicationTag('1.0.0', async () => new Response(null, { status: 404 })), 'latest');
  await assert.rejects(npmPublicationTag('2.0.0', async () => new Response(null, { status: 503 })));
  await assert.rejects(npmPublicationTag('2.0.0', async () => new Response(JSON.stringify({ name: 'other', version: '9.0.0' }))));
  let command;
  await publish({ ...job, version: '1.2.3' }, '/tmp/file.tgz', {
    env: {}, fetcher: remote, getIdentity: async () => 'fixture',
    inspect: () => JSON.stringify({ name: '@openspec-ui/cli', version: '1.2.3' }),
    invoke: (_, args) => { command = args; return { status: 0 }; },
  });
  assert.equal(command[command.indexOf('--tag') + 1], 'recovery-1-2-3');
});
