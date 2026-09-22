import { describe, expect, it } from "vitest";
import type { ChangeStageReading } from "@openspec-ui/core";
import { stagesCommand } from "./stages-command.js";

// a-change-knows-its-stage: the CLI's words for where a change is.

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

const at = (hour: number) => new Date(Date.UTC(2026, 8, 22, hour)).toISOString();
const now = () => new Date(at(10));

const reading: ChangeStageReading = {
  changeName: "demo",
  stage: "in-review",
  since: at(6),
  roles: { owner: "ada", implementer: "bob" },
  visits: [
    { stage: "in-progress", from: at(1), to: at(3), enteredBy: { stage: "in-progress", at: at(1), source: "git-blame", what: "closed 1.1" } },
    { stage: "in-review", from: at(3), to: at(4), enteredBy: { stage: "in-review", at: at(3), source: "forge", what: "#12 opened" } },
    { stage: "in-progress", from: at(4), to: at(6), enteredBy: { stage: "in-progress", at: at(4), source: "history", what: "ada: a gap", back: true } },
    { stage: "in-review", from: at(6), enteredBy: { stage: "in-review", at: at(6), source: "git-commit", what: "pushed for review" } },
  ],
  totals: [
    { stage: "in-progress", visits: 2, ms: 4 * 3_600_000 },
    { stage: "in-review", visits: 2, ms: 5 * 3_600_000 },
  ],
};

describe("stages", () => {
  it("lists each active change where it is, for how long, and who holds it", async () => {
    const { out, deps } = capture();

    expect(await stagesCommand({ workspaceRoot: "/repo", format: "text" }, { ...deps, now, standings: async () => [], readAll: async () => [reading] })).toBe(0);
    expect(out).toEqual(["demo  In review, for 4h  (Owner ada, Implementer bob)"]);
  });

  it("prints one change's every stay, and the time in each stage over all its visits", async () => {
    const { out, deps } = capture();

    await stagesCommand({ workspaceRoot: "/repo", changeName: "demo", format: "text" }, { ...deps, now, standings: async () => [], readOne: async () => reading });

    expect(out).toEqual([
      "demo: In review. Owner ada, Implementer bob.",
      `  In progress, ${at(1)} to ${at(3)}, 2h (closed 1.1)`,
      `  In review, ${at(3)} to ${at(4)}, 1h (#12 opened)`,
      `  In progress, ${at(4)} to ${at(6)}, 2h (sent back: ada: a gap)`,
      `  In review, ${at(6)} to now, 4h (pushed for review)`,
      "Time in each stage:",
      "  In progress: 4h, over 2 visits",
      "  In review: 5h, over 2 visits",
    ]);
  });

  it("still answers where the standings cannot be read", async () => {
    const { out, deps } = capture();

    const code = await stagesCommand({ workspaceRoot: "/repo", format: "text" }, {
      ...deps, now,
      standings: async () => { throw new Error("gh is not installed"); },
      readAll: async () => [{ ...reading, since: undefined as unknown as string, stage: "planned", visits: [], totals: [] } as ChangeStageReading],
    });

    expect(code).toBe(0);
    expect(out[0]).toContain("demo  Planned");
  });
});
