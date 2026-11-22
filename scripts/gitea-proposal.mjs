// Maintenance proposes reviewed branches. Only the two named bot refs may reset.
import { execFileSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { gitea, INTERNAL } from './publication-transport.mjs';

export function allowedPaths(mode, files) {
  const rule = mode === 'version'
    ? /^(?:\.changeset\/[^/]+\.md|package-lock\.json|packages\/[^/]+\/(?:package\.json|CHANGELOG\.md))$/u
    : /^package-lock\.json$/u;
  if (!['version', 'dependencies'].includes(mode) || !files.length || files.some((name) => !rule.test(name))) throw new Error('Maintenance changed files outside its allowed scope');
}

export function compatibleVscode(lock) {
  const version = lock.packages?.['node_modules/@types/vscode']?.version;
  if (!version || !/^1\.90\.\d+$/u.test(version)) throw new Error('Automatic maintenance may not raise the VS Code baseline');
}

export async function main(mode) {
  if (!['version', 'dependencies'].includes(mode) || process.env.GITEA_REF !== 'refs/heads/main'
      || process.env.GITEA_REPOSITORY !== INTERNAL) throw new Error('Maintenance requires authoritative main');
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 });
  if (git(['status', '--porcelain']).trim()) throw new Error('Maintenance requires a clean checkout');
  if (mode === 'version') {
    const pending = (await readdir('.changeset')).filter((name) => name.endsWith('.md') && name !== 'README.md');
    if (!pending.length) { console.log('No pending changesets.'); return; }
  }
  execFileSync('npm', mode === 'version' ? ['run', 'changeset:version']
    : ['update', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit', timeout: 300_000 });
  const files = git(['diff', '--name-only']).trim().split('\n').filter(Boolean);
  if (!files.length) { console.log('No maintenance changes.'); return; }
  allowedPaths(mode, files);
  if (mode === 'dependencies') compatibleVscode(JSON.parse(await readFile('package-lock.json', 'utf8')));
  const branch = mode === 'version' ? 'changeset-release/main' : 'deps/lock-refresh';
  let previous;
  try { previous = (await gitea(`/branches/${encodeURIComponent(branch)}`)).commit.id; } catch (error) {
    if (!error.message.includes('HTTP 404')) throw error;
  }
  git(['checkout', '-B', branch]);
  git(['add', '--', ...files]);
  const title = mode === 'version' ? 'Version packages' : 'Refresh compatible dependency lock';
  git(['-c', 'user.name=OpenSpec Gitea', '-c', 'user.email=openspec-ci@localhost', 'commit', '-m', title]);
  // Explicit lease protects concurrent edits. Never force main, tags or other refs.
  const lease = `--force-with-lease=refs/heads/${branch}:${previous || ''}`;
  git(['push', lease, 'origin', `HEAD:refs/heads/${branch}`]);
  const prs = await gitea('/pulls?state=open&limit=50');
  const found = prs.find((one) => one.head.ref === branch && one.base.ref === 'main');
  if (found) console.log(`Updated Gitea PR ${found.number}; review and all required checks remain mandatory.`);
  else {
    const pr = await gitea('/pulls', { method: 'POST', body: { head: branch, base: 'main', title,
      body: mode === 'version' ? 'Consume pending authored Changesets and refresh package-lock.json together. Gitea validates product notes, installation, build and package smoke before merge. No automatic merge or registry write.'
        : 'Refresh only compatible lockfile resolutions within committed ranges. Exact pins and the VS Code baseline remain deliberate upgrades. Independent audit/review and full product CI must pass. No automatic merge.' } });
    console.log(`Created Gitea PR ${pr.number}.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
