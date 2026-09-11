import { describe, expect, it } from "vitest";
import type { LeaseReleaseOutcome, WorkspaceLeaseConflict } from "@openspec-ui/core";
import { leaseCommand } from "./lease-command.js";

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

const HOLDER: WorkspaceLeaseConflict = {
  hostKind: "cli",
  hostname: "a-machine",
  pid: 777,
  heartbeatAgeMs: 3_000,
  author: "ada@example.com",
};

describe("leaseCommand", () => {
  it("describes the holder and succeeds", async () => {
    const io = collectingIo();

    const code = await leaseCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => HOLDER },
    );

    expect(code).toBe(0);
    const text = io.out.join("\n");
    expect(text).toContain("a-machine");
    expect(text).toContain("pid 777");
    expect(text).toContain("Git author ada@example.com");
  });

  it("says a free workspace is free, and still succeeds", async () => {
    const io = collectingIo();

    // Exit 0 either way: the question was answered. A script asking "is
    // it free" reads the output rather than inferring from a code.
    const code = await leaseCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => undefined },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("Nothing holds this workspace.");
    expect(io.err).toEqual([]);
  });

  it("reports the holder as json in the reader's own shape", async () => {
    const io = collectingIo();

    const code = await leaseCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...io, read: async () => HOLDER },
    );

    expect(code).toBe(0);
    expect(JSON.parse(io.out.join("\n"))).toEqual({ held: true, holder: HOLDER });
  });

  it("exits 0 when a lease was cleared", async () => {
    const io = collectingIo();
    const outcome: LeaseReleaseOutcome = { kind: "cleared", holder: HOLDER, because: "process-gone" };

    const code = await leaseCommand(
      { workspaceRoot: "/repo", action: "release", format: "text" },
      { ...io, release: async () => outcome },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("Cleared.");
  });

  it("exits 1 when releasing was refused, and says why on stderr", async () => {
    const io = collectingIo();
    const outcome: LeaseReleaseOutcome = {
      kind: "refused",
      holder: HOLDER,
      reason: "process 777 is still running. ... stop that process instead.",
    };

    const code = await leaseCommand(
      { workspaceRoot: "/repo", action: "release", format: "text" },
      { ...io, release: async () => outcome },
    );

    expect(code).toBe(1);
    expect(io.out).toEqual([]);
    expect(io.err.join("\n")).toContain("stop that process instead");
  });

  it("exits 2 when the lease could not be looked at", async () => {
    const io = collectingIo();

    const code = await leaseCommand(
      { workspaceRoot: "/repo", action: "release", format: "text" },
      {
        ...io,
        release: async () => {
          throw new Error("EACCES");
        },
      },
    );

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("EACCES");
  });

  it("refuses an action it does not have", async () => {
    const io = collectingIo();

    const code = await leaseCommand({ workspaceRoot: "/repo", action: "steal", format: "text" }, io);

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("unknown lease action 'steal'");
  });
});
