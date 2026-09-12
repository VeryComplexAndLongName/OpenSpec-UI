import { describe, expect, it } from "vitest";
import { adviseCommand } from "./advise-command.js";
import type { ChangeReadiness, ChangeReadinessReport } from "@openspec-ui/core";

// Exit 0 with or without suggestions — the contract `ready` and `lease`
// already have — and the switch means not computed rather than
// computed-and-hidden. See a-hint-says-what-can-run-together.

function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

function ready(changeName: string, canJoin: string[]): ChangeReadiness {
  return {
    changeName,
    run: { state: "ready" },
    blockers: [],
    capabilities: [],
    worktreePath: `/worktrees/${changeName}`,
    canJoin,
    blockedFrom: [],
  } as ChangeReadiness;
}

const TWO_READY: ChangeReadinessReport = { changes: [ready("alpha", ["beta"]), ready("beta", ["alpha"])] };
const NOTHING: ChangeReadinessReport = { changes: [] };
const CONFIG_ON = { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } };

describe("adviseCommand", () => {
  it("prints each suggestion with the fact it came from and the commands, and exits 0", async () => {
    const { out, deps } = collect();
    const code = await adviseCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...deps, read: async () => TWO_READY, readConfig: async () => CONFIG_ON as never },
    );
    expect(code).toBe(0);
    const text = out.join("\n");
    expect(text).toContain("alpha and beta can run at the same time");
    expect(text).toContain("declare a blocker");
    expect(text).toContain("$ openspec-ui-cli run alpha");
  });

  it("says so in words and exits 0 when there is nothing to suggest", async () => {
    const { out, deps } = collect();
    const code = await adviseCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...deps, read: async () => NOTHING, readConfig: async () => CONFIG_ON as never },
    );
    expect(code).toBe(0);
    expect(out).toEqual(["Nothing to suggest here."]);
  });

  it("suggests nothing when the workspace turned suggestions off", async () => {
    const { out, deps } = collect();
    const code = await adviseCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...deps,
        read: async () => TWO_READY,
        readConfig: async () => ({ ...CONFIG_ON, hints: { enabled: false } }) as never,
      },
    );
    expect(code).toBe(0);
    expect(out).toEqual(["Nothing to suggest here."]);
  });

  it("prints the hint shape unchanged as json", async () => {
    const { out, deps } = collect();
    const code = await adviseCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...deps, read: async () => TWO_READY, readConfig: async () => CONFIG_ON as never },
    );
    expect(code).toBe(0);
    const parsed = JSON.parse(out.join("\n")) as Array<{ id: string; commands: string[] }>;
    expect(parsed[0]?.id).toBe("can-run-together:alpha+beta");
    expect(parsed[0]?.commands).toHaveLength(2);
  });

  it("exits 2 when the report could not be built", async () => {
    const { err, deps } = collect();
    const code = await adviseCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...deps, read: async () => { throw new Error("no such directory"); }, readConfig: async () => CONFIG_ON as never },
    );
    expect(code).toBe(2);
    expect(err.join("\n")).toContain("no such directory");
  });
});
