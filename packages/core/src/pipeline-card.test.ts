import { describe, expect, it } from "vitest";
import { NODE_HEIGHT } from "./change-layout.js";
import { PIPELINE_CARD_REM, fitPipelineCardDetails, pipelineCardDetailLines } from "./pipeline-card.js";

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
