// Gitea prepares releases; Homepage alone decides registry eligibility.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { mainQualityProof, signReceipt, verifyReceipt, signRuntime, verifyRuntime, RUNTIME_FILES } from './publication-receipt.mjs';
import { validatePackage } from './publication-worker.mjs';
import { SOURCE, PUBLIC, INTERNAL, bytes, json, gitea, githubToken, mirrorGit } from './publication-transport.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const gh = (route, token, options = {}) => json(`https://api.github.com/repos/${PUBLIC}${route}`, {
  token, ...options, body: options.body === undefined ? undefined : JSON.stringify(options.body) });

export function assetIdentity(channel, version, commit) {
  if (!['npm', 'marketplace'].includes(channel) || !/^\d+\.\d+\.\d+$/u.test(version)
      || !/^[a-f0-9]{40}$/u.test(commit)) throw new Error('Invalid stable release identity');
  const prefix = channel === 'npm' ? 'openspec-ui-cli' : 'openspec-ui-vscode';
  const tag = `${prefix}@${version}`;
  const filename = `${prefix}-${version}.${channel === 'npm' ? 'tgz' : 'vsix'}`;
  return { channel, version, commit, tag, filename,
    artifact_url: `https://github.com/${PUBLIC}/releases/download/${tag}/${filename}` };
}

export function reconcileAsset(existing, expected, actual) {
  if (existing.name !== expected.filename || digest(actual) !== expected.sha256) throw new Error('Existing immutable release asset differs');
}

export function zipEntries(output) {
  const entries = output.trim().split(/\r?\n/u);
  if (!entries.length || entries.length > 8 || new Set(entries).size !== entries.length
      || entries.some((name) => !/^[a-zA-Z0-9_.-]+$/u.test(name) || name === '.' || name === '..')) {
    throw new Error('Unexpected or unsafe CI archive entries');
  }
  return entries;
}

async function artifact(run, name, directory) {
  const list = (await gitea(`/actions/runs/${run}/artifacts`)).artifacts;
  const matches = list.filter((one) => one.name === name && !one.expired);
  if (matches.length !== 1 || matches[0].size_in_bytes > 100_000_000) throw new Error(`Missing unique retained CI artifact ${name}`);
  const archive = path.join(directory, `${run}-${name}.zip`);
  await writeFile(archive, await bytes(`${SOURCE}/api/v1/repos/${INTERNAL}/actions/artifacts/${matches[0].id}/zip`, { token: process.env.GITEA_TOKEN }));
  const entries = zipEntries(execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', timeout: 10_000, maxBuffer: 64_000 }));
  return async (filename) => {
    if (!entries.includes(filename)) throw new Error(`CI artifact lacks ${filename}`);
    return execFileSync('unzip', ['-p', archive, filename], { timeout: 15_000, maxBuffer: 100_000_000 });
  };
}

export async function registered(channel, version) {
  if (channel === 'npm') {
    const value = await json(`https://registry.npmjs.org/@openspec-ui%2fcli/${version}`, { missing: true });
    if (!value) return false;
    if (value.name !== '@openspec-ui/cli' || value.version !== version) throw new Error('Unexpected npm identity');
    return true;
  }
  const response = await json('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
    method: 'POST', accept: 'application/json;api-version=7.2-preview.1',
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: 'openspec-ui.openspec-ui-vscode' }] }], flags: 1 }) });
  const extension = response.results?.[0]?.extensions?.[0];
  if (extension?.extensionId !== '8082245e-9666-438c-8680-4e447f5eef72') throw new Error('Unexpected Marketplace identity');
  return extension.versions?.some((one) => one.version === version) === true;
}

export async function tagAt(api, tag, commit) {
  const found = await api(`/git/refs/tags/${encodeURIComponent(tag)}`, { missing: true });
  if (found) {
    let object = found.object;
    if (object.type === 'tag') object = (await api(`/git/tags/${object.sha}`)).object;
    if (object.type !== 'commit' || object.sha !== commit) throw new Error(`Existing tag differs: ${tag}`);
  } else await api('/git/refs', { method: 'POST', body: { ref: `refs/tags/${tag}`, sha: commit } });
}

