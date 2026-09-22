// The file system with nothing in between, for removing a directory tree
// (the-sweep-never-opens-an-archive).
//
// In the editor, Node's `fs` is Electron's, which reads a file named
// `*.asar` as an archive - a directory - and opens it. A recursive removal
// that meets one opens it, fails on it with EBUSY, and the editor then holds
// it for as long as it runs. A downloaded editor in `.vscode-test` holds
// `node_modules.asar`, so a finished working directory with one inside was
// left on disk, and the sweep said only what git had said before it: seen
// on 2026-09-22, and reproduced the same day in the editor's own Electron,
// where `original-fs` removed the same tree cleanly.
//
// Electron keeps the unpatched module as `original-fs`. Everything here
// that removes or walks a tree goes through this module, which is that one
// in the editor and Node's own everywhere else.

import fsPromises from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

type FsPromises = typeof fsPromises;

/** Electron's unpatched `fs`, where this runs in Electron. Loaded through a
 * `require` made here, since the extension's bundle has no `import.meta.url`
 * to make one from, and a bundler must not try to resolve the name. */
function originalFsPromises(): FsPromises | undefined {
  if (!process.versions.electron) return undefined;
  try {
    const load = createRequire(path.join(process.cwd(), "plain-fs.cjs"));
    return (load("original-fs") as { promises: FsPromises }).promises;
  } catch {
    return undefined;
  }
}

/** Whether this process reads `*.asar` as a plain file: always outside
 * Electron, and inside it only where `original-fs` was found. */
export const readsArchivesAsFiles: boolean = !process.versions.electron || originalFsPromises() !== undefined;

const promises: FsPromises = originalFsPromises() ?? fsPromises;

export const { readdir, rm, stat, lstat, unlink, rmdir } = promises;

/** Removes a directory tree, a `*.asar` in it included. A link inside it is
 * unlinked, never followed. A file held for a moment - an indexer, a
 * scanner - is tried again a few times before the removal fails. */
export async function removeTree(target: string): Promise<void> {
  await promises.rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
