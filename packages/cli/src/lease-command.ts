// `openspec-ui-cli lease` and `lease release` — a-lease-says-who.
//
// Presentation only. Who holds a workspace is read by core
// (`readWorkspaceLeaseHolder`), and whether a lease may be cleared is
// decided by core (`releaseWorkspaceLease`); this turns either into
// something a person reads and an exit code.
//
// Until now the only way to learn who holds a workspace was to try to
// start a run and read the refusal, which is a strange way to ask a
// question and only answers it at the moment you are being told no.

import {
  WORKSPACE_LEASE_STALE_AFTER_MS,
  hostKindLabel,
  readWorkspaceLeaseHolder,
  releaseWorkspaceLease,
  type LeaseReleaseOutcome,
  type WorkspaceLeaseConflict,
} from "@openspec-ui/core";

export interface LeaseOptions {
  workspaceRoot: string;
  /** `undefined` asks who holds it; `"release"` tries to clear it. */
  action?: string;
  format: "text" | "json";
}

export interface LeaseDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams, the same shape `validateAll` already is. */
  read?: typeof readWorkspaceLeaseHolder;
  release?: typeof releaseWorkspaceLease;
}

export async function leaseCommand(options: LeaseOptions, deps: LeaseDeps): Promise<number> {
  if (options.action === "release") return await releaseLease(options, deps);
  if (options.action !== undefined) {
    deps.stderr(`openspec-ui-cli: unknown lease action '${options.action}' (supported: release)`);
    return 2;
  }
  return await describeHolder(options, deps);
}

/** Always `0`, held or free.
 *
 * The question was answered either way, and a script asking "is it free"
 * should read the output rather than infer it from a failure code — the
 * same reasoning `ready` uses for a repository where nothing can start. */
async function describeHolder(options: LeaseOptions, deps: LeaseDeps): Promise<number> {
  let holder: WorkspaceLeaseConflict | undefined;
  try {
    holder = await (deps.read ?? readWorkspaceLeaseHolder)(options.workspaceRoot);
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not read the workspace lease: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify({ held: holder !== undefined, ...(holder ? { holder } : {}) }, null, 2));
    return 0;
  }

  if (!holder) {
    deps.stdout("Nothing holds this workspace.");
    return 0;
  }
  for (const line of holderLines(holder)) deps.stdout(line);
  return 0;
}

/** `0` cleared, `1` refused, `2` could not look. */
async function releaseLease(options: LeaseOptions, deps: LeaseDeps): Promise<number> {
  let outcome: LeaseReleaseOutcome;
  try {
    outcome = await (deps.release ?? releaseWorkspaceLease)({ workspaceRoot: options.workspaceRoot });
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not release the workspace lease: ${message(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(outcome, null, 2));
    return outcome.kind === "cleared" ? 0 : 1;
  }

  if (outcome.kind === "cleared") {
    if (outcome.because === "already-free") {
      deps.stdout("Nothing held this workspace.");
    } else if (outcome.because === "stale") {
      const seconds = Math.round(WORKSPACE_LEASE_STALE_AFTER_MS / 1000);
      deps.stdout(`Cleared a lease whose holder had not reported itself for over ${seconds}s.`);
    } else {
      deps.stdout("Cleared. Its holder:");
      for (const line of holderLines(outcome.holder as WorkspaceLeaseConflict)) deps.stdout(`  ${line}`);
      deps.stdout("  that process is no longer running.");
    }
    return 0;
  }

  deps.stderr("openspec-ui-cli: will not release this lease.");
  for (const line of holderLines(outcome.holder)) deps.stderr(`  ${line}`);
  deps.stderr(`  ${outcome.reason}`);
  return 1;
}

function holderLines(holder: WorkspaceLeaseConflict): string[] {
  const lines = [
    `Held by ${hostKindLabel(holder.hostKind)} on ${holder.hostname}, pid ${holder.pid}.`,
    `Last reported itself ${Math.round(holder.heartbeatAgeMs / 1000)}s ago.`,
  ];
  // "git author", never "user": the value is self-declared and nothing
  // is gated on it. A line calling it a user would read as an identity
  // this system had established (a-lease-says-who).
  if (holder.author) lines.push(`Git author ${holder.author}.`);
  return lines;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
