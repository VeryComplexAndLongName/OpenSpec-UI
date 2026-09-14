import { describe, expect, it } from "vitest";
import type { ChangeReadinessReport, ChangeStandings } from "@openspec-ui/core";
import { readyCommand } from "./ready-command.js";

// a-change-says-where-it-stands 3.1a: the terminal prints the word core gives
// each change, so it says what the Changes views and the card say.

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

const REPORT: ChangeReadinessReport = {
  changes: [
    { changeName: "alpha", blockers: [], run: { state: "ready" }, capabilities: [], worktreePath: "/wt/alpha", canJoin: [], blockedFrom: [] },
  ],
};

const STANDINGS: ChangeStandings = {
  readAt: "2026-09-14T00:00:00.000Z",
  standings: [{
    changeName: "alpha",
    here: { label: "repo", path: "/repo", counts: { done: 1, total: 4 }, runs: [] },
    elsewhere: [],
    main: { kind: "archived", archiveName: "2026-09-13-alpha" },
  }],
  sources: {
    mainRef: "origin/main",
    lastFetchedAt: "2026-09-14T00:00:00.000Z",
    fetch: { attempted: false },
    pullRequests: { read: false, why: "gh is not installed" },
  },
};

describe("readyCommand — where each change stands", () => {
  it("prints each change's word with the lines beneath it, and which sources were read", async () => {
    const io = collectingIo();

    const code = await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => REPORT, readStandings: async () => STANDINGS },
    );

    expect(code).toBe(0);
    const text = io.out.join("\n");
    expect(text).toContain("      where it stands: Archived on main (Ready)");
    expect(text).toContain("Main read from origin/main. Refs last fetched 2026-09-14 00:00 UTC.");
    expect(text).toContain("Pull requests were not read: gh is not installed.");
  });

  it("carries each change's word beside the report in its json", async () => {
    const io = collectingIo();

    await readyCommand(
      { workspaceRoot: "/repo", format: "json" },
      { ...io, read: async () => REPORT, readStandings: async () => STANDINGS },
    );

    const json = JSON.parse(io.out.join(""));
    expect(json.changes).toEqual(REPORT.changes);
    expect(json.states.alpha).toMatchObject({ key: "archived-on-main", word: "Archived on main", colour: "settled" });
  });

  it("prints the report as before where standings cannot be read", async () => {
    const io = collectingIo();

    await readyCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => REPORT, readStandings: async () => { throw new Error("not a git repository"); } },
    );

    expect(io.out.join("\n")).not.toContain("where it stands");
  });
});
