// What the Pipeline reads about this directory's own changes, assembled in
// one place — the-pipeline-opens-in-vs-code.
//
// The standalone server's readiness route assembled this payload itself:
// the report, then suggestions unless the harness configuration turns them
// off. The editor's Pipeline panel needs the same payload, and a second
// copy of "off means not computed" would be the second of two promises
// that drift apart (ADR 0001, ADR 0029).

import { readChangeReadiness } from "./change-readiness.js";
import type { ChangeReadinessReport } from "./change-readiness-facts.js";
import { resolveHarnessConfig } from "./harness-config.js";
import { buildHints } from "./hints.js";
import { WORKSPACE_LEASE_STALE_AFTER_MS } from "./workspace-lease.js";

/** Absent means enabled: every configuration written before this key
 * existed says nothing about it, and a workspace that has never heard of
 * suggestions still gets them. A configuration that cannot be read is not
 * this reading's problem to report — the readiness report is still
 * answerable, so it carries no suggestions rather than failing. */
async function hintsEnabled(workspaceRoot: string): Promise<boolean> {
  try {
    return (await resolveHarnessConfig(workspaceRoot)).hints?.enabled !== false;
  } catch {
    return false;
  }
}

/** Every active change of `workspaceRoot`, its state and what it can run
 * alongside, with the suggestions drawn from it.
 *
 * Off means not computed: `buildHints` is not called at all, and the
 * report carries no `hints` key. A suggestion computed and then hidden
 * costs the same and is a different promise than the switch makes
 * (a-hint-says-what-can-run-together). */
export async function readPipelineReadiness(workspaceRoot: string): Promise<ChangeReadinessReport> {
  const report = await readChangeReadiness({ workspaceRoot });
  if (!(await hintsEnabled(workspaceRoot))) return report;
  return { ...report, hints: buildHints(report, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS }) };
}
