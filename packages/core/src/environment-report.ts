// What this machine and this workspace are missing, asked before a run
// rather than discovered by being refused — a-doctor-says-what-would-stop-a-run.
//
// `resolveChainStart` already answers every precondition of one change's
// run, and answers it only when somebody names a change and asks to run
// it. A person setting this up on a new machine finds out what is
// missing by being told no, which is the shape `a-lease-says-who`
// rejected for the workspace lease: a strange way to ask a question, and
// one that answers it only at the moment you are being refused.
//
// Every fact here is read from something that already decides it:
// agent presence from `detectAvailableAgentsDetailed`, the holder of the
// workspace from `readWorkspaceLeaseHolder`, the git identity from
// `readGitAuthor`, the configuration from `resolveHarnessConfig`. This
// module aggregates and classifies; it decides nothing a second time.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { detectAvailableAgentsDetailed, detectExecutable, type DetectedAgent } from "./agent-detection.js";
import { AGENT_REGISTRY } from "./agents/registry.js";
import { readGitAuthor } from "./git.js";
import { resolveHarnessConfig } from "./harness-config.js";
import { hostKindLabel, readWorkspaceLeaseHolder, type WorkspaceLeaseConflict } from "./workspace-lease.js";

/** How much a finding matters.
 *
 * Two values, not a scale: the question this report answers is "will a
 * run start here", and a finding either stops one or does not. A middle
 * value would be a place to put anything nobody wanted to decide
 * about. */
export type FindingSeverity = "stops-a-run" | "worth-knowing";

export interface Finding {
  /** Stable across runs, so a script can act on one without matching
   * prose. */
  id: string;
  severity: FindingSeverity;
  /** What is true, in one sentence a person reads. */
  statement: string;
  /** What to do about it — a command this repository has, where there is
   * one. Absent where the remedy is not a command (a workspace held by
   * somebody else's live run is waited for, not fixed). */
  remedy?: string;
}

export interface EnvironmentReport {
  workspaceRoot: string;
  findings: Finding[];
}

export interface EnvironmentReportOptions {
  workspaceRoot: string;
  /** Test seams. Production passes nothing and gets the real probes —
   * the same shape every other reader in this package offers. */
  detectAgents?: typeof detectAvailableAgentsDetailed;
  detectTool?: typeof detectExecutable;
  readLeaseHolder?: typeof readWorkspaceLeaseHolder;
  readAuthor?: typeof readGitAuthor;
  /** The running Node.js version, `process.version` in production. */
  nodeVersion?: string;
}

/** True when `version` satisfies `range`, `false` when it does not, and
 * `undefined` when this cannot tell.
 *
 * Deliberately tiny: it reads the `>=X` / `<Y` / `^X` clause forms this
 * repository's own `engines` field uses, on the major version only, and
 * answers `undefined` for anything else rather than guessing. A full
 * semver implementation is a dependency, and a partial one that silently
 * treats what it cannot parse as satisfied is how a check stops
 * checking. */
export function satisfiesMajorRange(version: string, range: string): boolean | undefined {
  const major = Number(/^v?(\d+)/u.exec(version)?.[1]);
  if (!Number.isInteger(major)) return undefined;

  const clauses = range.trim().split(/\s+/u).filter((clause) => clause.length > 0);
  if (clauses.length === 0) return undefined;

  let satisfied = true;
  for (const clause of clauses) {
    const match = /^(>=|<=|<|>|\^|=)?v?(\d+)/u.exec(clause);
    if (!match) return undefined;
    const bound = Number(match[2]);
    switch (match[1]) {
      case ">=": satisfied &&= major >= bound; break;
      case ">": satisfied &&= major > bound; break;
      case "<=": satisfied &&= major <= bound; break;
      case "<": satisfied &&= major < bound; break;
      case "^": satisfied &&= major === bound; break;
      case "=": case undefined: satisfied &&= major === bound; break;
      default: return undefined;
    }
  }
  return satisfied;
}

async function readEngines(workspaceRoot: string): Promise<Record<string, string>> {
  try {
    const manifest = JSON.parse(await readFile(path.join(workspaceRoot, "package.json"), "utf8")) as {
      engines?: Record<string, string>;
    };
    return manifest.engines ?? {};
  } catch {
    // A workspace with no manifest pins no runtime, which is a fact
    // about the workspace and not a finding about the machine.
    return {};
  }
}

