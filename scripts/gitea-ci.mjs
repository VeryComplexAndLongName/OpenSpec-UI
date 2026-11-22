import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

export function requireResults(results, { event, head = '' }) {
  const version = event === 'pull_request' && head === 'changeset-release/main';
  const expected = ['dependency-audit', version ? 'version-pr' : 'quality'];
  if (!version) expected.push('extension-integration', 'browser-e2e');
  if (event === 'pull_request') {
    expected.push('dependency-review', 'changeset');
    if (!version) expected.push('openspec-validate');
  }
  for (const job of expected) {
    if (results[job] !== 'success') throw new Error(`Required Gitea job ${job}: ${results[job] ?? 'missing'}`);
  }
}

export function checkWorkflow(source) {
  const YAML = createRequire(import.meta.url)('yaml');
  const workflow = YAML.parse(source);
  const jobs = workflow.jobs ?? {};
  const required = ['quality', 'dependency-audit', 'dependency-review', 'changeset',
    'openspec-validate', 'extension-integration', 'browser-e2e', 'version-pr'];
  for (const id of required) {
    if (!jobs[id] || jobs[id]['runs-on'] !== 'hppmcp-pr') throw new Error(`Missing internal quality job ${id}`);
    if (!jobs['ci-ready']?.needs?.includes(id)) throw new Error(`Aggregate gate omits ${id}`);
  }
  if (/secrets\./u.test(source)) throw new Error('Quality may not receive production secrets');
  if (workflow.env?.NODE_VERSION !== '24.21.0' || workflow.env?.NPM_VERSION !== '10.9.0') {
    throw new Error('Pinned runtime required');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv[2] === 'results') {
      const results = Object.fromEntries(Object.entries(JSON.parse(process.env.CI_RESULTS)).map(([id, job]) => [id, job.result]));
      requireResults(results, { event: process.env.CI_EVENT, head: process.env.CI_HEAD });
    } else checkWorkflow(readFileSync('.gitea/workflows/quality.yml', 'utf8'));
    console.log('Gitea quality policy passed.');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
