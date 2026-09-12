import { describe, expect, it } from "vitest";
import { doctorCommand } from "./doctor-command.js";

// The exit code is the whole contract: 0 nothing would stop a run, 1
// something would, 2 could not look. The case that matters most is the
// held workspace, which must exit 0 — `lease` already reports being held
// without calling it a failure, and two commands disagreeing about
// whether busy means broken is worse than either answer.
// See a-doctor-says-what-would-stop-a-run.

function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

const CLEAN = { workspaceRoot: "/repo", findings: [] };

describe("doctorCommand", () => {
  it("exits 0 and says so when nothing would stop a run", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", canAnswerCheckpoints: true, format: "text" },
      { ...deps, read: async () => CLEAN },
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Nothing here would stop a run.");
  });

  it("exits 1 and names the remedy when something would", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", canAnswerCheckpoints: true, format: "text" },
      {
        ...deps,
        read: async () => ({
          workspaceRoot: "/repo",
          findings: [{
            id: "openspec-cli",
            severity: "stops-a-run" as const,
            statement: "The `openspec` CLI is not on this PATH.",
            remedy: "Install it: npm install -g @openspec/cli",
          }],
        }),
      },
    );
    expect(code).toBe(1);
    expect(out.join("\n")).toContain("npm install -g");
  });

  it("exits 0 for a workspace held by a live run", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", canAnswerCheckpoints: true, format: "text" },
      {
        ...deps,
        read: async () => ({
          workspaceRoot: "/repo",
          findings: [{
            id: "workspace-held",
            severity: "worth-knowing" as const,
            statement: "terminal run on somewhere, pid 4242 holds this workspace.",
          }],
        }),
      },
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain("Worth knowing:");
    expect(out.join("\n")).toContain("pid 4242");
  });

  it("exits 2 when the report could not be produced", async () => {
    const { err, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", canAnswerCheckpoints: true, format: "text" },
      { ...deps, read: async () => { throw new Error("no such directory"); } },
    );
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("no such directory");
  });

  it("reports the preflight's own reason and setting for a named change, and exits 1", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", changeName: "a-change", canAnswerCheckpoints: false, format: "text" },
      {
        ...deps,
        read: async () => CLEAN,
        resolveStart: async () => ({
          ok: false as const,
          refusal: {
            reason: "this change's configuration pauses between stages for a confirmation",
            configKey: "checkpoints.requireConfirmationBetweenSteps",
          },
        }),
      },
    );
    expect(code).toBe(1);
    const text = out.join("\n");
    expect(text).toContain("would not start here");
    expect(text).toContain("checkpoints.requireConfirmationBetweenSteps");
  });

  it("exits 0 for a named change that would start, on a machine with nothing wrong", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", changeName: "a-change", canAnswerCheckpoints: true, format: "text" },
      {
        ...deps,
        read: async () => CLEAN,
        resolveStart: async () => ({
          ok: true as const,
          config: { stepAgents: {}, autonomyLevel: "autonomous" as const, reviewGate: { mode: "human-required" as const } },
          changeDir: "/repo/openspec/changes/a-change",
        }),
      },
    );
    expect(code).toBe(0);
    expect(out.join("\n")).toContain('"a-change" would start here.');
  });

  it("prints the report's own shape as json, and keeps the same exit code", async () => {
    const { out, deps } = collect();
    const code = await doctorCommand(
      { workspaceRoot: "/repo", canAnswerCheckpoints: true, format: "json" },
      { ...deps, read: async () => CLEAN },
    );
    expect(code).toBe(0);
    expect(JSON.parse(out.join("\n"))).toEqual({ workspaceRoot: "/repo", findings: [] });
  });
});