function runtimeFinding(tool: string, version: string | undefined, range: string | undefined): Finding | undefined {
  if (range === undefined) return undefined;
  if (version === undefined) {
    return {
      id: `runtime-${tool}-unknown`,
      severity: "worth-knowing",
      statement: `This workspace pins ${tool} ${range}, and the running ${tool} version could not be read.`,
    };
  }
  const satisfied = satisfiesMajorRange(version, range);
  if (satisfied === true) return undefined;
  if (satisfied === undefined) {
    return {
      id: `runtime-${tool}-unreadable-range`,
      severity: "worth-knowing",
      statement: `This workspace pins ${tool} "${range}", which this check cannot read. Running ${tool} is ${version}.`,
    };
  }
  return {
    id: `runtime-${tool}`,
    severity: "stops-a-run",
    statement: `Running ${tool} is ${version}; this workspace pins ${range}.`,
    remedy: "Use the runtime pinned in package.json (volta + engines), not an arbitrary global one.",
  };
}

function leaseFinding(holder: WorkspaceLeaseConflict | undefined): Finding | undefined {
  if (!holder) return undefined;
  const author = holder.author ? `, git author ${holder.author}` : "";
  // Held, never `stops-a-run`. A busy workspace is not a broken one, and
  // reporting it as a failure would make this disagree with `lease`,
  // which exits 0 either way.
  return {
    id: "workspace-held",
    severity: "worth-knowing",
    statement:
      `${hostKindLabel(holder.hostKind)} on ${holder.hostname}, pid ${holder.pid}${author}`
      + ` holds this workspace (last reported itself ${Math.round(holder.heartbeatAgeMs / 1000)}s ago).`,
    remedy: "Wait for it, or stop that process. `openspec-ui-cli lease` describes it.",
  };
}

export async function readEnvironmentReport(options: EnvironmentReportOptions): Promise<EnvironmentReport> {
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const detectAgents = options.detectAgents ?? detectAvailableAgentsDetailed;
  const detectTool = options.detectTool ?? detectExecutable;
  const findings: Finding[] = [];

  const engines = await readEngines(workspaceRoot);
  const nodeFinding = runtimeFinding("node", options.nodeVersion ?? process.version, engines["node"]);
  if (nodeFinding) findings.push(nodeFinding);

  const [openspec, npm, agents, holder, author] = await Promise.all([
    detectTool("openspec"),
    engines["npm"] === undefined ? Promise.resolve<DetectedAgent>({ detected: true }) : detectTool("npm"),
    detectAgents(),
    (options.readLeaseHolder ?? readWorkspaceLeaseHolder)(workspaceRoot),
    (options.readAuthor ?? readGitAuthor)(workspaceRoot),
  ]);

  if (!openspec.detected) {
    findings.push({
      id: "openspec-cli",
      severity: "stops-a-run",
      statement: "The `openspec` CLI is not on this PATH.",
      remedy: "Install it: npm install -g @openspec/cli",
    });
  }

  const npmFinding = runtimeFinding("npm", npm.detected ? npm.version : undefined, engines["npm"]);
  if (npmFinding) findings.push(npmFinding);

  // Every agent this build carries, from the registry rather than a
  // second list — an agent added later is covered without anybody
  // remembering this file.
  const missing = AGENT_REGISTRY.filter((agent) => agents[agent.id]?.detected !== true).map((agent) => agent.id);
  if (missing.length === AGENT_REGISTRY.length) {
    findings.push({
      id: "no-agent",
      severity: "stops-a-run",
      statement: "No agent this build carries is installed, so no stage that needs one can run.",
      remedy: "Install at least one of: " + AGENT_REGISTRY.map((agent) => agent.id).join(", "),
    });
  } else if (missing.length > 0) {
    findings.push({
      id: "some-agents-missing",
      severity: "worth-knowing",
      statement: `Not installed here: ${missing.join(", ")}. A stage configured to use one of them will refuse to start.`,
    });
  }

  try {
    await resolveHarnessConfig(workspaceRoot);
  } catch (error) {
    findings.push({
      id: "harness-config",
      severity: "stops-a-run",
      statement: `This workspace's harness configuration could not be read: ${error instanceof Error ? error.message : String(error)}`,
      remedy: "Fix openspec/agent-harness.json. HARNESS.md documents every key it accepts.",
    });
  }

  const held = leaseFinding(holder);
  if (held) findings.push(held);

  if (author === undefined) {
    findings.push({
      id: "git-identity",
      severity: "worth-knowing",
      statement: "No git identity is configured here, so a lease taken from this directory records none.",
      remedy: "git config user.email you@example.com",
    });
  }

  return { workspaceRoot, findings };
}

/** Whether anything found would stop a run — the one question the exit
 * code is derived from. */
export function stopsARun(report: EnvironmentReport): boolean {
  return report.findings.some((finding) => finding.severity === "stops-a-run");
}
