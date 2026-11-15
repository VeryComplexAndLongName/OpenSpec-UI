import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SimpleGit } from "simple-git";
import { CHANGE_DIFF_MAX_BYTES } from "./change-diff.js";
import { isValidChangeName } from "./change-name.js";
import { openGit } from "./git-client.js";
import { say } from "./message-register.js";
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

function deltaNames(text: string, requirements = blocks(text)): Set<string> {
  const names = new Set(requirements.keys());
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

interface RequirementOverlap {
  capability: string;
  requirement: string;
  baseChanged: boolean;
  branches: string[];
  ancestor: string | undefined;
  current: string | undefined;
  proposed: string | undefined;
}

async function analyze(root: string, change: string) {
  if (!isValidChangeName(change)) return { reason: say("OSW-CHG-001", { name: change }).text };
  const git = openGit(root);
  const baseRef = await defaultPreviewRef(git).catch(() => undefined);
  if (baseRef === undefined) return { reason: say("OSW-CHG-007").text };
  const commit = async (ref: string) =>
    (await git.raw(["rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`]).catch(() => "")).trim();
  const [head, base] = await Promise.all([commit("HEAD"), commit(baseRef)]);
  if (!SHA.test(head) || !SHA.test(base)) return { reason: say("OSW-CHG-012").text };
  const ancestor = (await git.raw(["merge-base", head, base]).catch(() => "")).trim();
  const changePath = `openspec/changes/${change}/`;
  const files = await list(git, head, changePath);
  const deltas = files.filter((file) => SPEC_PATH.test(file));
  if (deltas.length === 0) return { reason: say("OSW-CHG-013").text };

  const basePaths = new Set(await list(git, base, "openspec/"));
  const sharedPaths = SHA.test(ancestor) ? new Set(await list(git, ancestor, "openspec/")) : undefined;
  const refs = (await git.raw(["for-each-ref", "--format=%(refname:short)", "refs/heads/"])).trim().split("\n")
    .filter((branch) => branch !== change && isValidChangeName(branch));
  const candidates = await Promise.all(refs.slice(0, MAX_BRANCHES).map(async (branch) => {
    const revision = await commit(`refs/heads/${branch}`);
    if (!SHA.test(revision) || revision === head) return undefined;
    const prefix = `openspec/changes/${branch}/`;
    return { branch, revision, prefix, files: new Set(await list(git, revision, prefix)) };
  }));
  const baseline = async (revision: string, known: Set<string>, file: string) =>
    known.has(file) ? read(git, revision, `openspec/${file}`) : "";
  const findings: RequirementOverlap[] = [];
  const source = [];
  for (const file of deltas) {
    const capability = SPEC_PATH.exec(file)![1]!;
    const [text, current, previous] = await Promise.all([
      read(git, head, changePath + file), baseline(base, basePaths, file),
      sharedPaths === undefined ? undefined : baseline(ancestor, sharedPaths, file),
    ]);
    const before = blocks(previous ?? "");
    const now = blocks(current);
    const proposed = blocks(text);
    const affected = deltaNames(text, proposed);
    const others = await Promise.all(candidates.flatMap((candidate) =>
      candidate?.files.has(file) ? [read(git, candidate.revision, candidate.prefix + file).then((delta) =>
        ({ branch: candidate.branch, names: deltaNames(delta) }))] : []));
    for (const requirement of affected) {
      const baseChanged = previous !== undefined && before.get(requirement) !== now.get(requirement);
      const branches = others.filter((other) => other.names.has(requirement)).map((other) => other.branch);
      if (baseChanged || branches.length > 0) findings.push({ capability, requirement, baseChanged, branches,
        ancestor: before.get(requirement), current: now.get(requirement), proposed: proposed.get(requirement) });
    }
    source.push({ file, capability, text, current });
  }
  return { git, baseRef, head, base, ancestor: sharedPaths === undefined ? undefined : ancestor,
    branchCount: refs.length, findings, source, files, changePath, basePaths };
}

function overlapLines(result: Exclude<Awaited<ReturnType<typeof analyze>>, { reason: string }>): string[] {
  const lines: string[] = [];
  if (result.ancestor === undefined) lines.push("- No local common ancestor was available for comparison.");
  if (result.branchCount > MAX_BRANCHES) lines.push(`- Overlap inspection was limited to ${MAX_BRANCHES} local branches.`);
  if (result.findings.length === 0) lines.push("- No requirement changes or overlaps found in the inspected commits.");
  for (const finding of result.findings) {
    const key = `${inline(finding.capability)} / ${inline(finding.requirement)}`;
    if (finding.baseChanged) lines.push(`- ${key} changed on the default branch.`);
    for (const branch of finding.branches) lines.push(`- ${key} also appears in ${inline(branch)}.`);
  }
  return lines;
}

function requirementText(text: string | undefined): string {
  if (text === undefined) return "No requirement body at this revision.";
  if (text.length === 0) return "The requirement has no body.";
  const body = text.slice(0, 2_000);
  const fence = "~".repeat(Math.max(3, ...[...body.matchAll(/~+/gu)].map((part) => part[0].length + 1)));
  return `${fence}text\n${body}\n${fence}${body.length === text.length ? "" : "\n\nRequirement text truncated."}`;
}

export async function readSpecOverlapReport(root: string, change: string): Promise<string> {
  const result = await analyze(root, change);
  if (result.reason !== undefined) return result.reason;
  const lines = [`## Specification overlaps for ${inline(change)}`, "",
    `- Change commit: ${inline(result.head)}.`,
    `- Locally known default branch: ${inline(result.baseRef)} at ${inline(result.base)}.`,
    ...(result.ancestor === undefined ? [] : [`- Common ancestor: ${inline(result.ancestor)}.`]),
    "", ...overlapLines(result)];
  for (const finding of result.findings.slice(0, 10)) {
    lines.push("", `### ${inline(finding.capability)} / ${inline(finding.requirement)}`, "",
      "**Common ancestor**", "", result.ancestor === undefined ? "Unavailable." : requirementText(finding.ancestor), "",
      "**Current default branch**", "", requirementText(finding.current), "",
      "**Proposed delta**", "", requirementText(finding.proposed));
  }
  if (result.findings.length > 10) lines.push("", "Requirement text is shown for the first 10 findings.");
  return lines.join("\n");
}

export async function readSpecArchivePreview(root: string, change: string, apply = applyArchiveInDirectory): Promise<string> {
  const result = await analyze(root, change);
  if (result.reason !== undefined) return result.reason;
  const { git, head, base, baseRef, source, files, changePath, basePaths } = result;
  const lines = [`## Archive preview for ${inline(change)}`, "",
    `- Change commit: ${inline(head)}.`, `- Default branch: ${inline(baseRef)} at ${inline(base)}.`, "",
    "### Requirement changes and overlaps", "", ...overlapLines(result)];
  const scratch = await mkdtemp(path.join(os.tmpdir(), "openspec-spec-preview-"));
  try {
    await mkdir(path.join(scratch, "before"));
    await mkdir(path.join(scratch, "openspec", "specs"), { recursive: true });
    for (const delta of source) {
      if (basePaths.has(delta.file)) {
        await save(scratch, `before/${delta.capability}/spec.md`, delta.current);
        await save(scratch, `openspec/${delta.file}`, delta.current);
      }
      await save(scratch, changePath + delta.file, delta.text);
    }
    for (const file of files.filter((name) => ARTIFACT.test(name))) {
      await save(scratch, changePath + file, await read(git, head, changePath + file));
    }
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
