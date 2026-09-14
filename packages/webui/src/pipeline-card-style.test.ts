// the-pipeline-shows-what-it-has-read 2.2: the stylesheet draws a Pipeline
// card with the lengths core counts its lines by. If the two drift, a card
// draws half a line again, or leaves room it was told it did not have.

import { describe, expect, it } from "vitest";
import { PIPELINE_CARD_REM } from "@openspec-ui/core/browser";
import { shellThemeCss } from "./shell-ui.js";

function rule(selector: string): string {
  const start = shellThemeCss.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return shellThemeCss.slice(start, shellThemeCss.indexOf("}", start));
}

/** A length on a card, times the picture's zoom (a-card-opens-to-its-tasks). */
function zoomed(rem: number): string {
  return `calc(${rem}rem * var(--pipeline-zoom, 1))`;
}

describe("the Pipeline card's stylesheet", () => {
  it("pads and borders a card by the lengths core subtracts", () => {
    const card = rule(".openspec-pipeline-node");
    expect(card).toContain(`padding: ${zoomed(PIPELINE_CARD_REM.paddingBlock)} 8px;`);
    expect(card).toContain(`border-top-width: ${zoomed(PIPELINE_CARD_REM.borderBlock)};`);
    expect(card).toContain(`border-bottom-width: ${zoomed(PIPELINE_CARD_REM.borderBlock)};`);
  });

  it("gives the name, the state and each detail the line heights core counts", () => {
    expect(rule(".openspec-pipeline-node-name")).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.nameLine)};`);
    expect(rule(".openspec-pipeline-node-state")).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.stateLine)};`);
    expect(rule(".openspec-pipeline-node-detail")).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.detailLine)};`);
    expect(rule(".openspec-pipeline-node-head")).toContain(`height: ${zoomed(PIPELINE_CARD_REM.nameLine)};`);
  });

  // a-change-is-run-from-its-card 5.2–5.8
  it("gives a card's row of controls the height core subtracts for it", () => {
    const controls = rule(".openspec-pipeline-node-controls");
    expect(controls).toContain(`height: ${zoomed(PIPELINE_CARD_REM.controlsLine)};`);
    expect(controls).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.controlsLine)};`);
  });

  // a-card-opens-to-its-tasks 3.6
  it("gives a task row and a section heading the heights core adds for them", () => {
    const task = rule(".openspec-pipeline-task");
    expect(task).toContain(`\n    height: ${zoomed(PIPELINE_CARD_REM.taskRow)};`);
    expect(task).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.taskRow)};`);
    const section = rule(".openspec-pipeline-task-section");
    expect(section).toContain(`\n    height: ${zoomed(PIPELINE_CARD_REM.sectionRow)};`);
    expect(section).toContain(`line-height: ${zoomed(PIPELINE_CARD_REM.sectionRow)};`);
  });

  // a-card-opens-to-its-tasks 4.1
  it("scales the picture's unit by its zoom, as every length on a card is", () => {
    expect(rule(".openspec-pipeline-picture")).toContain("--u: calc(1rem * var(--pipeline-zoom, 1));");
  });
});
