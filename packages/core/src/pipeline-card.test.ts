import { describe, expect, it } from "vitest";
import { NODE_HEIGHT } from "./change-layout.js";
import { PIPELINE_CARD_REM, fitPipelineCardDetails, pipelineCardDetailLines, pipelineOpenCardHeight } from "./pipeline-card.js";

// the-pipeline-shows-what-it-has-read 2.1, 3.1: a card's lines are derived
// from its size, never measured.

const CHROME_WITHOUT_STATE = 2 * PIPELINE_CARD_REM.paddingBlock
  + 2 * PIPELINE_CARD_REM.borderBlock
  + PIPELINE_CARD_REM.nameLine;

describe("pipelineCardDetailLines", () => {
  it("holds two detail lines on a layout card that carries a state, and three on one that does not", () => {
    expect(pipelineCardDetailLines(NODE_HEIGHT, { hasState: true })).toBe(2);
    expect(pipelineCardDetailLines(NODE_HEIGHT, { hasState: false })).toBe(3);
  });

  // a-change-is-run-from-its-card 5.2–5.8
  it("spends the row of controls on a card that carries them, and nothing on one that does not", () => {
    const withoutControls = pipelineCardDetailLines(NODE_HEIGHT, { hasState: true });
    const withControls = pipelineCardDetailLines(NODE_HEIGHT, { hasState: true, hasControls: true });
    const roomWithoutControls = NODE_HEIGHT - CHROME_WITHOUT_STATE - PIPELINE_CARD_REM.stateLine;

    expect(withControls).toBe(Math.floor((roomWithoutControls - PIPELINE_CARD_REM.controlsLine) / PIPELINE_CARD_REM.detailLine + 1e-9));
    expect(withControls).toBeLessThan(withoutControls);
    expect(withControls).toBeGreaterThanOrEqual(1);
    expect(pipelineCardDetailLines(NODE_HEIGHT, { hasState: true, hasControls: false })).toBe(withoutControls);
  });

  it("holds none when the chrome fills the card, and never a negative count", () => {
    expect(pipelineCardDetailLines(CHROME_WITHOUT_STATE, { hasState: false })).toBe(0);
    expect(pipelineCardDetailLines(1, { hasState: true })).toBe(0);
  });

  it("counts a room that is an exact multiple of a line as exactly that many lines", () => {
    const height = CHROME_WITHOUT_STATE + 4 * PIPELINE_CARD_REM.detailLine;
    expect(pipelineCardDetailLines(height, { hasState: false })).toBe(4);
    expect(pipelineCardDetailLines(height - 0.01, { hasState: false })).toBe(3);
  });
});

// a-card-opens-to-its-tasks 2.5: an open card's height is derived from its
// rows.
describe("pipelineOpenCardHeight", () => {
  it("is the closed height for a card with no tasks", () => {
    expect(pipelineOpenCardHeight(0, 0)).toBe(NODE_HEIGHT);
  });

  it("adds exactly one row per task and one per section", () => {
    expect(pipelineOpenCardHeight(3, 1)).toBe(NODE_HEIGHT + 3 * PIPELINE_CARD_REM.taskRow + PIPELINE_CARD_REM.sectionRow);
  });
});

describe("fitPipelineCardDetails", () => {
  it("draws every line that fits and leaves nothing beyond", () => {
    expect(fitPipelineCardDetails(2, 3)).toEqual({ drawn: 2, beyond: 0 });
  });

  it("leaves the lines past the budget beyond, counted", () => {
    expect(fitPipelineCardDetails(5, 2)).toEqual({ drawn: 2, beyond: 3 });
  });

  it("draws nothing on a card with no room, and leaves every line beyond", () => {
    expect(fitPipelineCardDetails(2, 0)).toEqual({ drawn: 0, beyond: 2 });
  });
});
