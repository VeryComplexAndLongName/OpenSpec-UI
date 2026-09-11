import { describe, expect, it } from "vitest";
import type { ChangeReadinessReport } from "@openspec-ui/core";
import { readyCommand } from "./ready-command.js";

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

const REPORT: ChangeReadinessReport = {
  changes: [
    {
      changeName: "running-one",
      blockers: [],
      run: {
        state: "running",
        worktreePath: "/repo.worktrees/running-one",
        holder: { hostKind: "cli", hostname: "a-machine", pid: 777, heartbeatAgeMs: 3_000 },
      },
      capabilities: ["ci-cli"],
      worktreePath: "/repo.worktrees/running-one",
      canJoin: [],
      blockedFrom: [],
    },
    {
      changeName: "alpha",
      blockers: [],
      run: { state: "ready" },
      capabilities: ["ci-cli"],
      worktreePath: "/repo.worktrees/alpha",
      canJoin: ["gamma"],
      blockedFrom: [
        { changeName: "beta", collisions: [{ kind: "shared-capability", capability: "ci-cli" }] },
      ],
    },
    {
      changeName: "gamma",
      blockers: [],
      run: { state: "ready" },
      capabilities: [],
      canJoin: [],
      blockedFrom: [],
      needsWorktree: "openspec-ui-cli worktree add gamma",
    },
    {
      changeName: "waiting",
      blockers: ["alpha"],
      run: { state: "blocked", blockedBy: ["alpha"] },
      capabilities: [],
      canJoin: [],
      blockedFrom: [],
    },
  ],
};

describe("readyCommand", () => {
  it("groups by state and says what each ready change can join", async () => {
    const io = collectingIo();

    const code = await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: () => Promise.resolve(REPORT) },
    );

    const printed = io.out.join("\n");
    expect(code).toBe(0);
    expect(printed).toContain("Running");
    expect(printed).toContain("pid 777");
    expect(printed).toContain("can start alongside: gamma");
    // The collision is named, not just asserted: a reader acts on the
    // capability, not on the word "collides".
    expect(printed).toContain("not with beta");
    expect(printed).toContain("one spec file");
    expect(printed).toContain("waiting on alpha");
    expect(printed).toContain("2 ready, 1 running, 1 blocked.");
  });

  it("tells a ready change with nowhere of its own what to do", async () => {
    const io = collectingIo();

    await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: () => Promise.resolve(REPORT) },
    );

    expect(io.out.join("\n")).toContain("openspec-ui-cli worktree add gamma");
  });

  it("exits 0 when nothing is ready", async () => {
    // A repository whose changes are all running, or all waiting on each
    // other, is in a perfectly good state. Reporting that as a failure
    // would make this unusable in anything that checks an exit code.
    const io = collectingIo();

    const code = await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...io,
        read: () => Promise.resolve({
          changes: [{
            changeName: "waiting",
            blockers: ["x"],
            run: { state: "blocked", blockedBy: ["x"] },
            capabilities: [],
            canJoin: [],
            blockedFrom: [],
          }],
        } satisfies ChangeReadinessReport),
      },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("0 ready");
  });

  it("says so when there are no active changes at all", async () => {
    const io = collectingIo();

    const code = await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: () => Promise.resolve({ changes: [] }) },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("No active changes.");
  });

  it("gives a machine the module's own shape", async () => {
    const io = collectingIo();

    await readyCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...io, read: () => Promise.resolve(REPORT) },
    );

    expect(JSON.parse(io.out.join(""))).toEqual(REPORT);
  });

  it("exits 2 when the report could not be produced", async () => {
    const io = collectingIo();

    const code = await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: () => Promise.reject(new Error("no openspec root")) },
    );

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("no openspec root");
  });
});
