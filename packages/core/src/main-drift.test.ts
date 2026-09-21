import { describe, expect, it, vi } from "vitest";
import { catchUpWithMain, driftWords, readMainDrift } from "./main-drift.js";
import type { ChangeStandings } from "./change-standing.js";

// every-varying-check-has-a-budget: no git, no filesystem. The wrapper is
// injected, and what is asserted is which calls were made and what was
// said about the answers.

function gitOver(over: Partial<{
  branch: string;
  counts: { ahead: number; behind: number } | undefined;
  clean: boolean;
  fetchedAt: Date | undefined;
  fastForward: { ok: true } | { ok: false; reason: string };
}> = {}) {
  const fastForward = vi.fn(async () => over.fastForward ?? { ok: true as const });
  const fetch = vi.fn(async () => undefined);
  return {
    fastForward,
    fetch,
    currentBranch: vi.fn(async () => over.branch ?? "main"),
    aheadBehind: vi.fn(async () => ("counts" in over ? over.counts : { ahead: 0, behind: 3 })),
    lastFetchedAt: vi.fn(async () => over.fetchedAt ?? new Date("2026-09-20T09:00:00.000Z")),
    status: vi.fn(async () => ({ isClean: over.clean ?? true }) as never),
    listTreeNames: vi.fn(async (ref: string, pathInRepo: string) => {
      if (pathInRepo.endsWith("archive")) return ref === "main" ? ["2026-09-19-landed-one"] : [];
      return ref === "main" ? ["still-here", "archive"] : ["still-here", "landed-one", "landed-elsewhere", "archive"];
    }),
  };
}

const standings = {
  standings: [
    { changeName: "landed-one", main: { kind: "archived", archiveName: "2026-09-19-landed-one" } },
    { changeName: "still-here", main: { kind: "only-here" } },
    { changeName: "landed-two", main: { kind: "archived", archiveName: "2026-09-19-landed-two" } },
  ],
} as unknown as ChangeStandings;

describe("readMainDrift, what landed that this checkout does not show", () => {
  // main-follows-what-landed: a change merged while this checkout was
  // behind is on no view here, and the owner could not find it.
  it("names the changes under way there that this checkout does not hold", async () => {
    const drift = await readMainDrift({ root: "/repo", standings, git: gitOver() });

    expect(drift?.landedNotHere).toEqual(["landed-elsewhere"]);
    expect(driftWords(drift!)).toContain("1 change there is not shown here: landed-elsewhere");
  });

  it("names none where the checkout is level", async () => {
    const drift = await readMainDrift({ root: "/repo", git: gitOver({ counts: { ahead: 0, behind: 0 } }) });

    expect(drift?.landedNotHere).toBeUndefined();
  });
});

describe("readMainDrift", () => {
  it("says the branch, the distance both ways, when refs were fetched, and what is already archived", async () => {
    const git = gitOver();

    const drift = await readMainDrift({ root: "/repo", standings, git });

    expect(drift).toMatchObject({
      branch: "main",
      defaultBranch: "main",
      remote: "origin",
      ahead: 0,
      behind: 3,
      fetchedAt: "2026-09-20T09:00:00.000Z",
      archivedOnDefault: ["landed-one", "landed-two"],
      clean: true,
    });
  });

  it("fetches nothing, whatever the age of the refs", async () => {
    const git = gitOver({ fetchedAt: new Date("2020-01-01T00:00:00.000Z") });

    await readMainDrift({ root: "/repo", git });

    expect(git.fetch).not.toHaveBeenCalled();
  });

  it("answers nothing where the remote ref cannot be read", async () => {
    const git = gitOver({ counts: undefined });

    expect(await readMainDrift({ root: "/repo", git })).toBeUndefined();
  });

  it("reads an unreadable tree as not clean, so a catch-up is refused rather than risked", async () => {
    const git = gitOver();
    git.status = vi.fn(async () => { throw new Error("no git here"); });

    expect((await readMainDrift({ root: "/repo", git }))?.clean).toBe(false);
  });
});

describe("catchUpWithMain", () => {
  it("fast-forwards a clean checkout that is behind, and says how far it moved", async () => {
    const git = gitOver();

    const result = await catchUpWithMain({ root: "/repo", git });

    expect(result).toEqual({ ok: true, branch: "main", moved: 3 });
    expect(git.fastForward).toHaveBeenCalledWith("origin/main");
  });

  it("moves nothing where the branch is already level", async () => {
    const git = gitOver({ counts: { ahead: 0, behind: 0 } });

    expect(await catchUpWithMain({ root: "/repo", git })).toEqual({ ok: true, branch: "main", moved: 0 });
    expect(git.fastForward).not.toHaveBeenCalled();
  });

  it("refuses a tree that is not clean, and says so", async () => {
    const git = gitOver({ clean: false });

    const result = await catchUpWithMain({ root: "/repo", git });

    expect(result).toMatchObject({ ok: false });
    expect(result.ok === false && result.why).toMatch(/not clean/u);
    expect(git.fastForward).not.toHaveBeenCalled();
  });

  it("refuses a branch with commits the remote does not have, with the count", async () => {
    const git = gitOver({ counts: { ahead: 2, behind: 1 } });

    const result = await catchUpWithMain({ root: "/repo", git });

    expect(result.ok === false && result.why).toMatch(/main has 2 commits origin\/main does not/u);
    expect(git.fastForward).not.toHaveBeenCalled();
  });

  it("refuses a checkout on another branch, naming it", async () => {
    const git = gitOver({ branch: "feature/demo" });

    const result = await catchUpWithMain({ root: "/repo", git });

    expect(result.ok === false && result.why).toMatch(/on feature\/demo, not main/u);
    expect(git.fastForward).not.toHaveBeenCalled();
  });

  it("carries git's own refusal where the fast-forward itself fails", async () => {
    const git = gitOver({ fastForward: { ok: false, reason: "fatal: Not possible to fast-forward, aborting." } });

    const result = await catchUpWithMain({ root: "/repo", git });

    expect(result.ok === false && result.why).toMatch(/Not possible to fast-forward/u);
  });
});
