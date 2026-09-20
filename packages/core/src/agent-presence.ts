// An agent that is working, whether or not it is a run
// (an-agent-says-where-it-is-working).
//
// `withAgentStatus` writes a status record around a **run**: a chain or a
// single stage this product started. An agent editing the repository by
// hand is not a run, so on 2026-09-20 two of them worked for a morning
// with `.agent-status` empty and the Pipeline showing nobody, and found
// each other only when one was about to commit the other's files.
//
// The record is the one a run writes, not a second kind. Every reader -
// the Pipeline, the Changes views, `readAgentStatuses`, the leases - knows
// that shape already, and a second shape would mean teaching each of them,
// with the first reader to forget it reporting an empty machine.

import { startAgentStatusWriter, type AgentStatusWriter } from "./agent-status.js";

export interface AgentPresenceOptions {
  /** The working directory this agent is working in. */
  cwd: string;
  /** The change it is working on, where it is working on one. */
  changeName?: string;
  /** What it is doing, in the present tense, as a run's activity reads. */
  activity: string;
  /** Test seams, the same ones a run's writer takes. */
  resolveDirectory?: (cwd: string) => Promise<string>;
  loadKey?: Parameters<typeof startAgentStatusWriter>[0]["loadKey"];
  readGitAuthor?: (cwd: string) => Promise<string | undefined>;
}

/** An agent's presence, while it lasts. */
export interface AgentPresence {
  /** The instance id its record carries, so a caller can say which record
   * is its own. */
  instanceId: string;
  /** Says what it is doing now. */
  report(activity: string): Promise<void>;
  /** Removes the record. A presence that is not ended expires by the same
   * staleness window a run's record expires by. */
  end(): Promise<void>;
}

/** Reports this agent into the status directory beside the repository,
 * and keeps the record alive until `end`.
 *
 * Best-effort in the same way a run's record is: `undefined` where none
 * could be started - not a git repository, no status directory - and the
 * agent goes on working exactly as it would have. Being unseen is a
 * smaller failure than refusing to work. */
export async function announceAgent(options: AgentPresenceOptions): Promise<AgentPresence | undefined> {
  const writer: AgentStatusWriter | undefined = await startAgentStatusWriter({
    cwd: options.cwd,
    changeName: options.changeName ?? null,
    // No run id: this is an agent at a desk, not a run this product
    // started, and nothing downstream should join it to an audit entry.
    runId: null,
    ...(options.resolveDirectory !== undefined ? { resolveDirectory: options.resolveDirectory } : {}),
    ...(options.loadKey !== undefined ? { loadKey: options.loadKey } : {}),
    ...(options.readGitAuthor !== undefined ? { readGitAuthor: options.readGitAuthor } : {}),
  });
  if (writer === undefined) return undefined;

  await writer.reportActivity(options.activity);
  return {
    instanceId: writer.instanceId,
    report: (activity: string) => writer.reportActivity(activity),
    end: () => writer.stop(),
  };
}
