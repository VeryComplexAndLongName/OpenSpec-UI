import { describe, expect, it } from "vitest";
import { NODE_HEIGHT } from "./change-layout.js";
import {
  PIPELINE_CARD_DETAIL_LINES,
  PIPELINE_CARD_HEAD,
  PIPELINE_CARD_REM,
  fitPipelineCardDetails,
  pipelineCardHeight,
} from "./pipeline-card.js";

// the-pipeline-cards-wear-metro 1.1: a card's height is derived from what it
// holds, never measured.

const r = PIPELINE_CARD_REM;
const QUIET = { hasState: true, hasProgress: true, hasCallout: false, detailLines: 0, hasControls: false };

describe("pipelineCardHeight", () => {
  it("makes a card with only its heading, badge and bar the layout's smallest card", () => {
    expect(pipelineCardHeight(QUIET)).toBe(NODE_HEIGHT);
    expect(NODE_HEIGHT).toBe(2 * r.borderBlock + r.headTop + r.nameLine + r.stateGap + r.stateLine + r.progressGap + r.progressLine + r.bottom);
  });

  it("adds each part it holds by exactly that part's lengths", () => {
    const base = pipelineCardHeight(QUIET);
    expect(pipelineCardHeight({ ...QUIET, hasCallout: true }) - base).toBe(r.calloutGap + r.calloutBox);
    expect(pipelineCardHeight({ ...QUIET, detailLines: 2 }) - base).toBe(r.detailsGap + 2 * r.detailLine);
    expect(pipelineCardHeight({ ...QUIET, hasControls: true }) - base)
      .toBe(r.controlsGap + r.controlsBorder + 2 * r.controlsPadding + r.controlsLine - r.bottom);
    expect(pipelineCardHeight({ ...QUIET, hasState: false, hasProgress: false }))
      .toBe(base - r.stateGap - r.stateLine - r.progressGap - r.progressLine);
  });

  it("draws at most the card's number of facts, however many it has", () => {
    expect(pipelineCardHeight({ ...QUIET, detailLines: 9 })).toBe(pipelineCardHeight({ ...QUIET, detailLines: PIPELINE_CARD_DETAIL_LINES }));
    expect(pipelineCardHeight({ ...QUIET, detailLines: -1 })).toBe(pipelineCardHeight(QUIET));
  });

  // a-card-opens-to-its-tasks 2.5, kept: one row per task and one per heading.
  it("adds an open card's list border, one row per task and one per section, and nothing for an empty list", () => {
    const base = pipelineCardHeight(QUIET);
    expect(pipelineCardHeight({ ...QUIET, open: { rows: 3, sections: 1 } }) - base)
      .toBe(r.tasksGap + 2 * r.tasksBorder + 3 * r.taskRow + r.sectionRow);
    expect(pipelineCardHeight({ ...QUIET, open: { rows: 0, sections: 0 } })).toBe(base);
  });
});

describe("PIPELINE_CARD_HEAD", () => {
  it("is the middle of the heading row, below the border and the room above it", () => {
    expect(PIPELINE_CARD_HEAD).toBe(r.borderBlock + r.headTop + r.nameLine / 2);
  });
});

describe("fitPipelineCardDetails", () => {
  it("draws every line up to the budget and leaves nothing beyond", () => {
    expect(fitPipelineCardDetails(2, 3)).toEqual({ drawn: 2, beyond: 0 });
    expect(fitPipelineCardDetails(3)).toEqual({ drawn: 3, beyond: 0 });
  });

  it("leaves the lines past the budget beyond, counted, with the card's own number by default", () => {
    expect(fitPipelineCardDetails(5, 2)).toEqual({ drawn: 2, beyond: 3 });
    expect(fitPipelineCardDetails(PIPELINE_CARD_DETAIL_LINES + 2)).toEqual({ drawn: PIPELINE_CARD_DETAIL_LINES, beyond: 2 });
  });

  it("draws nothing on a card with no room, and leaves every line beyond", () => {
    expect(fitPipelineCardDetails(2, 0)).toEqual({ drawn: 0, beyond: 2 });
  });
});
