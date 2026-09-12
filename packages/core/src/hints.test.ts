import { describe, expect, it } from "vitest";
import { buildHints } from "./hints.js";
import type { ChangeReadiness, ChangeReadinessReport } from "./change-readiness-facts.js";

// The two properties that matter, and neither is "the advice is good":
// every hint states the fact it came from, and no hint names one plan
// where several exist. `readChangeReadiness` is pairwise on purpose, and
// a hint that announced the best grouping would undo that decision
// quietly. See a-hint-says-what-can-run-together.

function ready(changeName: string, canJoin: string[], worktree = true): ChangeReadiness {
  return {
    changeName,
    run: { state: "ready" },
    blockers: [],
    capabilities: [],
    ...(worktree ? { worktreePath: `/worktrees/${changeName}` } : {}),
    canJoin,
    blockedFrom: [],
    ...(worktree ? {} : { needsWorktree: `openspec-ui-cli worktree add ${changeName}` }),
  } as ChangeReadiness;
}

function report(...changes: ChangeReadiness[]): ChangeReadinessReport {
  return { changes };
}

describe("buildHints", () => {
  it("says nothing about a repository with nothing ready", () => {
    expect(buildHints(report())).toEqual([]);
  });

  it("names one set for two changes that collide over nothing", () => {
    const hints = buildHints(report(ready("alpha", ["beta"]), ready("beta", ["alpha"])));
    expect(hints).toHaveLength(1);
    expect(hints[0]?.kind).toBe("can-run-together");
    expect(hints[0]?.subject).toContain("alpha and beta");
    expect(hints[0]?.commands).toHaveLength(2);
  });

  it("states the fact every hint came from", () => {
    const hints = buildHints(report(ready("alpha", ["beta"]), ready("beta", ["alpha"])));
    // Not decoration: a suggestion whose reason is printed can be
    // checked, and one without a reason becomes folklore.
    expect(hints.every((hint) => hint.because.length > 0)).toBe(true);
  });

  it("names every maximal set rather than choosing one", () => {
    // A collides with B; C collides with neither. Two answers, and the
    // reader picks — which is the decision readChangeReadiness made and
    // this must not quietly reverse.
    const hints = buildHints(report(
      ready("alpha", ["gamma"]),
      ready("beta", ["gamma"]),
      ready("gamma", ["alpha", "beta"]),
    ));
    const sets = hints.filter((hint) => hint.kind === "can-run-together").map((hint) => hint.id);
    expect(sets).toEqual(["can-run-together:alpha+gamma", "can-run-together:beta+gamma"]);
  });

  it("reports the count and names none when there are more sets than the limit", () => {
    const names = ["a", "b", "c", "d", "e", "f"];
    const changes = names.map((name) => ready(name, names.filter((other) => other !== name)));
    // Six mutually compatible changes are one maximal set, so force the
    // case with a limit of zero: what matters is that nothing is named.
    const hints = buildHints(report(...changes), { maxSets: 0 });
    expect(hints).toHaveLength(1);
    expect(hints[0]?.kind).toBe("too-many-sets");
    expect(hints[0]?.subject).toContain("1 sets");
    expect(hints[0]?.commands).toEqual(["openspec-ui-cli ready"]);
  });

  it("offers the one command that gives a ready change somewhere to run", () => {
    const hints = buildHints(report(ready("alpha", [], false)));
    expect(hints).toHaveLength(1);
    expect(hints[0]?.kind).toBe("needs-a-worktree");
    expect(hints[0]?.commands).toEqual(["openspec-ui-cli worktree add alpha"]);
  });

  it("offers to clear a lease only where the heartbeat is already stale", () => {
    const held = (heartbeatAgeMs: number): ChangeReadinessReport => report({
      changeName: "alpha",
      run: {
        state: "running",
        worktreePath: "/worktrees/alpha",
        holder: { hostKind: "cli", hostname: "somewhere", pid: 4242, heartbeatAgeMs },
      },
      blockers: [],
      capabilities: [],
      worktreePath: "/worktrees/alpha",
      canJoin: [],
      blockedFrom: [],
    } as ChangeReadiness);

    expect(buildHints(held(3_000), { staleAfterMs: 20_000 })).toEqual([]);
    const stale = buildHints(held(60_000), { staleAfterMs: 20_000 });
    expect(stale).toHaveLength(1);
    expect(stale[0]?.kind).toBe("held-by-a-finished-run");
    expect(stale[0]?.commands).toEqual(["openspec-ui-cli lease release --cwd /worktrees/alpha"]);
  });

  it("says nothing about a live holder when no staleness window was given", () => {
    // Without a window this cannot tell a live holder from a gone one,
    // and guessing is what the lease exists to prevent.
    const hints = buildHints(report({
      changeName: "alpha",
      run: {
        state: "running",
        worktreePath: "/worktrees/alpha",
        holder: { hostKind: "cli", hostname: "somewhere", pid: 4242, heartbeatAgeMs: 600_000 },
      },
      blockers: [],
      capabilities: [],
      worktreePath: "/worktrees/alpha",
      canJoin: [],
      blockedFrom: [],
    } as ChangeReadiness));
    expect(hints).toEqual([]);
  });
});
