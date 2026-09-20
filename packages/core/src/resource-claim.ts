// Who holds a resource this machine has only one of
// (an-agent-says-where-it-is-working).
//
// A working directory per change separates files and indexes; it does not
// separate ports, the processor, or the downloaded editor under
// `.vscode-test`. On 2026-09-20 three browser specs failed in a run that
// overlapped another agent's, and all six passed alone: two Playwright
// suites at once, in two directories, on one machine.
//
// A record rather than an operating-system lock, for one reason: a lock
// says nothing about who holds it, and who is exactly what the other
// agent needs to know. It is advisory - an agent that never asks holds
// nothing back - and it expires by heartbeat, as every record here does,
// so a claimant that dies does not hold a resource for ever.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export const CLAIM_RENEW_INTERVAL_MS = 5_000;
/** How long a claim outlives its last heartbeat. The status directory's
 * own window, so "gone" means one thing on this machine and not two. */
export const CLAIM_STALE_AFTER_MS = 30_000;

/** Where claims live: beside `.agent-status`, in ADR 0027's container. */
export function claimDirectoryBeside(statusDirectory: string): string {
  return path.join(path.dirname(path.resolve(statusDirectory)), ".agent-claims");
}

export interface ResourceClaim {
  /** The resource's name: `browser-suite`, `port:4317`, `editor`. */
  resource: string;
  /** Who holds it, as the roster labels them where it is known, and the
   * key id which is what the roster is keyed by. */
  holder: string;
  keyId?: string;
  machine: string;
  takenAt: string;
  heartbeatAt: string;
}

export type ClaimReading =
  | { state: "free" }
  | { state: "held"; claim: ResourceClaim; ageMs: number };

/** A file name that cannot escape the directory: a resource is named by
 * whoever asks, and `../` is a name too. */
function fileNameFor(resource: string): string {
  return `${encodeURIComponent(resource.trim().toLowerCase())}.json`;
}

function isClaim(value: unknown): value is ResourceClaim {
  if (typeof value !== "object" || value === null) return false;
  const claim = value as Record<string, unknown>;
  return typeof claim.resource === "string"
    && typeof claim.holder === "string"
    && typeof claim.machine === "string"
    && typeof claim.takenAt === "string"
    && typeof claim.heartbeatAt === "string"
    && Number.isFinite(Date.parse(claim.heartbeatAt));
}

/** Who holds a resource, or that it is free. A claim whose heartbeat is
 * older than the window is free: the claimant is gone. */
export async function readClaim(
  directory: string,
  resource: string,
  now: Date = new Date(),
): Promise<ClaimReading> {
  let text: string;
  try {
    text = await readFile(path.join(path.resolve(directory), fileNameFor(resource)), "utf8");
  } catch {
    return { state: "free" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A file nobody can read holds nothing: it is swept when the next
    // claimant takes the resource.
    return { state: "free" };
  }
  if (!isClaim(parsed)) return { state: "free" };
  const ageMs = now.getTime() - Date.parse(parsed.heartbeatAt);
  if (ageMs > CLAIM_STALE_AFTER_MS) return { state: "free" };
  return { state: "held", claim: parsed, ageMs };
}

export interface TakeClaimOptions {
  directory: string;
  resource: string;
  holder: string;
  machine: string;
  keyId?: string;
  now?: () => Date;
}

export type TakeClaimResult =
  | { taken: true; claim: ResourceClaim }
  | { taken: false; held: ResourceClaim };

/** Takes a resource that is free, and reports its holder where it is not.
 *
 * Written through a temporary name and a rename, which is atomic on one
 * filesystem, so two claimants racing produce one holder and one reader
 * of the other's record. The read before the write is what makes the
 * loser see the winner; the rename is what makes "one holder" true. */
export async function takeClaim(options: TakeClaimOptions): Promise<TakeClaimResult> {
  const now = (options.now ?? (() => new Date()))();
  const directory = path.resolve(options.directory);
  const existing = await readClaim(directory, options.resource, now);
  if (existing.state === "held") return { taken: false, held: existing.claim };

  const claim: ResourceClaim = {
    resource: options.resource,
    holder: options.holder,
    ...(options.keyId !== undefined ? { keyId: options.keyId } : {}),
    machine: options.machine,
    takenAt: now.toISOString(),
    heartbeatAt: now.toISOString(),
  };
  await writeClaim(directory, claim);
  return { taken: true, claim };
}

/** Writes a claim into place, through a temporary name and a rename.
 *
 * Its own function because renewing must not go through `takeClaim`:
 * that one refuses a resource somebody holds, and a renewal is precisely
 * the case where the holder is you. Found by a test that renewed a claim
 * and watched its heartbeat stay exactly where it was. */
async function writeClaim(directory: string, claim: ResourceClaim): Promise<void> {
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, fileNameFor(claim.resource));
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(claim, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

/** Renews a claim this agent holds. A renewal for a resource somebody
 * else now holds does nothing: losing a claim is not something to
 * overwrite quietly. */
export async function renewClaim(
  directory: string,
  claim: ResourceClaim,
  now: Date = new Date(),
): Promise<boolean> {
  const held = await readClaim(directory, claim.resource, now);
  if (held.state === "held" && held.claim.takenAt !== claim.takenAt) return false;
  await writeClaim(path.resolve(directory), { ...claim, heartbeatAt: now.toISOString() });
  return true;
}

/** Gives a resource back. A claim that is not released expires. */
export async function releaseClaim(directory: string, resource: string): Promise<void> {
  await rm(path.join(path.resolve(directory), fileNameFor(resource)), { force: true });
}

/** Every claim currently held, for a surface that lists them. */
export async function readClaims(directory: string, now: Date = new Date()): Promise<ResourceClaim[]> {
  let names: string[];
  try {
    names = (await readdir(path.resolve(directory))).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
  const held: ResourceClaim[] = [];
  for (const name of names) {
    const reading = await readClaim(directory, decodeURIComponent(name.slice(0, -".json".length)), now);
    if (reading.state === "held") held.push(reading.claim);
  }
  return held.sort((left, right) => left.resource.localeCompare(right.resource));
}

export interface WaitForClaimOptions extends TakeClaimOptions {
  /** How long to wait for a held resource. Bounded, because the point is
   * to report a collision rather than to queue behind one for ever. */
  waitMs?: number;
  /** How often to look again. */
  pollMs?: number;
  /** Told whom this is waiting for, each time it looks. Silence for two
   * minutes is indistinguishable from a hang. */
  onWaiting?: (held: ResourceClaim, waitedMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

export const DEFAULT_CLAIM_WAIT_MS = 10 * 60_000;

/** Takes a resource, waiting a bounded time where another agent holds it,
 * and saying whom it waits for while it waits. */
export async function waitForClaim(options: WaitForClaimOptions): Promise<TakeClaimResult> {
  const waitMs = options.waitMs ?? DEFAULT_CLAIM_WAIT_MS;
  const pollMs = options.pollMs ?? 5_000;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = options.now ?? (() => new Date());
  const startedAt = now().getTime();

  for (;;) {
    const result = await takeClaim(options);
    if (result.taken) return result;
    const waited = now().getTime() - startedAt;
    if (waited >= waitMs) return result;
    options.onWaiting?.(result.held, waited);
    await sleep(pollMs);
  }
}
