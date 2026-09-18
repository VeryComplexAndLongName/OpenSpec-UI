import { describe, expect, it } from "vitest";
import type { ChangeStanding, StandingCopy } from "./change-standing-facts.js";
import { describeChangeState, type ChangeStateFacts } from "./change-state-word.js";

function copy(label: string, done: number, total: number, runs: StandingCopy["runs"] = []): StandingCopy {
  return { label, path: `/wt/${label}`, counts: { done, total }, runs };
}

function standing(overrides: Partial<ChangeStanding> = {}): ChangeStanding {
  return { changeName: "alpha", here: copy("repo", 1, 4), elsewhere: [], main: { kind: "absent" }, ...overrides };
}

function word(facts: ChangeStateFacts): string {
  return describeChangeState(facts).word;
}

describe("describeChangeState — one word per state (a-change-says-where-it-stands 3.1b)", () => {
  it("Running, from a run's record here", () => {
    expect(word({ standing: standing({ here: copy("repo", 1, 4, [{ instanceId: "r", stage: "apply", waiting: false }]) }) })).toBe("Running");
  });

  it("Running in a named directory", () => {
    expect(word({ standing: standing({ elsewhere: [copy("proposals", 1, 4, [{ instanceId: "r", stage: "apply", waiting: false }])] }) }))
      .toBe("Running in proposals");
  });

  it("Waiting for you where this host can answer, and otherwise waiting in a named directory", () => {
    const waitingHere = standing({ here: copy("repo", 1, 4, [{ instanceId: "r", stage: "apply", waiting: true }]) });
    expect(word({ standing: waitingHere, answerableHere: true })).toBe("Waiting for you");
    // a-change-is-run-from-its-card, ADR 0029: a run waiting here that this
    // host does not hold is not waiting for the reader of this surface.
    expect(word({ standing: waitingHere })).toBe("Waiting in repo");
    expect(word({ standing: standing({ elsewhere: [copy("proposals", 1, 4, [{ instanceId: "r", stage: "apply", waiting: true }])] }) }))
      .toBe("Waiting in proposals");
  });

  it("Archived on main", () => {
    expect(word({ standing: standing({ main: { kind: "archived", archiveName: "2026-09-14-alpha" } }) })).toBe("Archived on main");
  });

  it("Merged in a numbered pull request", () => {
    expect(word({ standing: standing({ main: { kind: "active" }, pullRequest: { number: 42, state: "MERGED" } }) })).toBe("Merged in #42");
  });

  it("Deleted on main", () => {
    expect(word({ standing: standing({ main: { kind: "deleted" } }) })).toBe("Deleted on main");
  });

  it("Further along in a named directory, or on a named branch", () => {
    expect(word({ standing: standing({ elsewhere: [copy("proposals", 3, 4)] }) })).toBe("Further along in proposals");
    expect(word({ standing: standing({ branch: { name: "alpha", local: false, remote: true, counts: { done: 2, total: 4 } } }) }))
      .toBe("Further along on branch alpha");
  });

  it("Failed at a stage, and stopped at a stage", () => {
    expect(word({ standing: standing(), lastRun: { outcome: "failed", stage: "verify" } })).toBe("Failed at verify");
    expect(word({ standing: standing(), lastRun: { outcome: "stopped", stage: "apply" } })).toBe("Stopped at apply");
  });

  it("Done, Blocked and Ready", () => {
    expect(word({ standing: standing({ here: copy("repo", 4, 4) }) })).toBe("Done");
    expect(word({ standing: standing(), readiness: "blocked" })).toBe("Blocked");
    expect(word({ standing: standing(), readiness: "ready" })).toBe("Ready");
  });

  // a-blocked-change-says-so-where-it-is-listed 1.3, reported by DW: the
  // listing said Ready while the graph said blocked, and a bare "Blocked"
  // still sends the reader to the graph to learn what by.
  it("Blocked names what blocks it, and counts the rest", () => {
    expect(word({ standing: standing(), readiness: "blocked", blockers: ["apply-plan-stays-pending"] }))
      .toBe("Blocked by apply-plan-stays-pending");
    expect(word({ standing: standing(), readiness: "blocked", blockers: ["first", "second", "third"] }))
      .toBe("Blocked by first and 2 more");
    // A reading that says blocked and names nothing still says blocked.
    expect(word({ standing: standing(), readiness: "blocked", blockers: [] })).toBe("Blocked");
  });

  it("says both where a finished change is still blocked", () => {
    const described = describeChangeState({
      standing: standing({ here: copy("repo", 4, 4) }),
      readiness: "blocked",
      blockers: ["apply-plan-stays-pending"],
    });

    expect(described.word).toBe("Done");
    expect(described.lines.map((line) => line.text)).toContain("Blocked by apply-plan-stays-pending");
  });

  it("stops saying blocked once the blocker has archived", () => {
    // Readiness keeps only the blockers that are still active, so an
    // archived blocker arrives as a ready reading with none.
    expect(word({ standing: standing(), readiness: "ready", blockers: [] })).toBe("Ready");
  });
});

describe("describeChangeState — what else applies", () => {
  it("says Further along with Ready as a line and both counts, in the ahead colour", () => {
    const described = describeChangeState({ standing: standing({ elsewhere: [copy("proposals", 3, 4)] }), readiness: "ready" });

    expect(described).toMatchObject({ key: "further-along", colour: "ahead", badge: "F" });
    expect(described.lines).toEqual([
      { text: "Ready", source: "this checkout" },
      { text: "3 of 4 done in proposals, 1 of 4 here", source: "the copy in proposals" },
    ]);
  });

  it("says Archived on main over Ready here, in the settled colour", () => {
    const described = describeChangeState({ standing: standing({ main: { kind: "archived", archiveName: "2026-09-14-alpha" } }), readiness: "ready" });

    expect(described).toMatchObject({ word: "Archived on main", colour: "settled" });
    expect(described.lines.map((line) => line.text)).toEqual(["Ready"]);
  });

  it("says a change no other source has is only here", () => {
    expect(describeChangeState({ standing: standing() }).lines).toContainEqual({ text: "Only here", source: "every source read" });
  });

  it("gives the same word, lines and colour for the same facts, whoever asks", () => {
    const facts: ChangeStateFacts = { standing: standing({ main: { kind: "deleted" }, elsewhere: [copy("proposals", 2, 4)] }), readiness: "blocked" };

    expect(describeChangeState(facts)).toEqual(describeChangeState(structuredClone(facts)));
    expect(describeChangeState(facts)).toMatchObject({ word: "Deleted on main", colour: "deleted" });
  });
});
