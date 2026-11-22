import assert from 'node:assert/strict';
import test from 'node:test';
import { metadata, downloadRange } from './prepare-vscode-test.mjs';

test('editor metadata accepts only official stable archive, fixed version and SHA-256', () => {
  const value = { productVersion: '1.147.0', sha256hash: 'a'.repeat(64), url: `https://vscode.download.prss.microsoft.com/dbazure/download/stable/${'b'.repeat(40)}/code-stable-x64-1234.tar.gz` };
  assert.equal(metadata(value), value);
  for (const changed of [{ productVersion: '../other' }, { sha256hash: '' }, { url: 'https://attacker.invalid/code.tar.gz' },
    { url: value.url + '?redirect=elsewhere' }, { url: value.url.replace('https:', 'http:') }]) assert.throws(() => metadata({ ...value, ...changed }));
});

test('ranged downloader refuses ignored ranges, altered offsets, totals and incomplete bodies', async () => {
  const fetcher = (content, range = 'bytes 2-4/10', status = 206) => async () => new Response(content, { status, headers: { 'content-range': range } });
  assert.deepEqual((await downloadRange('https://unused.invalid', 2, 4, 10, fetcher('abc'))).data, Buffer.from('abc'));
  for (const response of [fetcher('abc', 'bytes 2-4/10', 200), fetcher('abc', 'bytes 0-2/10'),
    fetcher('abc', 'bytes 2-4/11'), fetcher('ab'), fetcher('abcd')]) {
    await assert.rejects(downloadRange('https://unused.invalid', 2, 4, 10, response));
  }
});
