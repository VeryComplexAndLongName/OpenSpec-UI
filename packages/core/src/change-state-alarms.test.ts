import { describe, expect, it } from "vitest";
import { describeChangeState } from "./change-state-word.js";
import type { ChangeStanding } from "./change-standing-facts.js";

// a-change-lands-with-nothing-open 4. Two alarms, and the silence that
// is not one.

function standing(partial: Partial<ChangeStanding> = {}): ChangeStanding {
  return {
    changeName: "demo",
    here: { label: "repo", path: "/repo", counts: { done: 5, total: 5 }, runs: [] },
    elsewhere: [],
    ...partial,
  };
}

const wordOf = (facts: Parameters<typeof describeChangeState>[0]): string => describeChangeState(facts).word;

describe("work that is finished and did not land", () => {
  it("says so where there is no pull request at all", () => {
    expect(wordOf({ standing: standing(), pullRequestsRead: true })).toBe("Finished, never pushed");
  });

  it("says so where the pull request was closed unmerged", () => {
    const facts = { standing: standing({ pullRequest: { number: 12, state: "CLOSED" as const } }), pullRequestsRead: true };

    expect(wordOf(facts)).toBe("Finished, and #12 was closed");
  });

  it("stays silent where pull requests could not be read", () => {
    expect(wordOf({ standing: standing() })).not.toContain("Finished");
    expect(wordOf({ standing: standing(), pullRequestsRead: false })).not.toContain("Finished");
  });

  it("stays silent while an item is open", () => {
    const open = standing({ here: { label: "repo", path: "/repo", counts: { done: 4, total: 5 }, runs: [] } });

    expect(wordOf({ standing: open, pullRequestsRead: true })).not.toContain("Finished");
  });

  it("stays silent for a change with no task list counted", () => {
    const none = standing({ here: { label: "repo", path: "/repo", runs: [] } });

    expect(wordOf({ standing: none, pullRequestsRead: true })).not.toContain("Finished");
  });

  it("stays silent once the change is archived on the default branch", () => {
    const archived = standing({ main: { kind: "archived", archiveName: "2026-09-20-demo" } });

    expect(wordOf({ standing: archived, pullRequestsRead: true })).toBe("Archived on main");
  });

  it("says nothing of the sort where the pull request merged", () => {
    const merged = standing({ pullRequest: { number: 9, state: "MERGED" } });

    expect(wordOf({ standing: merged, pullRequestsRead: true })).toBe("Merged in #9");
  });

  it("is drawn in the colour a reader stops at", () => {
    expect(describeChangeState({ standing: standing(), pullRequestsRead: true }).colour).toBe("failed");
  });
});
