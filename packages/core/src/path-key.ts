// A path as two paths are compared — shared by the readers that match a
// status record, a lease or a worktree to a directory.
//
// git spells a Windows path with forward slashes and a status record with
// backslashes, and a filesystem that folds case makes `C:\Repo` and
// `c:\repo` one directory. Comparing strings as written would call them two.

import path from "node:path";

/** `target` resolved, and case-folded where the filesystem folds case. */
export function pathKey(target: string): string {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
