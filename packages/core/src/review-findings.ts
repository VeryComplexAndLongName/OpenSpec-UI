import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import type { SimpleGit } from "simple-git";
import { z } from "zod";
import { assertValidChangeName } from "./change-name.js";

const headSchema = z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u);
const textSchema = z.string().trim().min(1).max(500).refine((value) => !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value));
const repoPath = textSchema.refine((value) => !/[:\\]/u.test(value)
  && value.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const at = z.strictObject({ path: repoPath, line: z.number().int().positive().max(1_000_000).optional() });
const action = z.enum(["fixed", "verified", "dismissed", "reopen"]);
const decision = z.strictObject({ action, commit: headSchema, note: textSchema });
const finding = z.strictObject({ id: z.uuid(), description: textSchema, openedAt: headSchema,
  location: at.optional(), decisions: z.array(decision).max(20) });
const ledger = z.strictObject({ findings: z.array(finding).max(100) });
const maxBytes = 256 * 1024;
const revisionSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const inputSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("add"), head: headSchema, revision: revisionSchema, description: textSchema, location: at.optional() }),
  z.strictObject({ kind: z.literal("decide"), head: headSchema, revision: revisionSchema, id: z.uuid(), action, note: textSchema }),
]);
export type ReviewFindingRequest = z.infer<typeof inputSchema>;
type Finding = z.infer<typeof finding>;
type Ledger = z.infer<typeof ledger>;
type Decision = z.infer<typeof action>;
type Status = "open" | Exclude<Decision, "reopen">;
const transitions: Record<Status, readonly Decision[]> = {
  open: ["fixed", "dismissed"],
  fixed: ["verified", "dismissed", "reopen"],
  verified: ["reopen"],
  dismissed: ["reopen"],
};
export interface ReviewFindings {
  revision: string;
  entries: Array<Finding & { status: Status; actions: readonly Decision[] }>;
}

function status(entry: Finding): Status {
  const last = entry.decisions.at(-1)?.action;
  return last === undefined || last === "reopen" ? "open" : last;
}

async function filePath(git: SimpleGit, change: string, create: boolean): Promise<string> {
  assertValidChangeName(change);
  const common = await realpath((await git.raw(["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim());
  const directory = path.join(common, "openspec-ui", "review-findings");
  if (create) await mkdir(directory, { recursive: true });
  const resolved = await realpath(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (resolved && path.relative(directory, resolved) !== "") throw new Error("The findings directory is outside the expected Git directory.");
  return path.join(directory, createHash("sha256").update(change).digest("hex") + ".json");
}

async function read(file: string): Promise<{ data: Ledger; revision: string }> {
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (info && (!info.isFile() || info.size > maxBytes)) throw new Error("The findings file is not a bounded regular file.");
  const raw = info ? await readFile(file, "utf8") : '{"findings":[]}';
  const data = ledger.parse(JSON.parse(raw));
  if (new Set(data.findings.map((entry) => entry.id)).size !== data.findings.length) throw new Error("The findings file contains duplicate IDs.");
  return { data, revision: createHash("sha256").update(raw).digest("hex") };
}

function report(data: Ledger, revision: string): ReviewFindings {
  return { revision, entries: data.findings.map((entry) => {
    const current = status(entry);
    return { ...entry, status: current, actions: transitions[current] };
  }) };
}

async function apply(git: SimpleGit, data: Ledger, request: ReviewFindingRequest): Promise<void> {
  if (request.kind === "add") {
    data.findings.push({ id: randomUUID(), description: request.description, openedAt: request.head,
      ...(request.location === undefined ? {} : { location: request.location }), decisions: [] });
    return;
  }
  const entry = data.findings.find((one) => one.id === request.id);
  if (!entry || !transitions[status(entry)].includes(request.action)) throw new Error("That finding cannot take this decision.");
  const previous = entry.decisions.at(-1)?.commit ?? entry.openedAt;
  const includes = (commit: string) => git.raw(["merge-base", "--is-ancestor", commit, request.head]).then(() => true, () => false);
  if (request.action === "fixed" && (previous === request.head || !await includes(previous))) {
    throw new Error("Check out a correction commit that follows the reviewed revision.");
  }
  if (request.action === "verified") {
    const fixed = entry.decisions.at(-1);
    if (fixed?.action !== "fixed" || !await includes(fixed.commit)) throw new Error("The reviewed commit does not contain the recorded correction.");
  }
  entry.decisions.push({ action: request.action, commit: request.head, note: request.note });
}

export async function readReviewFindings(git: SimpleGit, change: string): Promise<ReviewFindings> {
  const saved = await read(await filePath(git, change, false));
  return report(saved.data, saved.revision);
}

export async function editReviewFindings(git: SimpleGit, change: string, head: string | undefined, input: unknown): Promise<ReviewFindings> {
  const request = inputSchema.parse(input);
  const currentHead = async () => (await git.raw(["rev-parse", "--verify", "HEAD"])).trim();
  if (head !== request.head || await currentHead() !== head) throw new Error("Open a fresh PR Review for the current commit.");
  const file = await filePath(git, change, true);
  const pending = file + ".new";
  const handle = await open(pending, "wx", 0o600);
  let installed = false;
  try {
    const saved = await read(file);
    if (saved.revision !== request.revision) throw new Error("The findings changed. Open a fresh PR Review.");
    await apply(git, saved.data, request);
    const raw = JSON.stringify(saved.data);
    if (Buffer.byteLength(raw, "utf8") > maxBytes || !ledger.safeParse(saved.data).success) {
      throw new Error("The change's findings or decision history exceed the local limit.");
    }
    await handle.writeFile(raw, "utf8");
    await handle.close();
    if (await currentHead() !== head || (await read(file)).revision !== saved.revision) {
      throw new Error("The reviewed commit or findings changed before saving.");
    }
    await rename(pending, file);
    installed = true;
    return report(saved.data, createHash("sha256").update(raw).digest("hex"));
  } finally {
    await handle.close().catch(() => undefined);
    if (!installed) await unlink(pending);
  }
}
