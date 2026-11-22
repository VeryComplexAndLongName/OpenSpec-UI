// Keep application CI, artifact preparation and registry executors separate.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLISH_WORKFLOW = '.circleci/config.yml';
const executable = (source) => source.split(/\r?\n/u).filter((line) => !line.trim().startsWith('#')).join('\n');

export function checkPublishWorkflow(source) {
  const problems = [];
  let workflow;
  try { workflow = parse(source); } catch { return ['invalid publisher YAML']; }
  if (Object.keys(workflow.jobs ?? {}).join(',') !== 'npm-publication') problems.push('CircleCI runs only the npm publication worker');
  const run = workflow.workflows?.['npm-publication'];
  if (run?.when !== 'pipeline.git.branch == "main"' || run?.jobs?.length !== 1
      || run.jobs[0]?.['npm-publication']?.context !== 'npm-publication') problems.push('Exact main and approved context are required');
  if (run?.jobs?.[0]?.['npm-publication']?.['serial-group'] !== '<< pipeline.project.slug >>/npm-publication') problems.push('Serialize the npm channel across push and scheduled pipelines');
  const job = workflow.jobs?.['npm-publication'];
  if (!job?.docker?.[0]?.image?.startsWith('node:24.21.0-bookworm@sha256:') || job.resource_class !== 'small') problems.push('Pin the hosted runtime and bounded executor');
  const commands = (job?.steps ?? []).filter((one) => one.run).map((one) => one.run.command ?? one.run).join('\n');
  if (!commands.includes('npm@12.1.0') || !commands.includes('timeout 300 node scripts/publication-worker.mjs npm')) problems.push('Use the pinned client and Homepage queue worker');
  if (/npm ci|npm run build|vsce |npm publish|changeset publish|--provenance=true/u.test(commands)) problems.push('Publisher must not rebuild or bypass the queue');
  if (/VSCE_PAT|NPM_TOKEN|NODE_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_APP_PRIVATE_KEY|MAINTENANCE_TOKEN/u.test(executable(source))) problems.push('No persistent registry or mirror credentials in CircleCI');
  return problems;
}

export async function checkOtherWorkflows(directory = root) {
  const problems = [];
  let legacy = [];
  try { legacy = await readdir(path.join(directory, '.github/workflows')); } catch { /* Retired. */ }
  for (const file of legacy.filter((one) => /\.ya?ml$/u.test(one))) problems.push(`GitHub Actions must be retired: ${file}`);
  const workflows = path.join(directory, '.gitea/workflows');
  for (const file of await readdir(workflows)) {
    if (!/\.ya?ml$/u.test(file)) continue;
    const source = executable(await readFile(path.join(workflows, file), 'utf8'));
    if (/VSCE_PAT|NPM_TOKEN|NODE_AUTH_TOKEN|npm publish|vsce publish|changeset publish/u.test(source)) problems.push(`${file}: Gitea prepares artifacts, never registry writes`);
    if (file !== 'release.yml' && /MIRROR_APP_PRIVATE_KEY|RELEASE_SIGNING_PRIVATE_KEY/u.test(source)) problems.push(`${file}: production producer keys belong only to checked release preparation`);
    if (!['version.yml', 'dependencies.yml'].includes(file) && /MAINTENANCE_TOKEN/u.test(source)) problems.push(`${file}: maintenance credentials belong only to reviewed proposal jobs`);
    if (file === 'release.yml' && /^\s*(?:GITHUB_APP_PRIVATE_KEY|RELEASE_SIGNING_PRIVATE_KEY):/mu.test(source)) problems.push('Use single-line encoded producer keys; multiline environment logging can disclose PEM');
  }
  const service = await readFile(path.join(directory, 'deploy/publication/marketplace.service'), 'utf8');
  for (const boundary of ['User=openspec-publisher', 'ProtectSystem=strict', 'NoNewPrivileges=yes',
    'OPENSPEC_MARKETPLACE_CERTIFICATE=/etc/openspec-publisher/marketplace-publisher.pem', 'publication-worker.mjs marketplace']) {
    if (!service.includes(boundary)) problems.push(`Marketplace worker lacks ${boundary}`);
  }
  return problems;
}

export async function checkAll(directory = root) {
  try {
    return [...checkPublishWorkflow(await readFile(path.join(directory, PUBLISH_WORKFLOW), 'utf8')), ...await checkOtherWorkflows(directory)];
  } catch (error) { return [`Publication configuration is missing or unreadable: ${error.code || error.name}`]; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await checkAll();
  if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
  else console.log('Independent publication policy passed.');
}
