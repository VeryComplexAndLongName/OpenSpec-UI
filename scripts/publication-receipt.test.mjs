import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { mainQualityProof, signReceipt, verifyReceipt } from './publication-receipt.mjs';

const keys = generateKeyPairSync('ed25519');
const privateKey = keys.privateKey.export({ type: 'pkcs8', format: 'pem' });
const item = { channel: 'npm', version: '1.2.3', commit: 'a'.repeat(40), sha256: 'b'.repeat(64), artifact_url: 'https://github.com/file.tgz' };
const quality = { id: 12, head_sha: item.commit, event: 'push', conclusion: 'success', workflow: 'quality.yml' };

test('signed approval binds exact artifact, source and successful Quality', () => {
  const receipt = signReceipt(item, quality, privateKey);
  assert.equal(verifyReceipt({ ...item, receipt }, keys.publicKey).quality.id, 12);
  for (const change of [{ commit: 'c'.repeat(40) }, { sha256: 'c'.repeat(64) }, { version: '1.2.4' },
    { artifact_url: 'https://evil.example/file' }, { channel: 'marketplace' }]) {
    assert.throws(() => verifyReceipt({ ...item, ...change, receipt }, keys.publicKey));
  }
  assert.throws(() => verifyReceipt({ ...item, receipt }, generateKeyPairSync('ed25519').publicKey));
  assert.throws(() => verifyReceipt(item, keys.publicKey));
});

test('signer refuses another commit, failed or PR eligibility', () => {
  for (const change of [{ head_sha: 'c'.repeat(40) }, { conclusion: 'failure' }, { event: 'pull_request' }, { id: 0 }]) {
    assert.throws(() => signReceipt(item, { ...quality, ...change }, privateKey));
  }
});

test('producer checks real main run metadata and every independent job', () => {
  const run = { id: 12, repository: { full_name: 'root/OpenSpec-Workbench' }, head_sha: item.commit,
    event: 'push', status: 'completed', path: 'quality.yml@refs/heads/main' };
  const jobs = ['Typecheck, lint, test, and build', 'Dependency audit', 'Extension integration and package',
    'Standalone browser and accessibility', 'Gitea quality gate'].map((name) => ({ name, conclusion: 'success' }));
  assert.deepEqual(mainQualityProof(run, jobs, item.commit), quality);
  for (const change of [{ head_sha: 'c'.repeat(40) }, { event: 'pull_request' }, { status: 'queued' },
    { repository: { full_name: 'attacker/fork' } }, { path: 'other.yml@refs/heads/main' }]) {
    assert.throws(() => mainQualityProof({ ...run, ...change }, jobs, item.commit));
  }
  for (let i = 0; i < jobs.length; i++) {
    assert.throws(() => mainQualityProof(run, jobs.filter((_, index) => index !== i), item.commit));
    assert.throws(() => mainQualityProof(run, jobs.map((job, index) => index === i ? { ...job, conclusion: 'skipped' } : job), item.commit));
  }
});
