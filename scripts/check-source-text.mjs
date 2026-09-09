import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

// A raw control byte in a source file makes it binary to `grep`, which
// then skips it silently: a search for a term the file contains returns
// nothing, and a search that matches it reports "Binary file ... matches"
// instead of the line. A file no search can reach is a file nobody
// reviews.
//
// One had been sitting in `packages/core/src/change-cost-report.ts` — a
// NUL written as a byte where the two-character escape was meant, almost
// certainly from a shell heredoc. Nothing reported it; it was found while
// reading something else. See openspec/changes/source-stays-text.

const SCANNED_EXTENSIONS = new Set([".md", ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yaml", ".yml"]);

/** Tab (0x09), newline (0x0a), carriage return (0x0d) and form feed
 * (0x0c) are ordinary in text. Everything else below 0x20 is not, and a
 * control character meant as a value belongs in an escape sequence. */
function isForbidden(byte) {
  return (byte < 0x09) || (byte > 0x0d && byte < 0x20) || byte === 0x0b;
}

export function findControlBytes(buffer) {
  const found = [];
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (isForbidden(byte)) found.push({ offset: index, byte });
  }
  return found;
}

function gitList(args) {
  const result = spawnSync("git", ["ls-files", "-z", ...args], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr?.toString() ?? "unknown error"}`);
  }
  return result.stdout.toString("utf8").split("\0").filter((entry) => entry.length > 0);
}

function filesToScan() {
  // git's own list, like `check-english.mjs` — a walk of the working tree
  // would trip over build output, caches and `.vscode-test`.
  //
  // Tracked *and* untracked-but-not-ignored. Scanning only tracked files
  // gives a false pass on exactly the files most likely to carry the
  // problem: a new one, before it is staged. That is how this check
  // passed locally on the very file it then failed on in CI, one day
  // after it was written — see what-runs-cost-here.
  return [...new Set([...gitList([]), ...gitList(["--others", "--exclude-standard"])])];
}

async function main() {
  const violations = [];
  for (const file of filesToScan()) {
    const dot = file.lastIndexOf(".");
    if (dot === -1 || !SCANNED_EXTENSIONS.has(file.slice(dot))) continue;
    let buffer;
    try {
      buffer = await readFile(file);
    } catch {
      continue; // deleted between listing and reading
    }
    for (const { offset, byte } of findControlBytes(buffer)) {
      // The offset, not just the file: "something is wrong somewhere"
      // costs the reader the search this check exists to make possible.
      const line = buffer.subarray(0, offset).toString("utf8").split("\n").length;
      violations.push(`${file}:${line} contains a raw control byte 0x${byte.toString(16).padStart(2, "0")} at offset ${offset}`);
      break; // one report per file is enough to send someone to it
    }
  }

  if (violations.length > 0) {
    for (const violation of violations) console.error(violation);
    console.error(`Source text check failed with ${violations.length} violation(s). Write control characters as escape sequences.`);
    process.exit(1);
  }
  console.log("Source text check passed.");
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replaceAll("\\", "/"))) {
  await main();
}
