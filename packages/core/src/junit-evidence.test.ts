import { describe, expect, it } from "vitest";
import { junitScenarioSummary, parseJUnit } from "./junit-evidence.js";

const head = "a".repeat(40);
const scenario = { capability: "auth", requirement: "Session expires", scenario: "Expired session" };
const xml = `<testsuites><testsuite name="outer"><testsuite name="inner">
  <testcase classname="Session" name="accept"/>
  <testcase classname="Session" name="reject"><failure>secret failure body</failure><system-out>private output</system-out></testcase>
  <testcase classname="Session" name="broken"><error message="private error"/></testcase>
  <testcase classname="Session" name="later"><skipped/></testcase>
  <testcase classname="Session" name="duplicate"/><testcase classname="Session" name="duplicate"/>
</testsuite></testsuite></testsuites>`;
const mapping = JSON.stringify({ scenarios: [{ ...scenario,
  tests: ["accept", "reject", "broken", "later", "absent", "duplicate"].map((name) => ({ classname: "Session", name })),
}] });
const report = { testedCommit: head, importedAt: "2026-11-21T10:00:00Z", tests: parseJUnit(xml) };

describe("JUnit evidence", () => {
  it("normalizes individual nested testcase outcomes and discards raw bodies", () => {
    expect(parseJUnit(xml).map((test) => test.state)).toEqual(["passed", "failed", "error", "skipped", "passed", "passed"]);
    expect(JSON.stringify(parseJUnit(xml))).not.toMatch(/secret|private|output|message/u);
    expect(parseJUnit('<testsuite tests="300" failures="0"/>')).toEqual([]);
    expect(parseJUnit('<testsuite><testcase name="disabled" status="notrun" result="suppressed"/></testsuite>')[0]?.state).toBe("skipped");
    expect(parseJUnit('<testsuite><testcase name="a&amp;b&quot;"/></testsuite>')[0]).toEqual({ classname: "", name: 'a&b"', state: "passed" });
  });

  it.each([
    "", "<html/>", "<testsuite><testcase name='x'></testsuite>",
    "<!DOCTYPE testsuite [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><testsuite/>",
    "<testsuite><testcase/></testsuite>", "<testsuite><testcase name='a'><testcase name='b'/></testcase></testsuite>",
    "<testsuite>" + "<x>".repeat(64) + "</x>".repeat(64) + "</testsuite>",
    "<testsuite>" + "<testcase name='x'/>".repeat(2001) + "</testsuite>",
    "<testsuite><!--" + "x".repeat(128 * 1024) + "--></testsuite>",
  ])("refuses unsafe, invalid or over-limit input without disclosing it", (input) => {
    expect(() => parseJUnit(input)).toThrow(/OSW-CHG-014/u);
  });

  it("distinguishes all observations and preserves them in the summary", () => {
    const summary = junitScenarioSummary([scenario], mapping, report, head).join("\n");
    for (const state of ["passed", "failed", "error", "skipped", "missing", "ambiguous"]) expect(summary).toContain(state);
    expect(summary).toContain("User-declared tested commit");
    expect(summary).toContain("not independently verified");
    expect(summary).not.toContain("secret failure");
  });

  it("labels old results historical even when the testcase previously passed", () => {
    const summary = junitScenarioSummary([scenario], mapping, report, "b".repeat(40)).join("\n");
    expect(summary).toContain("Historical report");
    expect(summary).toContain("historical passed");
    expect(summary).not.toContain("revision matches");
  });

  it.each(["{", JSON.stringify({ scenarios: [{ ...scenario, scenario: "unknown", tests: [{ classname: "", name: "x" }] }] }),
    JSON.stringify({ scenarios: [JSON.parse(mapping).scenarios[0], JSON.parse(mapping).scenarios[0]] }),
  ])("discloses an invalid mapping and does not invent associations", (bad) => {
    const text = junitScenarioSummary([scenario], bad, report, head).join("\n");
    expect(text).toContain("invalid");
    expect(text).toContain("No test linked");
    expect(text).not.toContain(": passed");
  });

  it("shows imported provenance even when the change has no delta scenarios", () => {
    const text = junitScenarioSummary([], undefined, report, head).join("\n");
    expect(text).toContain("User-declared tested commit");
    expect(text).toContain("No added or modified scenarios");
    expect(junitScenarioSummary([], undefined, undefined, head)).toEqual([]);
  });

  it("keeps absent imports and associations visible", () => {
    const text = junitScenarioSummary([scenario], undefined, undefined, head).join("\n");
    expect(text).toContain("No JUnit report imported");
    expect(text).toContain("No test linked");
    expect(junitScenarioSummary([scenario], mapping, undefined, head).join("\n")).toContain("no report");
  });
});
