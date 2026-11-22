import { createHash } from "node:crypto";
import { lstat, open, realpath, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { createChangeInItsWorktree, type ChangeMade } from "./change-in-its-worktree.js";
import { forgeFor } from "./forge.js";
import { createGitWrapper } from "./git.js";
import { parseForgeRemote } from "./forge-remote.js";
import type { Forge } from "./gh-pr-gateway.js";
import { assertIssueNumber, issueError, type ForgeIssue } from "./forge-issue.js";
import { createChange } from "./openspec.js";

export interface IssuePreview extends ForgeIssue {
  sourceUrl: string;
  forge: string;
  revision: string;
  truncated: boolean;
}

export interface IssueChangeOptions {
  repositoryRoot: string;
  reference: string;
  /** Test seams; hosts supply neither. */
  forge?: Forge;
  remoteUrl?: string;
}

export async function previewIssueChange(options: IssueChangeOptions): Promise<IssuePreview> {
  const url = options.remoteUrl ?? await createGitWrapper({ cwd: options.repositoryRoot }).remoteUrl("origin");
  const remote = url === undefined ? undefined : parseForgeRemote(url);
  if (!remote) throw issueError("OSW-CHG-026");
  const forge = options.forge ?? await forgeFor(options.repositoryRoot);
  if (!forge.readIssue) throw issueError("OSW-CHG-027");
  const base = forge.issueWebBase ?? remote.webBase ?? `https://${remote.host}`;
  const prefix = `${base.replace(/\/$/, "")}/${remote.path.split("/").map(encodeURIComponent).join("/")}${forge.name === "GitLab" ? "/-" : ""}/issues/`;
  const reference = options.reference.trim();
  let number: number;
  if (/^#?[1-9][0-9]*$/.test(reference)) number = Number(reference.replace(/^#/, ""));
  else {
    let parsed: URL;
    try { parsed = new URL(reference); } catch { throw issueError("OSW-CHG-028"); }
    if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.href.startsWith(prefix)) {
      throw issueError("OSW-CHG-029");
    }
    const suffix = parsed.href.slice(prefix.length);
    if (!/^[1-9][0-9]*$/.test(suffix)) throw issueError("OSW-CHG-030");
    number = Number(suffix);
  }
  assertIssueNumber(number);
  const issue = await forge.readIssue(number);
  const sourceUrl = `${prefix}${number}`;
  const revision = createHash("sha256").update(JSON.stringify({ ...issue, sourceUrl, forge: forge.name })).digest("hex");
  return { ...issue, title: issue.title.slice(0, 512), body: issue.body.slice(0, 32768), sourceUrl, forge: forge.name, revision,
    truncated: issue.title.length > 512 || issue.body.length > 32768 };
}

export async function createChangeFromIssue(options: IssueChangeOptions & {
  changeName: string;
  revision: string;
  make?: typeof createChangeInItsWorktree;
  create?: typeof createChange;
}): Promise<ChangeMade> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.changeName)) throw issueError("OSW-CHG-031");
  const preview = await previewIssueChange(options);
  if (preview.revision !== options.revision) throw issueError("OSW-CHG-032");
  return (options.make ?? createChangeInItsWorktree)({
    repositoryRoot: options.repositoryRoot, changeName: options.changeName,
    createOptions: { description: preview.title },
    create: async (name, runOptions, createOptions) => {
      const created = await (options.create ?? createChange)(name, runOptions, createOptions);
      await writeFile(path.join(runOptions.cwd, "openspec", "changes", name, "source-issue.json"), JSON.stringify(preview, null, 2) + "\n", { flag: "wx" });
      return created;
    },
  });
}

/** Only this designated bounded source may supplement schema artifacts. */
export async function readIssueSource(changeDir: string): Promise<string | undefined> {
  const file = path.join(changeDir, "source-issue.json");
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 256 * 1024) return undefined;
    const root = await realpath(changeDir);
    if (path.dirname(await realpath(file)) !== root) return undefined;
    const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    let text: string;
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.dev !== stat.dev || opened.ino !== stat.ino || opened.size > 256 * 1024) return undefined;
      const buffer = Buffer.alloc(256 * 1024 + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > 256 * 1024) return undefined;
      text = buffer.subarray(0, bytesRead).toString("utf8");
    } finally { await handle.close(); }
    const source = JSON.parse(text) as Partial<IssuePreview>;
    if (typeof source.title !== "string" || source.title.length > 512 || typeof source.body !== "string" || source.body.length > 32768
      || typeof source.sourceUrl !== "string" || !/^https?:\/\//.test(source.sourceUrl) || source.sourceUrl.length > 2048
      || typeof source.revision !== "string" || !/^[a-f0-9]{64}$/.test(source.revision)
      || !Number.isSafeInteger(source.number) || typeof source.forge !== "string" || typeof source.state !== "string"
      || typeof source.updatedAt !== "string" || typeof source.truncated !== "boolean") return undefined;
    return JSON.stringify({ number: source.number, title: source.title, body: source.body, sourceUrl: source.sourceUrl,
      forge: source.forge, state: source.state, updatedAt: source.updatedAt, truncated: source.truncated, revision: source.revision }, null, 2);
  } catch { return undefined; }
}
