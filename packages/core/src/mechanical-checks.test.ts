import { EventEmitter } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same fake-child-process pattern openspec.test.ts and agents/shared.test.ts
// already use — `cross-spawn` is mocked once for this whole file, and both
// `runCommand` (this module's own helper) and `validateChange`'s internal
// spawn (openspec.ts) would go through it; `validateChange` itself is
// mocked directly below instead, since exercising its own JSON-parsing
// path is openspec.test.ts's job, not this file's.
class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

const spawnMock = vi.fn();
vi.mock("cross-spawn", () => ({
  default: (...args: unknown[]) => spawnMock(...args),
}));

const validateChangeMock = vi.fn();
vi.mock("./openspec.js", () => ({
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const checkChangesetReminderMock = vi.fn();
vi.mock("./changeset-reminder.js", () => ({
  checkChangesetReminder: (...args: unknown[]) => checkChangesetReminderMock(...args),
}));

const { MECHANICAL_CHECK_NAMES, isMechanicalCheckName, runMechanicalCheck } = await import("./mechanical-checks.js");

function mockSpawnExit(code: number, stdout = "", stderr = ""): void {
  const child = new FakeChildProcess();
  spawnMock.mockReturnValueOnce(child);
  queueMicrotask(() => {
    if (stdout) child.stdout.emit("data", Buffer.from(stdout, "utf8"));
    if (stderr) child.stderr.emit("data", Buffer.from(stderr, "utf8"));
    child.emit("close", code);
  });
}

const temporaryRoots: string[] = [];
async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-mechanical-checks-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  vi.clearAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function makeCtx(workspaceRoot: string, changeName = "sample-change") {
  return {
    workspaceRoot,
    changeDir: path.join(workspaceRoot, "openspec", "changes", changeName),
    changeName,
  };
}

describe("MECHANICAL_CHECK_NAMES / isMechanicalCheckName", () => {
  it("lists exactly the six documented checks", () => {
    expect(MECHANICAL_CHECK_NAMES).toEqual([
      "validate-change",
      "typecheck",
      "test",
      "lint",
      "path-unchanged",
      "changeset-present",
    ]);
  });

  it("recognizes a known name and rejects an unknown one", () => {
    expect(isMechanicalCheckName("typecheck")).toBe(true);
    expect(isMechanicalCheckName("not-a-real-check")).toBe(false);
  });
});

describe("validate-change", () => {
  it("passes when the change validates with zero failures", async () => {
    validateChangeMock.mockResolvedValueOnce({
      items: [{ id: "spec:agentic-harness", type: "spec", valid: true, issues: [], durationMs: 1 }],
      summary: { totals: { items: 1, passed: 1, failed: 0 }, byType: {} },
    });

    const result = await runMechanicalCheck("validate-change", undefined, makeCtx("C:\\repo"));

    expect(result).toEqual({ pass: true, reason: "openspec change validate --strict sample-change: 1 item(s) passed" });
  });

  it("fails and names the failing item when validation reports a failure", async () => {
    validateChangeMock.mockResolvedValueOnce({
      items: [{ id: "spec:agentic-harness", type: "spec", valid: false, issues: [], durationMs: 1 }],
      summary: { totals: { items: 1, passed: 0, failed: 1 }, byType: {} },
    });

    const result = await runMechanicalCheck("validate-change", undefined, makeCtx("C:\\repo"));

    expect(result.pass).toBe(false);
    expect(result.reason).toContain("spec:agentic-harness");
    expect(result.reason).toContain("1 item(s) failed");
  });
});

describe("typecheck / test / lint", () => {
  for (const name of ["typecheck", "test", "lint"] as const) {
    it(`${name} passes when "npm run ${name}" exits 0`, async () => {
      mockSpawnExit(0);

      const result = await runMechanicalCheck(name, undefined, makeCtx("C:\\repo"));

      expect(result).toEqual({ pass: true, reason: `npm run ${name} exited 0` });
    });

    it(`${name} fails and includes the tail of output when "npm run ${name}" exits nonzero`, async () => {
      mockSpawnExit(1, "", "TS2322: boom error\n");

      const result = await runMechanicalCheck(name, undefined, makeCtx("C:\\repo"));

      expect(result.pass).toBe(false);
      expect(result.reason).toContain(`npm run ${name} exited 1`);
      expect(result.reason).toContain("boom error");
    });
  }
});

describe("path-unchanged", () => {
  it("fails without a parameter, without spawning anything", async () => {
    const result = await runMechanicalCheck("path-unchanged", undefined, makeCtx("C:\\repo"));

    expect(result.pass).toBe(false);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses a path that escapes the workspace, without spawning anything", async () => {
    const root = await temporaryRoot();

    // A forward slash is a separator on both platforms. The first version
    // of this test used `..\\outside-the-workspace`, which escapes only on
    // Windows — on Linux a backslash is an ordinary filename character, so
    // the path stayed inside the workspace, nothing was refused, and CI
    // failed on the platform the local run could not speak for.
    const result = await runMechanicalCheck("path-unchanged", "../outside-the-workspace", makeCtx(root));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/outside the workspace/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("refuses a rooted path, on Windows and on POSIX alike", async () => {
    const root = await temporaryRoot();

    // Chosen because it escapes on both platforms, unlike a drive-letter
    // path: `path.resolve` leaves this as `/etc/passwd` on POSIX and
    // rewrites it to `<drive>:\etc\passwd` on Windows, and both are
    // outside a workspace under a temporary directory.
    const result = await runMechanicalCheck("path-unchanged", "/etc/passwd", makeCtx(root));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/outside the workspace/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("passes when `git diff --quiet` reports no changes (exit 0)", async () => {
    const root = await temporaryRoot();
    mockSpawnExit(0);

    const result = await runMechanicalCheck("path-unchanged", "packages/core/src/agents", makeCtx(root));

    expect(result.pass).toBe(true);
  });

  it("fails when `git diff --quiet` reports changes (exit 1)", async () => {
    const root = await temporaryRoot();
    mockSpawnExit(1);

    const result = await runMechanicalCheck("path-unchanged", "packages/core/src/agents", makeCtx(root));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/packages[/\\]core[/\\]src[/\\]agents/);
  });
});

describe("changeset-present", () => {
  it("passes when a pending changeset file exists", async () => {
    checkChangesetReminderMock.mockResolvedValueOnce({ changesetsAdopted: true, pendingChangesetCount: 2 });

    const result = await runMechanicalCheck("changeset-present", undefined, makeCtx("C:\\repo"));

    expect(result).toEqual({ pass: true, reason: "2 pending changeset file(s) found" });
  });

  it("fails when Changesets is not adopted", async () => {
    checkChangesetReminderMock.mockResolvedValueOnce({ changesetsAdopted: false, pendingChangesetCount: 0 });

    const result = await runMechanicalCheck("changeset-present", undefined, makeCtx("C:\\repo"));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/not adopted/);
  });

  it("fails when Changesets is adopted but no changeset file is pending", async () => {
    checkChangesetReminderMock.mockResolvedValueOnce({ changesetsAdopted: true, pendingChangesetCount: 0 });

    const result = await runMechanicalCheck("changeset-present", undefined, makeCtx("C:\\repo"));

    expect(result.pass).toBe(false);
    expect(result.reason).toMatch(/no pending/);
  });
});

describe("runMechanicalCheck", () => {
  it("throws for a name outside the registry", async () => {
    await expect(
      runMechanicalCheck("not-a-real-check" as never, undefined, makeCtx("C:\\repo")),
    ).rejects.toThrow(/Unknown mechanical check/);
  });
});