export async function stage(item, quality, file, baseProduct, token) {
  let staged = await gitea(`/releases/tags/${encodeURIComponent(item.tag)}`, { missing: true });
  if (!staged && await registered(item.channel, item.version)) {
    console.log(`${item.tag} is already registered; preserving historical release without creating a candidate.`);
    return null;
  }
  let approved;
  if (staged) {
    approved = JSON.parse(staged.body).publication;
    verifyReceipt(approved);
    if (approved.channel !== item.channel || approved.version !== item.version) throw new Error('Staged release identity differs');
  } else {
    approved = { ...item, sha256: digest(file) };
    approved.receipt = signReceipt(approved, quality, process.env.RELEASE_SIGNING_PRIVATE_KEY);
    const existingTag = await gitea(`/tags/${encodeURIComponent(item.tag)}`, { missing: true });
    if (existingTag && existingTag.commit?.id !== item.commit) throw new Error('Existing Gitea tag differs from approved source');
    // Persist approval before the first external asset write. Recovery reuses it.
    staged = await gitea('/releases', { method: 'POST', body: { tag_name: item.tag, target_commitish: item.commit,
      name: item.tag, draft: true, prerelease: false, body: JSON.stringify({ publication: approved }) } });
  }
  if (digest(file) !== approved.sha256) throw new Error('Prepared bytes differ from original staged approval; recover its original CI artifact');
  const localAssets = await gitea(`/releases/${staged.id}/assets`);
  const stored = localAssets.filter((one) => one.name === item.filename);
  if (stored.length > 1) throw new Error('Ambiguous Gitea release assets');
  if (stored[0]) reconcileAsset(stored[0], approved, await bytes(stored[0].browser_download_url, { token: process.env.GITEA_TOKEN }));
  else {
    const form = new FormData(); form.append('attachment', new Blob([file]), item.filename);
    const response = await fetch(`${SOURCE}/api/v1/repos/${INTERNAL}/releases/${staged.id}/assets`, { method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GITEA_TOKEN}` }, body: form, redirect: 'error', signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`Gitea asset upload failed: HTTP ${response.status}`);
  }
  const api = (route, options) => gh(route, token, options);
  await tagAt(api, item.tag, approved.commit);
  let release = await api(`/releases/tags/${encodeURIComponent(item.tag)}`, { missing: true });
  if (!release) release = await api('/releases', { method: 'POST', body: { tag_name: item.tag, target_commitish: approved.commit,
    name: item.tag, body: baseProduct.changes.map((one) => `- ${one.summary}`).join('\n'), draft: false, prerelease: false, make_latest: 'false' } });
  if (release.draft || release.prerelease) throw new Error('Expected a stable public GitHub release');
  const matches = release.assets.filter((one) => one.name === item.filename);
  if (matches.length > 1) throw new Error('Ambiguous GitHub release assets');
  if (matches[0]) reconcileAsset(matches[0], approved, await bytes(matches[0].browser_download_url));
  else await bytes(`https://uploads.github.com/repos/${PUBLIC}/releases/${release.id}/assets?name=${encodeURIComponent(item.filename)}`,
    { token, method: 'POST', body: file, type: 'application/octet-stream' });
  await gitea(`/releases/${staged.id}`, { method: 'PATCH', body: { draft: false } });
  return { ...approved, released_at: release.published_at, size_bytes: file.length };
}

export function mergeManifests(base, previous, accepted, priorPublications, receiptKey, workerSource) {
  if (base.schema_version !== 1 || previous.schema_version !== 1) throw new Error('Manifest schema differs');
  const products = base.products.map((product) => {
    const old = previous.products.find((one) => one.id === product.id);
    if (old?.version === product.version) return old;
    const current = accepted.find((one) => (one.channel === 'npm' ? 'ci-cli' : 'vscode-extension') === product.id);
    if (['ci-cli', 'vscode-extension'].includes(product.id) && !current) return old || product;
    if (!current) return product;
    return { ...product, released_at: current.released_at, tag: current.tag,
      links: { ...product.links, release: `https://github.com/${PUBLIC}/releases/tag/${current.tag}` },
      artifacts: [{ kind: current.channel === 'npm' ? 'npm-tarball' : 'vsix', url: current.artifact_url,
        size_bytes: current.size_bytes, sha256: current.sha256 }] };
  });
  const publications = [...accepted, ...priorPublications.filter((old) => !accepted.some((one) => one.channel === old.channel && one.version === old.version))].slice(0, 100);
  for (const item of publications) verifyReceipt(item, receiptKey);
  return { releases: { ...base, products }, publications: { schema_version: 1, repository: PUBLIC,
    producer_commit: base.commit, worker_source: workerSource, publications } };
}

export function alreadyPrepared(document, commit, mirrored, receiptKey) {
  if (document?.producer_commit !== commit || mirrored !== commit) return false;
  if (document.schema_version !== 1 || document.repository !== PUBLIC || !Array.isArray(document.publications)) throw new Error('Invalid existing producer checkpoint');
  if (verifyRuntime(document.worker_source, receiptKey).commit !== commit) throw new Error('Worker source checkpoint differs');
  for (const item of document.publications) verifyReceipt(item, receiptKey);
  return true;
}

async function publishManifest(documents, token, commit, directory) {
  const remote = `https://github.com/${PUBLIC}.git`;
  execFileSync('git', ['fetch', remote, 'release-manifest'], { stdio: 'pipe', timeout: 90_000 });
  const tip = execFileSync('git', ['rev-parse', 'FETCH_HEAD'], { encoding: 'utf8' }).trim();
  const old = (name) => JSON.parse(execFileSync('git', ['show', `${tip}:${name}.json`], { encoding: 'utf8' }));
  const releases = old('releases');
  let publications;
  try { publications = old('publications'); } catch { publications = { publications: [] }; }
  const fingerprint = (value) => JSON.stringify(value.products);
  if (fingerprint(releases) === fingerprint(documents.releases) && JSON.stringify(publications) === JSON.stringify(documents.publications)) return;
  const tree = path.join(directory, 'manifest');
  execFileSync('git', ['worktree', 'add', '--detach', tree, tip], { stdio: 'pipe' });
  try {
    for (const [name, document] of Object.entries(documents)) await writeFile(path.join(tree, `${name}.json`), JSON.stringify(document, null, 2) + '\n');
    const git = (args) => execFileSync('git', ['-C', tree, ...args], { stdio: 'pipe', encoding: 'utf8' });
    git(['add', 'releases.json', 'publications.json']);
    git(['-c', 'user.name=OpenSpec Gitea', '-c', 'user.email=openspec-ci@localhost', 'commit', '-m', `Release manifest for ${commit}`]);
    const revision = git(['rev-parse', 'HEAD']).trim();
    mirrorGit('OpenSpec-UI', revision, token, 'release-manifest');
    console.log(`Retained manifest history at ${revision}; Homepage polling reconciles lost notifications.`);
  } finally { execFileSync('git', ['worktree', 'remove', tree], { stdio: 'pipe' }); }
}

export async function main() {
  if (process.env.GITEA_REF !== 'refs/heads/main' || process.env.GITEA_REPOSITORY !== INTERNAL) throw new Error('Release producer requires authoritative main');
  const current = (await gitea('/branches/main')).commit.id;
  const runs = (await gitea('/actions/runs?limit=50')).workflow_runs;
  const run = runs.find((one) => one.head_sha === current && one.path === 'quality.yml@refs/heads/main' && one.event === 'push' && one.status === 'completed');
  if (!run) { console.log('Current main Quality has not completed; no mirror or release write.'); return; }
  const quality = mainQualityProof(run, (await gitea(`/actions/runs/${run.id}/jobs`)).jobs, current);
  if (execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== current) throw new Error('Checkout no longer matches authoritative main');
  const prior = await json(`https://raw.githubusercontent.com/${PUBLIC}/release-manifest/publications.json`, { missing: true });
  const token = await githubToken('OpenSpec-UI');
  const mirrored = await gh('/git/ref/heads/main', token);
  if (alreadyPrepared(prior, current, mirrored.object.sha)) {
    console.log('Checked main is already prepared; no repeated artifact downloads or registry work.'); return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'openspec-approved-'));
  try {
    const cli = await artifact(run.id, 'openspec-cli-artifact', directory);
    const vsix = await artifact(run.id, 'openspec-ui-vsix', directory);
    const base = JSON.parse(await cli('releases-base.json'));
    if (base.commit !== current || base.repository !== PUBLIC) throw new Error('Typed release contract source differs');
    mirrorGit('OpenSpec-UI', current, token);
    const accepted = [];
    for (const [channel, id, get] of [['npm', 'ci-cli', cli], ['marketplace', 'vscode-extension', vsix]]) {
      const product = base.products.find((one) => one.id === id);
      const identity = assetIdentity(channel, product.version, current);
      // Recovery uses original approved bytes, not a new build of the same version.
      const staged = await gitea(`/releases/tags/${encodeURIComponent(identity.tag)}`, { missing: true });
      let getBytes = get;
      if (staged) {
        const original = JSON.parse(staged.body).publication;
        verifyReceipt(original);
        Object.assign(identity, { commit: original.commit });
        const assets = await gitea(`/releases/${staged.id}/assets`);
        const stored = assets.find((one) => one.name === identity.filename);
        if (stored) getBytes = async () => bytes(stored.browser_download_url, { token: process.env.GITEA_TOKEN });
        else if (original.receipt) getBytes = await artifact(verifyReceipt(original).quality.id, channel === 'npm' ? 'openspec-cli-artifact' : 'openspec-ui-vsix', directory);
      }
      const file = await getBytes(identity.filename);
      const archive = path.join(directory, identity.filename); await writeFile(archive, file);
      validatePackage(identity, archive);
      const result = await stage(identity, quality, file, product, token);
      if (result) accepted.push(result);
    }
    const previous = await json(`https://raw.githubusercontent.com/${PUBLIC}/release-manifest/releases.json`);
    const files = Object.fromEntries(await Promise.all(RUNTIME_FILES.map(async (name) => [name, digest(await readFile(name))])));
    const workerSource = signRuntime(current, quality, files, process.env.RELEASE_SIGNING_PRIVATE_KEY);
    await publishManifest(mergeManifests(base, previous, accepted, prior?.publications || [], undefined, workerSource), token, current, directory);
  } finally { await rm(directory, { recursive: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
