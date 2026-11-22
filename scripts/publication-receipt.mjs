import { createPrivateKey, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function validateProof(data) {
  if (data.schema_version !== 1 || data.repository !== 'root/OpenSpec-Workbench'
      || data.ref !== 'refs/heads/main' || !/^[a-f0-9]{40}$/u.test(data.commit)
      || !['npm', 'marketplace'].includes(data.channel)
      || !/^\d+\.\d+\.\d+$/u.test(data.version) || !/^[a-f0-9]{64}$/u.test(data.sha256)
      || !Number.isSafeInteger(data.quality?.id) || data.quality.id < 1
      || data.quality.head_sha !== data.commit || data.quality.event !== 'push'
      || data.quality.conclusion !== 'success' || data.quality.workflow !== 'quality.yml') {
    throw new Error('Receipt does not attest successful main Gitea Quality for these bytes');
  }
}

export function signReceipt(item, quality, privateKey) {
  const data = { schema_version: 1, repository: 'root/OpenSpec-Workbench', ref: 'refs/heads/main',
    channel: item.channel, version: item.version, commit: item.commit,
    artifact_url: item.artifact_url, sha256: item.sha256, quality };
  validateProof(data);
  const key = createPrivateKey(privateKey);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Expected the approved Ed25519 producer key');
  const payload = Buffer.from(JSON.stringify(data));
  return { payload: payload.toString('base64'), signature: sign(null, payload, key).toString('base64') };
}

export function verifyReceipt(item, publicKey = readFileSync(new URL('../.gitea/release-signing-public.pem', import.meta.url))) {
  const envelope = item.receipt;
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'payload,signature'
      || !Object.values(envelope).every((value) => typeof value === 'string' && value.length < 8000)) {
    throw new Error('A signed Gitea build receipt is required');
  }
  const payload = Buffer.from(envelope.payload, 'base64');
  const signature = Buffer.from(envelope.signature, 'base64');
  if (payload.toString('base64') !== envelope.payload || signature.toString('base64') !== envelope.signature
      || !verify(null, payload, publicKey, signature)) throw new Error('Gitea receipt signature is invalid');
  const data = JSON.parse(payload);
  validateProof(data);
  for (const field of ['channel', 'version', 'commit', 'artifact_url', 'sha256']) {
    if (data[field] !== item[field]) throw new Error('Gitea receipt differs from its immutable artifact');
  }
  return data;
}

export function mainQualityProof(run, jobs, commit) {
  if (run.repository?.full_name !== 'root/OpenSpec-Workbench' || run.head_sha !== commit
      || run.event !== 'push' || run.status !== 'completed'
      || run.path !== 'quality.yml@refs/heads/main' || !Number.isSafeInteger(run.id) || run.id < 1) {
    throw new Error('Expected completed Gitea main Quality for the exact release commit');
  }
  for (const name of ['Typecheck, lint, test, and build', 'Dependency audit',
    'Extension integration and package', 'Standalone browser and accessibility', 'Gitea quality gate']) {
    const matches = jobs.filter((job) => job.name === name);
    if (matches.length !== 1 || matches[0].conclusion !== 'success') {
      throw new Error(`Gitea release prerequisite not successful: ${name}`);
    }
  }
  return { id: run.id, head_sha: commit, event: 'push', conclusion: 'success', workflow: 'quality.yml' };
}
