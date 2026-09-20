import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  claimDirectoryBeside,
  CLAIM_STALE_AFTER_MS,
  readClaim,
  readClaims,
  releaseClaim,
  renewClaim,
  takeClaim,
  waitForClaim,
} from "./resource-claim.js";

// Measured 2026-09-20: small writes in a temporary directory and no
// real sleeping - the wait's clock is injected. Under 1s for the file.
vi.setConfig({ testTimeout: 15_000 });

// every-varying-check-has-a-budget: small writes in a temporary
// directory. No git, no agent, no sleeping in real time.

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function claimDirectory(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-claims-"));
  directories.push(root);
  return path.join(root, ".agent-claims");
}

const AT = new Date("2026-09-20T10:00:00.000Z");

function take(directory: string, over: Partial<Parameters<typeof takeClaim>[0]> = {}) {
  return takeClaim({
    directory,
    resource: "browser-suite",
    holder: "Alexander",
    machine: "this-machine",
    now: () => AT,
    ...over,
  });
}

describe("claimDirectoryBeside", () => {
  it("puts claims beside the status directory, not inside it", () => {
    expect(claimDirectoryBeside(path.join("C:", "wt", "repo", ".agent-status")))
      .toBe(path.join("C:", "wt", "repo", ".agent-claims"));
  });
});

describe("takeClaim", () => {
  it("takes a free resource and says who holds it", async () => {
    const directory = await claimDirectory();

    const result = await take(directory);

    expect(result.taken).toBe(true);
    expect(await readClaim(directory, "browser-suite", AT)).toMatchObject({
      state: "held",
      claim: { resource: "browser-suite", holder: "Alexander", machine: "this-machine" },
    });
  });

  it("reports the holder rather than taking a resource somebody else has", async () => {
    const directory = await claimDirectory();
    await take(directory);

    const second = await take(directory, { holder: "the campaign" });

    expect(second.taken).toBe(false);
    expect(second.taken === false && second.held.holder).toBe("Alexander");
  });

  it("takes a resource whose claimant stopped renewing", async () => {
    const directory = await claimDirectory();
    await take(directory);
    const later = new Date(AT.getTime() + CLAIM_STALE_AFTER_MS + 1_000);

    const second = await take(directory, { holder: "the campaign", now: () => later });

    expect(second.taken).toBe(true);
    expect(await readClaim(directory, "browser-suite", later)).toMatchObject({
      state: "held",
      claim: { holder: "the campaign" },
    });
  });

  it("cannot be talked out of its own directory by a resource name", async () => {
    const directory = await claimDirectory();

    await take(directory, { resource: "../escaped" });

    // The name is encoded, so the file lands in the claims directory
    // whatever it is called.
    expect((await readClaims(directory, AT)).map((claim) => claim.resource)).toEqual(["../escaped"]);
  });

  it("treats a file nobody can parse as free rather than as held", async () => {
    const directory = await claimDirectory();
    await take(directory);
    await writeFile(path.join(directory, "browser-suite.json"), "{ not json", "utf8");

    expect(await readClaim(directory, "browser-suite", AT)).toEqual({ state: "free" });
  });
});

describe("renewClaim and releaseClaim", () => {
  it("renews a claim this agent still holds", async () => {
    const directory = await claimDirectory();
    const taken = await take(directory);
    const later = new Date(AT.getTime() + 10_000);

    expect(taken.taken && await renewClaim(directory, taken.claim, later)).toBe(true);
    const reading = await readClaim(directory, "browser-suite", later);
    expect(reading.state === "held" && reading.ageMs).toBe(0);
  });

  it("refuses to renew a claim somebody else now holds", async () => {
    const directory = await claimDirectory();
    const taken = await take(directory);
    const later = new Date(AT.getTime() + CLAIM_STALE_AFTER_MS + 1_000);
    await take(directory, { holder: "the campaign", now: () => later });

    expect(taken.taken && await renewClaim(directory, taken.claim, later)).toBe(false);
  });

  it("gives a resource back", async () => {
    const directory = await claimDirectory();
    await take(directory);

    await releaseClaim(directory, "browser-suite");

    expect(await readClaim(directory, "browser-suite", AT)).toEqual({ state: "free" });
  });
});

describe("waitForClaim", () => {
  it("says whom it waits for, and reports rather than proceeding when the wait runs out", async () => {
    const directory = await claimDirectory();
    await take(directory);
    const onWaiting = vi.fn();
    let clock = AT.getTime();

    const result = await waitForClaim({
      directory,
      resource: "browser-suite",
      holder: "the campaign",
      machine: "this-machine",
      waitMs: 20_000,
      pollMs: 5_000,
      now: () => new Date(clock),
      sleep: async (ms) => { clock += ms; },
      onWaiting,
    });

    expect(result.taken).toBe(false);
    expect(onWaiting).toHaveBeenCalled();
    expect(onWaiting.mock.calls[0]?.[0]).toMatchObject({ holder: "Alexander" });
  });

  it("takes the resource as soon as it is given back", async () => {
    const directory = await claimDirectory();
    await take(directory);
    let clock = AT.getTime();

    const result = await waitForClaim({
      directory,
      resource: "browser-suite",
      holder: "the campaign",
      machine: "this-machine",
      waitMs: 60_000,
      pollMs: 5_000,
      now: () => new Date(clock),
      sleep: async (ms) => {
        clock += ms;
        await releaseClaim(directory, "browser-suite");
      },
    });

    expect(result.taken).toBe(true);
    expect(result.taken && result.claim.holder).toBe("the campaign");
  });
});
