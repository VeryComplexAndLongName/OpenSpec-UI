import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { assetIdentity, reconcileAsset, zipEntries, mergeManifests, tagAt } from './mirror-tested-release.mjs';
import { mirrorGit, bytes } from './publication-transport.mjs';
import { signReceipt } from './publication-receipt.mjs';

test('release identities fix package, stable version, source and public destination', () => {
  const item = assetIdentity('npm', '1.2.3', 'a'.repeat(40));
  assert.equal(item.filename, 'openspec-ui-cli-1.2.3.tgz');
  assert.equal(item.artifact_url, 'https://github.com/VeryComplexAndLongName/OpenSpec-UI/releases/download/openspec-ui-cli@1.2.3/openspec-ui-cli-1.2.3.tgz');
  for (const args of [['evil', '1.2.3', item.commit], ['npm', '1.2.3-beta', item.commit], ['npm', '1.2.3', 'main']]) assert.throws(() => assetIdentity(...args));
});

test('existing immutable asset must match both filename and actual bytes', () => {
  const data = Buffer.from('approved');
  const expected = { filename: 'cli-1.2.3.tgz', sha256: createHash('sha256').update(data).digest('hex') };
  reconcileAsset({ name: expected.filename }, expected, data);
  assert.throws(() => reconcileAsset({ name: 'other.tgz' }, expected, data));
  assert.throws(() => reconcileAsset({ name: expected.filename }, expected, Buffer.from('repacked')));
});

test('existing lightweight and annotated tags must resolve to the exact approved commit', async () => {
  const commit = 'a'.repeat(40);
  for (const object of [{ type: 'commit', sha: commit }, { type: 'tag', sha: 'b'.repeat(40) }]) {
    await tagAt(async (route) => ({ object: route.includes('/git/tags/') ? { type: 'commit', sha: commit } : object }), 'tag', commit);
  }
  await assert.rejects(tagAt(async () => ({ object: { type: 'commit', sha: 'b'.repeat(40) } }), 'tag', commit), /differs/u);
  let write;
  await tagAt(async (route, options) => { if (options?.method === 'POST') write = options.body; return null; }, 'tag', commit);
  assert.deepEqual(write, { ref: 'refs/tags/tag', sha: commit });
});

test('CI archive reader refuses traversal, nested files, duplicate entries and excessive members', () => {
  assert.deepEqual(zipEntries('cli.tgz\nreleases-base.json\n'), ['cli.tgz', 'releases-base.json']);
  for (const entries of ['../file', '/tmp/file', 'nested/file', 'file\nfile', '', '..', Array(9).fill('file').map((v, i) => v + i).join('\n')]) assert.throws(() => zipEntries(entries));
});

test('mirror uses only a normal allowlisted push and never exposes credential in arguments', async () => {
  let called;
  mirrorGit('OpenSpec-UI', 'a'.repeat(40), 'fake-token', 'main', (command, args, options) => { called = { command, args, options }; });
  assert.equal(called.command, 'git');
  assert.deepEqual(called.args, ['push', 'https://github.com/VeryComplexAndLongName/OpenSpec-UI.git', `${'a'.repeat(40)}:refs/heads/main`]);
  assert.ok(!JSON.stringify(called.args).includes('fake-token'));
  assert.throws(() => mirrorGit('Foreign', 'a'.repeat(40), 'fake-token'));
  assert.throws(() => mirrorGit('OpenSpec-UI', 'a'.repeat(40), 'fake-token', 'other'));
  await assert.rejects(bytes('https://attacker.invalid/file', { token: 'fake-token' }), /destination/u);
});

test('release manifest keeps historical dates, links and unsigned old versions out of the queue', () => {
  const keys = generateKeyPairSync('ed25519');
  const product = { id: 'ci-cli', version: '1.2.3', links: {}, artifacts: [], changes: [{ kind: 'minor', summary: 'Authored note.' }] };
  const base = { schema_version: 1, products: [product] };
  const old = { ...product, version: '1.2.2', released_at: '2026-01-01', links: { release: 'historical' } };
  const previous = { schema_version: 1, products: [old] };
  const item = { ...assetIdentity('npm', '1.2.3', 'a'.repeat(40)), sha256: 'b'.repeat(64), released_at: '2026-02-01', size_bytes: 5 };
  item.receipt = signReceipt(item, { id: 12, head_sha: item.commit, event: 'push', conclusion: 'success', workflow: 'quality.yml' }, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }));
  assert.deepEqual(mergeManifests(base, previous, [], []).releases.products, [old]);
  const result = mergeManifests(base, previous, [item], [], keys.publicKey);
  assert.equal(result.releases.products[0].changes[0].summary, 'Authored note.');
  assert.equal(result.releases.products[0].artifacts[0].sha256, item.sha256);
  const unchanged = mergeManifests(base, result.releases, [], [item], keys.publicKey);
  assert.deepEqual(unchanged.releases.products, result.releases.products);
  assert.equal(unchanged.publications.publications.length, 1);
  assert.throws(() => mergeManifests(base, previous, [{ ...item, sha256: 'c'.repeat(64) }], [], keys.publicKey));
});
