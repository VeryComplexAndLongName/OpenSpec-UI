import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const {
  buildGhPrCreateInvocation,
  buildGhPrMergeInvocation,
  buildGitPushInvocation,
  createGitHubForge,
  createPullRequestGateway,
} = await import("./gh-pr-gateway.js");

function mockGhResult(stdout: string, stderr = "", code = 0): void {
  spawnMock.mockImplementationOnce(() => {
    const child = new FakeChildProcess();
    queueMicrotask(() => {
      if (stdout.length > 0) child.stdout.emit("data", Buffer.from(stdout, "utf8"));
      if (stderr.length > 0) child.stderr.emit("data", Buffer.from(stderr, "utf8"));
      child.emit("close", code);
    });
    return child;
  });
}

describe("gh-pr-gateway invocation builders", () => {
  it("builds deterministic push/create/merge invocations", () => {
    expect(buildGitPushInvocation("origin", "feature/demo")).toEqual({
      executable: "git",
      args: ["push", "origin", "feature/demo"],
    });

    expect(buildGhPrCreateInvocation("feature/demo", "main")).toEqual({
      executable: "gh",
      // No `--json`: the real `gh pr create` answers `unknown flag:
      // --json` and exits non-zero (verified against the installed binary
      // on 2026-09-02). Asserting the argv is what catches a flag that
      // does not exist, since nothing else here spawns the real thing.
      args: ["pr", "create", "--fill", "--head", "feature/demo", "--base", "main"],
    });

    expect(buildGhPrMergeInvocation(42)).toEqual({
      executable: "gh",
      args: ["pr", "merge", "42", "--merge", "--delete-branch"],
    });
  });
});

describe("createPullRequestGateway", () => {
  it("creates a pull request by reading the URL gh prints", async () => {
    // What the real binary emits: advisory lines, then the URL last.
    mockGhResult(["Warning: 3 uncommitted changes", "https://github.com/example/repo/pull/7", ""].join("\n"));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo" });
    const pr = await gateway.createPullRequest("feature/demo", "main");

    expect(pr).toEqual({ number: 7, url: "https://github.com/example/repo/pull/7" });
    expect(spawnMock).toHaveBeenCalledWith(
      "gh",
      ["pr", "create", "--fill", "--head", "feature/demo", "--base", "main"],
      { cwd: "/workspace/repo" },
    );
  });

  it("fails rather than guessing when gh prints no pull-request URL", async () => {
    mockGhResult("Creating pull request for feature/demo into main");

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo" });
    await expect(gateway.createPullRequest("feature/demo", "main")).rejects.toThrow(/no pull-request URL/);
  });

  it("waits through pending checks and resolves pass", async () => {
    mockGhResult(JSON.stringify([{ name: "ci", state: "pending" }]));
    mockGhResult(JSON.stringify([{ name: "ci", state: "pass" }]));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });
    const status = await gateway.waitForChecks(7);

    expect(status).toEqual({ state: "pass" });
  });

  it("returns fail when any check fails", async () => {
    mockGhResult(JSON.stringify([{ name: "lint", state: "failure" }]));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });
    const status = await gateway.waitForChecks(7);

    expect(status.state).toBe("fail");
    expect(status.reason).toContain("lint");
  });

  it("passes when the checks that ran succeeded and the rest were skipped", async () => {
    // The shape of this repository's own pull requests: `gh pr checks
    // --json name,state` on PR #178 returned SKIPPED for two of seven,
    // both conditional jobs that skip on every pull request by design.
    // Treating an unlisted state as a failure — as the first version did
    // — refused every pull request this repository can produce.
    mockGhResult(JSON.stringify([
      { name: "Typecheck, lint, test, and build", state: "SUCCESS" },
      { name: "Version pending changesets", state: "SKIPPED" },
      { name: "Tag and release VS Code extension", state: "SKIPPED" },
    ]));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });

    expect(await gateway.waitForChecks(7)).toEqual({ state: "pass" });
  });

  it("refuses when every check was skipped, because nothing actually ran", async () => {
    mockGhResult(JSON.stringify([
      { name: "Version pending changesets", state: "SKIPPED" },
      { name: "Tag and release VS Code extension", state: "SKIPPED" },
    ]));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });
    const status = await gateway.waitForChecks(7);

    // Not a pass: ADR 0014 treats an absent result as a refusal rather
    // than as permission, and checks that all skipped are that case in a
    // different shape.
    expect(status.state).toBe("none");
    expect(status.reason).toContain("no check actually ran");
  });

  it("names the state when a check fails, not only the check", async () => {
    mockGhResult(JSON.stringify([{ name: "e2e", state: "CANCELLED" }]));

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });
    const status = await gateway.waitForChecks(7);

    expect(status.state).toBe("fail");
    expect(status.reason).toContain("e2e");
    expect(status.reason).toContain("cancelled");
  });

  it("returns none when gh reports no checks", async () => {
    mockGhResult("", "no checks reported on the pull request", 1);

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo", pollIntervalMs: 0, maxWaitMs: 50 });
    const status = await gateway.waitForChecks(7);

    expect(status).toEqual({ state: "none", reason: "no check result was available" });
  });

  it("merges a pull request through gh pr merge", async () => {
    mockGhResult("");

    const gateway = createPullRequestGateway({ cwd: "/workspace/repo" });
    await gateway.mergePullRequest(11);

    expect(spawnMock).toHaveBeenCalledWith(
      "gh",
      ["pr", "merge", "11", "--merge", "--delete-branch"],
      { cwd: "/workspace/repo" },
    );
  });
});

