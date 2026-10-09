import { describe, expect, it } from "vitest";
import { ACTION_GROUPS, ACTION_NOUNS, ACTION_VERBS, actionCliForm, actionCommandId, readActionTitle } from "./action-vocabulary.js";

// every-action-is-a-verb-and-a-noun (ADR 0045).
describe("the action vocabulary", () => {
  it("reads a title as its verb and noun, and says whether it asks first", () => {
    expect(readActionTitle("Configure Change Harness")).toMatchObject({ verb: { verb: "Configure", group: "set-up" }, noun: "Change Harness", asksFirst: false });
    expect(readActionTitle("Answer Question...")).toMatchObject({ verb: { verb: "Answer", group: "respond" }, noun: "Question", asksFirst: true });
  });

  it("reads nothing that is not a pair from the lists", () => {
    expect(readActionTitle("Run...")).toBeUndefined();
    expect(readActionTitle("Say Something to This Run...")).toBeUndefined();
    expect(readActionTitle("Show Things")).toBeUndefined();
  });

  it("names a pair's command id and its CLI form", () => {
    expect(actionCommandId("Configure", "Change Harness")).toBe("openspec-ui.configureChangeHarness");
    expect(actionCommandId("Set", "LLM Key")).toBe("openspec-ui.setLlmKey");
    expect(actionCliForm("Show", "Questions")).toBe("show questions");
    expect(actionCliForm("Open", "CLI View")).toBe("open cli-view");
  });

  it("puts every verb in a group that exists, once, and keeps the danger verbs dangerous", () => {
    const groups = new Set(ACTION_GROUPS.map((group) => group.group));
    expect(ACTION_VERBS.filter((verb) => !groups.has(verb.group))).toEqual([]);
    const verbs = ACTION_VERBS.map((verb) => verb.verb);
    expect(verbs.filter((verb, index) => verbs.indexOf(verb) !== index)).toEqual([]);
    expect(ACTION_VERBS.filter((verb) => verb.group === "danger").map((verb) => verb.verb)).toEqual(["Archive", "Rollback", "Delete"]);
  });

  it("lists every noun once", () => {
    expect(ACTION_NOUNS.filter((noun, index) => ACTION_NOUNS.indexOf(noun) !== index)).toEqual([]);
  });
});
