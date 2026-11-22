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
  execFileSync('curl', ['--http1.1', '--fail', '--location', '--connect-timeout', '15', '--max-time', '240', '--retry', '2', '--retry-max-time', '600', '--silent', '--show-error', '--output', archive, value.url], { stdio: 'inherit', timeout: 650_000 });
  if (createHash('sha256').update(await readFile(archive)).digest('hex') !== value.sha256hash) throw new Error('Official editor SHA-256 differs');
  // This path is fixed under the test cache and its version has been validated.
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', directory, '--strip-components=1'], { timeout: 90_000 });
  await access(path.join(directory, 'code'));
  await writeFile(path.join(directory, 'is-complete'), '');
  console.log(`Verified VS Code ${value.productVersion}; real integration execution follows.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main(process.argv[2]);
