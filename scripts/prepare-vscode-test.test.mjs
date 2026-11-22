import assert from 'node:assert/strict';
import test from 'node:test';
import { metadata } from './prepare-vscode-test.mjs';

test('editor metadata accepts only official stable archive, fixed version and SHA-256', () => {
  const value = { productVersion: '1.147.0', sha256hash: 'a'.repeat(64), url: `https://vscode.download.prss.microsoft.com/dbazure/download/stable/${'b'.repeat(40)}/code-stable-x64-1234.tar.gz` };
  assert.equal(metadata(value), value);
  for (const changed of [{ productVersion: '../other' }, { sha256hash: '' }, { url: 'https://attacker.invalid/code.tar.gz' },
    { url: value.url + '?redirect=elsewhere' }, { url: value.url.replace('https:', 'http:') }]) assert.throws(() => metadata({ ...value, ...changed }));
});
