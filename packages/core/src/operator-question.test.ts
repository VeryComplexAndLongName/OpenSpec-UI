import { describe, expect, it } from "vitest";
import { LineCollector, readOperatorQuestion } from "./operator-question.js";

// the-agent-asks-the-operator 1.2.
describe("readOperatorQuestion", () => {
  it("reads the question after the marker, whatever marks and emphasis surround it", () => {
    expect(readOperatorQuestion("Question for the operator: Keep the v1 API?")).toBe("Keep the v1 API?");
    expect(readOperatorQuestion("- **Question for the operator:** Keep the v1 API? (yes / no)**")).toBe("Keep the v1 API? (yes / no)");
    expect(readOperatorQuestion("> 1. `Question for the operator`: Which database?")).toBe("Which database?");
    expect(readOperatorQuestion("## question for the operator: Which database?")).toBe("Which database?");
  });

  it("reads nothing from prose, or from a marker that asks nothing", () => {
    expect(readOperatorQuestion("I have a question for the operator: which one?")).toBeUndefined();
    expect(readOperatorQuestion("Question for the operator:")).toBeUndefined();
    expect(readOperatorQuestion("Question for the operator: **")).toBeUndefined();
  });
});

describe("LineCollector", () => {
  it("joins lines a stream cut anywhere, and keeps the unfinished end for last", () => {
    const lines = new LineCollector();

    expect(lines.take("first li")).toEqual([]);
    expect(lines.take("ne\nQuestion for the op")).toEqual(["first line"]);
    expect(lines.take("erator: Which?\r\nlast")).toEqual(["Question for the operator: Which?"]);
    expect(lines.rest()).toEqual(["last"]);
    expect(lines.rest()).toEqual([]);
  });
});
