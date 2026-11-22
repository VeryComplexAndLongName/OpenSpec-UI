// Work around stalled test-electron streaming downloads without skipping its tests.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile, access, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function metadata(value) {
  const url = new URL(value.url);
  if (!/^\d+\.\d+\.\d+$/u.test(value.productVersion) || !/^[a-f0-9]{64}$/u.test(value.sha256hash)
      || url.origin !== 'https://vscode.download.prss.microsoft.com'
      || !/^\/dbazure\/download\/stable\/[a-f0-9]{40}\/code-stable-x64-\d+\.tar\.gz$/u.test(url.pathname)
      || url.search || url.hash) throw new Error('Unexpected official VS Code download metadata');
  return value;
}

export async function downloadRange(url, start, end, total, fetcher = fetch) {
  const response = await fetcher(url, { headers: { Range: `bytes=${start}-${end}` }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(response.headers.get('content-range') || '');
  const actualTotal = Number(match?.[3]);
  if (response.status !== 206 || !match || Number(match[1]) !== start || Number(match[2]) !== end
      || !Number.isSafeInteger(actualTotal) || actualTotal <= end || actualTotal > 500_000_000
      || (total !== null && actualTotal !== total)) {
    await response.body?.cancel();
    throw new Error('Official editor range differs from the requested bytes');
  }
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > end - start + 1) throw new Error('Official editor range exceeds limit');
    chunks.push(chunk);
  }
  if (size !== end - start + 1) throw new Error('Official editor range is incomplete');
  return { data: Buffer.concat(chunks), total: actualTotal };
}

async function archiveBytes(value) {
  const { total } = await downloadRange(value.url, 0, 0, null);
  const step = 1024 * 1024;
  const parts = Array(Math.ceil(total / step));
  let next = 0; let completed = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    for (;;) {
      const index = next++;
      if (index >= parts.length) return;
      let failure;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          parts[index] = (await downloadRange(value.url, index * step, Math.min(total - 1, (index + 1) * step - 1), total)).data;
          failure = undefined; break;
        } catch (error) { failure = error; }
      }
      if (failure) throw failure;
      if (++completed % 40 === 0) console.log(`Verified range lengths: ${completed}/${parts.length}`);
    }
  }));
  const data = Buffer.concat(parts);
  if (createHash('sha256').update(data).digest('hex') !== value.sha256hash) throw new Error('Official editor SHA-256 differs');
  return data;
}

export async function main(mode) {
  const file = path.join(process.env.RUNNER_TEMP, 'openspec-vscode.json');
  if (mode === 'metadata') {
    const response = await fetch('https://update.code.visualstudio.com/api/update/linux-x64/stable/latest', { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`VS Code metadata HTTP ${response.status}`);
    const value = metadata(await response.json());
    await writeFile(file, JSON.stringify(value));
    await appendFile(process.env.GITHUB_OUTPUT, `version=${value.productVersion}\nsha256=${value.sha256hash}\n`);
    return;
  }
  if (mode !== 'download') throw new Error('Expected metadata or download');
  const value = metadata(JSON.parse(await readFile(file, 'utf8')));
  const directory = path.resolve('packages/extension/.vscode-test', `vscode-linux-x64-${value.productVersion}`);
  try { await access(path.join(directory, 'is-complete')); console.log('Restored the exact editor cache; integration tests still run.'); return; } catch { /* Cold editor cache. */ }
  const archive = path.join(process.env.RUNNER_TEMP, 'openspec-vscode.tar.gz');
  await writeFile(archive, await archiveBytes(value));
  // This path is fixed under the test cache and its version has been validated.
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', directory, '--strip-components=1'], { timeout: 90_000 });
  await access(path.join(directory, 'code'));
  await writeFile(path.join(directory, 'is-complete'), '');
  console.log(`Verified VS Code ${value.productVersion}; real integration execution follows.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
