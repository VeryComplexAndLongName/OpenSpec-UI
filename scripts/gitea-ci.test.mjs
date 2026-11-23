import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import { checkRunner, checkWorkflow, requireResults } from './gitea-ci.mjs';

const jobs = ['quality', 'dependency-audit', 'dependency-review', 'changeset',
  'openspec-validate', 'extension-integration', 'browser-e2e', 'version-pr'];
const green = Object.fromEntries(jobs.map((job) => [job, 'success']));
test('regular PR refuses every missing, skipped or failed required job', () => {
  requireResults(green, { event: 'pull_request' });
  for (const job of jobs.filter((id) => id !== 'version-pr')) {
    for (const state of [undefined, 'skipped', 'failure', 'cancelled']) {
      assert.throws(() => requireResults({ ...green, [job]: state }, { event: 'pull_request' }), /Required Gitea job/u);
    }
  }
});
test('version PR requires its own package result and independent security checks', () => {
  const results = { ...green, quality: 'skipped', 'browser-e2e': 'skipped', 'extension-integration': 'skipped' };
  const event = { event: 'pull_request', head: 'changeset-release/main' };
  requireResults(results, event);
  assert.throws(() => requireResults({ ...results, 'version-pr': 'skipped' }, event));
  assert.throws(() => requireResults({ ...results, 'dependency-audit': 'failure' }, event));
});
test('main requires actual application, native and browser results', () => {
  requireResults(green, { event: 'push' });
  assert.throws(() => requireResults({ ...green, quality: 'skipped' }, { event: 'push' }));
});
test('actual workflow includes every gate and refuses credentials or removed gates', () => {
  const source = readFileSync('.gitea/workflows/quality.yml', 'utf8');
  checkWorkflow(source);
  assert.throws(() => checkWorkflow(source + '\nextra: ${{ secrets.PRODUCTION_KEY }}'));
  assert.throws(() => checkWorkflow(source.replace('openspec-ci', 'ubuntu-latest')));
  assert.throws(() => checkWorkflow(source.replace('name: Dependency audit', "name: Dependency audit\n    if: github.event_name == 'pull_request'")), /audit/u);
});
test('runner refuses privileged execution, Docker socket mounts and unbounded jobs', () => {
  const source = readFileSync('.gitea/runner/config.yaml', 'utf8');
  checkRunner(source);
  for (const changed of [source.replace('privileged: false', 'privileged: true'),
    source.replace("docker_host: '-'", "docker_host: ''"),
    source.replace('valid_volumes: []', "valid_volumes: ['**']"),
    source.replace('--cgroup-parent=user.slice', ''),
    source.replace('--memory=6g', '')]) {
    assert.throws(() => checkRunner(changed));
  }
  assert.throws(() => checkRunner(source.replace('host: 192.168.137.34', 'host: 0.0.0.0')));
});
test('every workflow shell step parses before any command is executed', () => {
  const workflow = createRequire(import.meta.url)('yaml').parse(readFileSync('.gitea/workflows/quality.yml', 'utf8'));
  const input = Object.values(workflow.jobs).flatMap((job) => job.steps.filter((step) => step.run).map((step) => step.run)).join('\n\n');
  const parsed = spawnSync(process.env.OPENSPEC_TEST_BASH || 'bash', ['-n'], { input, encoding: 'utf8' });
  assert.equal(parsed.status, 0, parsed.stderr || parsed.error?.message);
});
