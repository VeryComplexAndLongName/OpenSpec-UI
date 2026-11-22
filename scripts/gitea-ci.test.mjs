import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { checkWorkflow, requireResults } from './gitea-ci.mjs';

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
  assert.throws(() => checkWorkflow(source.replace('hppmcp-pr', 'ubuntu-latest')));
});
