import assert from 'node:assert/strict';
import test from 'node:test';
import { allowedPaths, compatibleVscode } from './gitea-proposal.mjs';

test('version proposals may consume notes and package versions but never application code', () => {
  allowedPaths('version', ['.changeset/entry.md', 'packages/cli/package.json', 'packages/cli/CHANGELOG.md', 'package-lock.json']);
  for (const files of [[], ['packages/core/src/index.ts'], ['.gitea/workflows/release.yml'], ['README.md']]) assert.throws(() => allowedPaths('version', files));
});
test('dependency proposals only refresh the lock and preserve the declared VS Code baseline', () => {
  allowedPaths('dependencies', ['package-lock.json']);
  assert.throws(() => allowedPaths('dependencies', ['package.json']));
  const lock = (version) => ({ packages: { 'node_modules/@types/vscode': { version } } });
  compatibleVscode(lock('1.125.1'), lock('1.125.0'));
  compatibleVscode({ packages: { 'packages/extension/node_modules/@types/vscode': { version: '1.125.1' },
    'node_modules/@types/vscode': { version: '1.147.0' } } }, lock('1.125.0'));
  assert.throws(() => compatibleVscode({ packages: {
    'packages/extension/node_modules/@types/vscode': { version: '1.147.0' },
    'node_modules/@types/vscode': { version: '1.125.0' } } }, lock('1.125.0')));
  for (const version of ['1.90.0', '1.134.0', '2.0.0', undefined]) assert.throws(() => compatibleVscode(lock(version), lock('1.125.0')));
  assert.throws(() => compatibleVscode(lock('1.125.0'), lock(undefined)));
});