describe("createGitHubForge", () => {
  // ADR 0036: the product reads the checks and merges now; `gh` is never
  // asked to merge later by the repository's rules.
  function forgeWith(results: Array<{ code: number; stderr?: string; stdout?: string }>) {
    const calls: string[][] = [];
    const exec = vi.fn(async (_binary: string, args: string[]) => {
      calls.push(args);
      const next = results.shift() ?? { code: 0 };
      if (next.code !== 0) throw new Error(`gh ${args.join(" ")} exited with code ${next.code}: ${next.stderr ?? ""}`);
      return { stdout: next.stdout ?? "", stderr: "" };
    });
    return { forge: createGitHubForge({ cwd: "/repo", exec }), calls };
  }

  it("merges now by the method it is given, and never with --auto", async () => {
    const { forge, calls } = forgeWith([{ code: 0 }]);

    await forge.mergeNow(7, "squash");

    expect(calls).toEqual([["pr", "merge", "7", "--squash", "--delete-branch"]]);
  });

  it("reads checks through gh pr checks, and none where gh says there are none", async () => {
    const passing = forgeWith([{ code: 0, stdout: JSON.stringify([{ name: "build", state: "SUCCESS" }]) }]);
    expect(await passing.forge.checksOf(7)).toEqual({ state: "pass" });
    expect(passing.calls[0]).toEqual(["pr", "checks", "7", "--json", "name,state"]);

    const none = forgeWith([{ code: 1, stderr: "no checks reported on the 'archive-landed-x' branch" }]);
    expect(await none.forge.checksOf(7)).toEqual({ state: "none", reason: "no check result was available" });
  });

  it("says a refused merge in the forge's words", async () => {
    const { forge } = forgeWith([{ code: 1, stderr: "Squash merges are not allowed on this repository" }]);

    await expect(forge.mergeNow(7, "squash")).rejects.toThrow("Squash merges are not allowed");
  });

  it("opens a pull request with the title and body it is given", async () => {
    const { forge, calls } = forgeWith([{ code: 0, stdout: "https://github.com/o/r/pull/31" }]);

    const ref = await forge.openPullRequest({ head: "archive-landed-x", base: "main", title: "Archive a", body: "Because." });

    expect(ref).toEqual({ number: 31, url: "https://github.com/o/r/pull/31" });
    expect(calls[0]).toEqual(["pr", "create", "--head", "archive-landed-x", "--base", "main", "--title", "Archive a", "--body", "Because."]);
  });
});
