import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, cp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { checkPublishWorkflow, checkOtherWorkflows } from './check-publish-workflow.mjs';

const GOOD = await readFile(new URL('../.circleci/config.yml', import.meta.url), 'utf8');
test('publication-only CircleCI configuration passes', () => assert.deepEqual(checkPublishWorkflow(GOOD), []));
for (const [name, mutate] of [
  ['non-main context', (w) => { w.workflows['npm-publication'].when = 'true'; }],
  ['foreign context', (w) => { w.workflows['npm-publication'].jobs[0]['npm-publication'].context = 'other'; }],
  ['concurrent channel writers', (w) => { delete w.workflows['npm-publication'].jobs[0]['npm-publication']['serial-group']; }],
  ['extra publisher', (w) => { w.jobs.extra = w.jobs['npm-publication']; }],
  ['rebuild', (w) => { w.jobs['npm-publication'].steps.push({ run: 'npm ci && npm run build' }); }],
  ['direct publication', (w) => { w.jobs['npm-publication'].steps.push({ run: 'npm publish' }); }],
  ['permanent credential', (w) => { w.jobs['npm-publication'].environment = { NPM_TOKEN: 'placeholder' }; }],
]) test(`refuses ${name}`, () => { const data = parse(GOOD); mutate(data); assert.ok(checkPublishWorkflow(stringify(data)).length); });

test('retired GitHub jobs and a second Gitea registry writer are refused', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'publication-policy-'));
  try {
    await mkdir(path.join(directory, '.github/workflows'), { recursive: true });
    await mkdir(path.join(directory, '.gitea/workflows'), { recursive: true });
    await mkdir(path.join(directory, 'deploy/publication'), { recursive: true });
    await cp(new URL('../deploy/publication/marketplace.service', import.meta.url), path.join(directory, 'deploy/publication/marketplace.service'));
    assert.deepEqual(await checkOtherWorkflows(directory), []);
    await writeFile(path.join(directory, '.github/workflows/publish.yml'), 'on: workflow_dispatch');
    await writeFile(path.join(directory, '.gitea/workflows/bypass.yml'), 'run: npm publish');
    assert.equal((await checkOtherWorkflows(directory)).length, 2);
  } finally { await rm(directory, { recursive: true }); }
});
