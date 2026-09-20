import { describe, expect, it } from "vitest";
import { isUnrecordedTask, parseTaskChecklist, taskEndingOf } from "./task-checklist.js";

// a-change-lands-with-nothing-open 1.4. Over real task text, in the shape
// this repository's own task lists are written in.

const LIST = [
  "## 1. The work",
  "",
  "- [x] 1.1 The function returns the unit.",
  "- [ ] 1.2 The host says it.",
  "- [x] 1.3 **Human-only.** Whether it reads clearly.",
  "  Done by Claude on 2026-09-20 at the owner's request: ran the report",
  "  and saw the badge.",
  "- [x] 1.4 **Human-only.** Whether the colour reads on a dark theme.",
  "  **Waived by the owner:** the theme is not shipped yet.",
  "- [x] 1.5 **Human-only.** Whether a ceiling per unit reads clearly.",
  "  **Deferred:** judged once it ships; in the Human-Only Inbox.",
  "- [x] 1.6 **Human-only.** Whether the picture is right.",
  "- [x] 1.7 **Delegated to claude-cli.** Run the browser suite.",
  "- [x] 1.8 **Bold about something else.** An ordinary tick.",
].join("\n");

const items = parseTaskChecklist(LIST);
const item = (number: string) => {
  const found = items.find((one) => one.text.startsWith(number));
  if (found === undefined) throw new Error(`no item ${number}`);
  return found;
};

describe("how a closed item ended", () => {
  it("reads an ordinary tick as done", () => {
    expect(item("1.1").ending).toBe("done");
  });

  it("gives an open item no ending at all", () => {
    expect(item("1.2").ending).toBeUndefined();
    expect(taskEndingOf(item("1.2"))).toBeUndefined();
  });

  it("reads a waiver written under the item", () => {
    expect(item("1.4").ending).toBe("waived");
  });

  it("reads a deferral written under the item", () => {
    expect(item("1.5").ending).toBe("deferred");
  });

  it("reads a bold lead that is neither as done", () => {
    expect(item("1.8").ending).toBe("done");
  });

  it("prefers deferred where an item says both", () => {
    const both = parseTaskChecklist([
      "- [x] 2.1 **Human-only.** Something.",
      "  **Waived by the owner:** for now. **Deferred:** and moved to the inbox.",
    ].join("\n"));
    expect(both[0]?.ending).toBe("deferred");
  });
});

describe("a tick with nothing written under it", () => {
  it("reports a human-only item closed with no record", () => {
    expect(isUnrecordedTask(item("1.6"))).toBe(true);
  });

  it("accepts one that carries its record", () => {
    expect(isUnrecordedTask(item("1.3"))).toBe(false);
  });

  it("reports a delegated item closed with no record", () => {
    expect(isUnrecordedTask(item("1.7"))).toBe(true);
  });

  it("asks nothing of an ordinary item", () => {
    expect(isUnrecordedTask(item("1.1"))).toBe(false);
  });

  it("asks nothing of a waived or deferred item: the words are the record", () => {
    expect(isUnrecordedTask(item("1.4"))).toBe(false);
    expect(isUnrecordedTask(item("1.5"))).toBe(false);
  });

  it("asks nothing of an open item", () => {
    expect(isUnrecordedTask(item("1.2"))).toBe(false);
  });
});
