import { describe, expect, it } from "vitest";
import { STAGES, STAGE_PURPOSES, skipsStage } from "./harness-stage.js";

describe("harness-stage", () => {
  it("STAGE_PURPOSES has an entry for every member of STAGES", () => {
    for (const stage of STAGES) {
      expect(STAGE_PURPOSES[stage]).toBeTypeOf("string");
    }
  });

  it("skipsStage is true when skipStages names the stage", () => {
    expect(skipsStage({ skipStages: ["review"] }, "review")).toBe(true);
  });

  it("skipsStage is false when skipStages is absent", () => {
    expect(skipsStage({}, "review")).toBe(false);
  });
});
