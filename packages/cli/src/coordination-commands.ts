// Saying that this agent is here, and holding what this machine has one
// of (an-agent-says-where-it-is-working).
//
// Both commands run until they are interrupted, because both are about a
// period rather than a moment: an agent is present while it works, and a
// claim is held while the thing it guards is in use. Ending them is how
// the record goes away; leaving them to die is how it expires.

import os from "node:os";
import path from "node:path";

import {
  announceAgent,
  claimDirectoryBeside,
  CLAIM_RENEW_INTERVAL_MS,
  createGitWrapper,
  myRosterLabel,
  readClaim,
  releaseClaim,
  renewClaim,
  resolveAgentStatusDirectory,
  waitForClaim,
  type ResourceClaim,
} from "@openspec-ui/core";

export interface CoordinationIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Resolves when the command should end: a signal, or a test's own
   * promise. */
  untilStopped: () => Promise<void>;
}

/** How long a claim waits for a holder before reporting and giving up.
 * Ten minutes: a browser suite takes seven, so a second agent that wants
 * one waits out the first rather than failing beside it. */
export const DEFAULT_WAIT_SECONDS = 600;

export async function presentCommand(
  options: { workspaceRoot: string; changeName?: string; activity?: string },
  io: CoordinationIo,
): Promise<number> {
  const presence = await announceAgent({
    cwd: options.workspaceRoot,
    ...(options.changeName !== undefined ? { changeName: options.changeName } : {}),
    activity: options.activity ?? "working on this repository",
  });
  if (!presence) {
    io.stderr("openspec-ui-cli: could not report this agent; there is no status directory to write to.");
    return 1;
  }
  io.stdout(`openspec-ui-cli: reporting as ${presence.instanceId}. Other agents on this machine can see it.`);
  try {
    await io.untilStopped();
  } finally {
    await presence.end();
    io.stdout("openspec-ui-cli: no longer reporting.");
  }
  return 0;
}

function describeHolder(claim: ResourceClaim): string {
  return `${claim.holder} on ${claim.machine}, since ${claim.takenAt}`;
}

export async function claimCommand(
  options: { workspaceRoot: string; resource: string; waitSeconds?: number },
  io: CoordinationIo,
): Promise<number> {
  const statusDirectory = await resolveAgentStatusDirectory(
    createGitWrapper({ cwd: options.workspaceRoot }),
    options.workspaceRoot,
  );
  const directory = claimDirectoryBeside(statusDirectory);
  const holder = (await myRosterLabel(statusDirectory)) ?? os.userInfo().username;

  const held = await readClaim(directory, options.resource);
  if (held.state === "held") {
    io.stdout(`openspec-ui-cli: ${options.resource} is held by ${describeHolder(held.claim)}. Waiting.`);
  }

  const result = await waitForClaim({
    directory,
    resource: options.resource,
    holder,
    machine: os.hostname(),
    waitMs: (options.waitSeconds ?? DEFAULT_WAIT_SECONDS) * 1000,
    onWaiting: (claim, waitedMs) => {
      io.stdout(`openspec-ui-cli: still waiting for ${options.resource}, held by ${describeHolder(claim)} (${Math.round(waitedMs / 1000)}s).`);
    },
  });

  if (!result.taken) {
    io.stderr(
      `openspec-ui-cli: ${options.resource} is still held by ${describeHolder(result.held)};`
      + " not proceeding. Two of these at once produce failures that look like defects.",
    );
    return 1;
  }

  io.stdout(`openspec-ui-cli: holding ${options.resource}. It is released when this ends.`);
  const renewal = setInterval(() => {
    void renewClaim(directory, result.claim).catch(() => undefined);
  }, CLAIM_RENEW_INTERVAL_MS);
  try {
    await io.untilStopped();
  } finally {
    clearInterval(renewal);
    await releaseClaim(directory, options.resource).catch(() => undefined);
    io.stdout(`openspec-ui-cli: released ${options.resource}.`);
  }
  return 0;
}

/** Resolves when the process is interrupted. Kept here so the commands
 * above take a promise and a test needs no signals. */
export function untilInterrupted(): () => Promise<void> {
  return () => new Promise<void>((resolve) => {
    const done = (): void => {
      process.off("SIGINT", done);
      process.off("SIGTERM", done);
      resolve();
    };
    process.once("SIGINT", done);
    process.once("SIGTERM", done);
  });
}

/** The workspace root a command runs against, absolute. */
export function rootOf(cwd: string | undefined): string {
  return path.resolve(cwd ?? process.cwd());
}
