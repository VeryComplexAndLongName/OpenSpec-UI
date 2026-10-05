// What the Pipeline reads about this directory's own changes, assembled in
// one place — the-pipeline-opens-in-vs-code.
//
// The standalone server's readiness route assembled this payload itself:
// the report, then suggestions unless the harness configuration turns them
// off. The editor's Pipeline panel needs the same payload, and a second
// copy of "off means not computed" would be the second of two promises
// that drift apart (ADR 0001, ADR 0029).

import { readAgentStatuses, resolveAgentStatusDirectory, type AgentStatusReport } from "./agent-status.js";
import { readChangeReadiness } from "./change-readiness.js";
import type { ChangeReadinessReport } from "./change-readiness-facts.js";
import { createGitWrapper } from "./git.js";
import {
  readChangeHarnessConfig,
  resolveHarnessConfig,
  resolveSupervisor,
  type HarnessConfig,
  type ResolvedSupervisor,
} from "./harness-config.js";
import { buildHints, type Hint } from "./hints.js";
import { readLastRuns } from "./last-runs.js";
import type { LastRunsReport } from "./last-runs-facts.js";
import { superviseRuns } from "./supervisor.js";
import { WORKSPACE_LEASE_STALE_AFTER_MS } from "./workspace-lease.js";

/** The workspace's configuration, or `undefined` where it cannot be read.
 * A configuration that cannot be read is not this reading's problem to
 * report — the readiness report is still answerable, so it carries no
 * suggestions rather than failing. */
async function workspaceConfig(workspaceRoot: string): Promise<HarnessConfig | undefined> {
  try {
    return await resolveHarnessConfig(workspaceRoot);
  } catch {
    return undefined;
  }
}

export interface SupervisorHintOptions {
  /** Test seams: the records, in place of reading them. */
  statuses?: AgentStatusReport[];
  lastRuns?: LastRunsReport;
}

/** What the supervisor points out about this repository's runs
 * (the-supervisor-advises, ADR 0039), under the workspace's configuration
 * and each change's own.
 *
 * A diagnostic about runs never makes a reading fail: records that cannot
 * be read give no suggestions, and a change whose own file cannot be read
 * is supervised as the workspace is. */
export async function readSupervisorHints(
  workspaceRoot: string,
  config: HarnessConfig,
  options: SupervisorHintOptions = {},
): Promise<Hint[]> {
  const workspace = resolveSupervisor(config.supervisor);
  const perChange = new Map<string, ResolvedSupervisor>();
  const supervisorFor = (changeName: string | null): ResolvedSupervisor =>
    changeName === null ? workspace : perChange.get(changeName) ?? workspace;

  const [statuses, lastRuns] = await Promise.all([
    options.statuses ?? readStatuses(workspaceRoot),
    options.lastRuns ?? readLastRuns({ workspaceRoot }).catch((): LastRunsReport => ({ byChange: {} })),
  ]);
  // Only the changes a record or a last run names are read, each once.
  const named = new Set<string>([
    ...statuses.map((report) => report.changeName).filter((name): name is string => name !== null),
    ...Object.keys(lastRuns.byChange),
  ]);
  await Promise.all([...named].map(async (changeName) => {
    try {
      const own = await readChangeHarnessConfig(workspaceRoot, changeName);
      if (own?.supervisor !== undefined) perChange.set(changeName, resolveSupervisor({ ...config.supervisor, ...own.supervisor }));
    } catch {
      // Supervised as the workspace is: see above.
    }
  }));
  return superviseRuns({ statuses, lastRuns, supervisorFor });
}

async function readStatuses(workspaceRoot: string): Promise<AgentStatusReport[]> {
  try {
    const directory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot);
    return (await readAgentStatuses(directory)).reports;
  } catch {
    return [];
  }
}

/** Every suggestion this workspace computes for a readiness report: what
 * can run together, then what the supervisor points out. `undefined` where
 * suggestions are off, or the configuration cannot be read: absent means
 * enabled, so a workspace that has never heard of them still gets them.
 * The one list `advise` prints and the Pipeline shows. */
export async function readAllHints(
  workspaceRoot: string,
  report: ChangeReadinessReport,
  options: SupervisorHintOptions = {},
): Promise<Hint[] | undefined> {
  const config = await workspaceConfig(workspaceRoot);
  if (config === undefined || config.hints?.enabled === false) return undefined;
  return [
    ...buildHints(report, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS }),
    ...await readSupervisorHints(workspaceRoot, config, options),
  ];
}

/** Every active change of `workspaceRoot`, its state and what it can run
 * alongside, with the suggestions drawn from it.
 *
 * Off means not computed: no suggestion is derived at all, and the report
 * carries no `hints` key. A suggestion computed and then hidden costs the
 * same and is a different promise than the switch makes
 * (a-hint-says-what-can-run-together). */
export async function readPipelineReadiness(
  workspaceRoot: string,
  options: SupervisorHintOptions = {},
): Promise<ChangeReadinessReport> {
  const report = await readChangeReadiness({ workspaceRoot });
  const hints = await readAllHints(workspaceRoot, report, options);
  return hints === undefined ? report : { ...report, hints };
}
