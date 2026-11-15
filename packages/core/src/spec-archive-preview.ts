import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SimpleGit } from "simple-git";
import { CHANGE_DIFF_MAX_BYTES } from "./change-diff.js";
import { isValidChangeName } from "./change-name.js";
import { openGit } from "./git-client.js";
import { applyArchiveInDirectory } from "./openspec.js";
import { defaultPreviewRef } from "./pr-review.js";

const exec = promisify(execFile);
const SPEC_PATH = /^specs\/([a-z0-9][a-z0-9-]*)\/spec\.md$/u;
const ARTIFACT = /^(?:proposal\.md|design\.md|tasks\.md|\.openspec\.yaml)$/u;
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const MAX_BRANCHES = 50;

function blocks(text: string): Map<string, string> {
  const requirements = new Map<string, string>();
  for (const match of text.matchAll(/^### Requirement:\s*([^\r\n]+)\r?\n([\s\S]*?)(?=^#{2,3}\s|$(?![\s\S]))/gmu)) {
    requirements.set(match[1]!.trim(), match[2]!.replace(/\r\n/gu, "\n").trim());
  }
  return requirements;
}

function deltaNames(text: string): Set<string> {
  const names = new Set(blocks(`${text.trimEnd()}\n`).keys());
  for (const match of text.matchAll(/^\s*-\s+(?:FROM|TO):\s*(?:### Requirement:\s*)?(.+)$/gmu)) {
    names.add(match[1]!.trim());
  }
  return names;
}

function inline(value: string): string {
  const safe = value.replace(/[`\p{Cc}\p{Zl}\p{Zp}]/gu, " ");
  return `\`${safe}\``;
}

async function list(git: SimpleGit, revision: string, prefix: string): Promise<string[]> {
  return (await git.raw(["ls-tree", "-r", "--name-only", "-z", revision, "--", prefix]))
    .split("\0").filter((file) => file.startsWith(prefix)).map((file) => file.slice(prefix.length));
}

async function read(git: SimpleGit, revision: string, file: string): Promise<string> {
  return git.raw(["show", `${revision}:${file}`]);
}

async function save(root: string, file: string, value: string): Promise<void> {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, value, "utf8");
}

async function patch(root: string): Promise<string> {
  const args = ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--no-color", "--", "before", "openspec/specs"];
  const output = await exec("git", args, { cwd: root, maxBuffer: CHANGE_DIFF_MAX_BYTES * 4 })
    .then((result) => result.stdout)
    .catch((error: { code?: unknown; stdout?: string }) => {
      if (error.code !== 1 || error.stdout === undefined) throw error;
      return error.stdout;
    });
  const bytes = Buffer.from(output);
  const end = bytes.length > CHANGE_DIFF_MAX_BYTES ? bytes.lastIndexOf(10, CHANGE_DIFF_MAX_BYTES - 1) + 1 : bytes.length;
  if (end === 0) return output === "" ? "No specification files would change." : "The patch exceeds the display limit.";
  return `~~~diff\n${bytes.subarray(0, end).toString("utf8")}\n~~~${end < bytes.length ? "\n\nThe patch is truncated." : ""}`;
}

export async function readSpecArchivePreview(root: string, change: string, apply = applyArchiveInDirectory): Promise<string> {
  if (!isValidChangeName(change)) return "Choose an active OpenSpec change.";
  const git = openGit(root);
  const baseRef = await defaultPreviewRef(git).catch(() => undefined);
  if (baseRef === undefined) return "The local default branch could not be identified.";
  const commit = async (ref: string) =>
    (await git.raw(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).catch(() => "")).trim();
  const [head, base] = await Promise.all([commit("HEAD"), commit(baseRef)]);
  if (!SHA.test(head) || !SHA.test(base)) return "The committed change or default branch could not be read.";
  const ancestor = (await git.raw(["merge-base", head, base]).catch(() => "")).trim();
  const changePath = `openspec/changes/${change}/`;
  const files = await list(git, head, changePath);
  const deltas = files.filter((file) => SPEC_PATH.test(file));
  if (deltas.length === 0) return "This commit has no OpenSpec delta specs to preview.";

  const source = await Promise.all(deltas.map(async (file) => ({
    file,
    capability: SPEC_PATH.exec(file)![1]!,
    text: await read(git, head, changePath + file),
  })));
  const basePaths = new Set(await list(git, base, "openspec/"));
  const sharedPaths = SHA.test(ancestor) ? new Set(await list(git, ancestor, "openspec/")) : undefined;
  const refs = (await git.raw(["for-each-ref", "--format=%(refname:short)", "refs/heads/"])).trim().split("\n")
    .filter((branch) => branch !== change && isValidChangeName(branch));
  const lines = [`## Archive preview for ${inline(change)}`, "",
    `- Change commit: ${inline(head)}.`, `- Default branch: ${inline(baseRef)} at ${inline(base)}.`, "",
    "### Requirement changes and overlaps", ""];
  if (sharedPaths === undefined) lines.push("- No local common ancestor was available for comparison.");
  if (refs.length > MAX_BRANCHES) lines.push(`- Overlap inspection was limited to ${MAX_BRANCHES} local branches.`);
  const baseline = async (revision: string, known: Set<string>, file: string) =>
    known.has(file) ? read(git, revision, `openspec/${file}`) : "";

  const scratch = await mkdtemp(path.join(os.tmpdir(), "openspec-spec-preview-"));
  try {
    await mkdir(path.join(scratch, "before"));
    await mkdir(path.join(scratch, "openspec", "specs"), { recursive: true });
    for (const delta of source) {
      const current = await baseline(base, basePaths, delta.file);
      const previous = sharedPaths === undefined ? undefined : await baseline(ancestor, sharedPaths, delta.file);
      const before = blocks(previous ?? "");
      const now = blocks(current);
      const affected = deltaNames(delta.text);
      for (const requirement of affected) {
        if (previous !== undefined && before.get(requirement) !== now.get(requirement)) {
          lines.push(`- ${inline(delta.capability)} / ${inline(requirement)} changed on the default branch.`);
        }
      }
      const overlaps = await Promise.all(refs.slice(0, MAX_BRANCHES).map(async (branch) => {
        const otherRoot = `openspec/changes/${branch}/`;
        const ref = `refs/heads/${branch}`;
        const otherFiles = await list(git, ref, otherRoot);
        if (!otherFiles.includes(delta.file)) return [];
        const other = deltaNames(await read(git, ref, otherRoot + delta.file));
        return [...affected].filter((name) => other.has(name)).map((name) =>
          `- ${inline(delta.capability)} / ${inline(name)} also appears in ${inline(branch)}.`);
      }));
      lines.push(...overlaps.flat());
      if (basePaths.has(delta.file)) {
        await save(scratch, `before/${delta.capability}/spec.md`, current);
        await save(scratch, `openspec/${delta.file}`, current);
      }
      await save(scratch, changePath + delta.file, delta.text);
    }
    for (const file of files.filter((name) => ARTIFACT.test(name))) {
      await save(scratch, changePath + file, await read(git, head, changePath + file));
    }
    if (lines.at(-1) === "") lines.push("- No requirement changes or overlaps found in the local commits.");
    lines.push("", "### Predicted specification diff", "");
    try {
      await apply(change, { cwd: scratch });
      lines.push(await patch(scratch));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lines.push(...message.split(/\r?\n/u).map((line) => `> ${inline(line)}`));
    }
    return lines.join("\n");
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 4 });
  }
}
