// the-pipeline-shows-what-it-has-read 2.2, the-pipeline-cards-wear-metro 3.2:
// the stylesheet draws a Pipeline card with the lengths core adds up for its
// height. If the two drift, a card draws half a line again, or leaves room it
// was told it did not have.

import { describe, expect, it } from "vitest";
import { PIPELINE_CARD_REM } from "@openspec-ui/core/browser";
import { shellThemeCss } from "./shell-ui.js";

/** The first rule for exactly this selector list, from its opening brace to
 * its closing one. */
function rule(selector: string): string {
  const start = shellThemeCss.indexOf(`\n  ${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return shellThemeCss.slice(start, shellThemeCss.indexOf("}", start));
}

/** A length on a card, times the picture's zoom (a-card-opens-to-its-tasks). */
function zoomed(rem: number): string {
  return `calc(${rem}rem * var(--pipeline-zoom, 1))`;
}

const r = PIPELINE_CARD_REM;

describe("the Pipeline card's stylesheet", () => {
  it("borders a card and pads its top by the lengths core adds", () => {
    const card = rule(".openspec-pipeline-node");
    expect(card).toContain(`padding: ${zoomed(r.headTop)} ${zoomed(0.875)} 0;`);
    expect(card).toContain(`border-top-width: ${zoomed(r.borderBlock)};`);
    expect(card).toContain(`border-bottom-width: ${zoomed(r.borderBlock)};`);
    expect(card).toContain("box-sizing: border-box;");
  });

  it("gives the heading, the state row and the bar the heights and gaps core adds", () => {
    expect(rule(".openspec-pipeline-node-head")).toContain(`height: ${zoomed(r.nameLine)};`);
    expect(rule(".openspec-pipeline-node-name")).toContain(`line-height: ${zoomed(r.nameLine)};`);
    const state = rule(".openspec-pipeline-node-state-row");
    expect(state).toContain(`height: ${zoomed(r.stateLine)};`);
    expect(state).toContain(`margin-top: ${zoomed(r.stateGap)};`);
    expect(rule(".openspec-pipeline-node-state")).toContain(`line-height: ${zoomed(r.stateLine)};`);
    const progress = rule(".openspec-pipeline-node-progress");
    expect(progress).toContain(`height: ${zoomed(r.progressLine)};`);
    expect(progress).toContain(`margin-top: ${zoomed(r.progressGap)};`);
  });

  it("gives a callout, the facts and each fact the lengths core adds", () => {
    const callout = rule(".openspec-pipeline-node-callout");
    expect(callout).toContain(`height: ${zoomed(r.calloutBox)};`);
    expect(callout).toContain(`margin: ${zoomed(r.calloutGap)} 0 0;`);
    expect(rule(".openspec-pipeline-node-details")).toContain(`margin: ${zoomed(r.detailsGap)} 0 0;`);
    const detail = rule(".openspec-pipeline-node-detail");
    expect(detail).toContain(`height: ${zoomed(r.detailLine)};`);
    expect(detail).toContain(`line-height: ${zoomed(r.detailLine)};`);
  });

  // a-change-is-run-from-its-card 5.2–5.8
  it("gives a card's footer of controls the height core adds for it", () => {
    const controls = rule(".openspec-pipeline-node-controls");
    expect(controls).toContain(`height: ${zoomed(r.controlsBorder + 2 * r.controlsPadding + r.controlsLine)};`);
    expect(controls).toContain(`border-top: ${zoomed(r.controlsBorder)} solid var(--line);`);
  });

  // a-card-opens-to-its-tasks 3.6
  it("gives an open card's list, its rows and its headings the lengths core adds for them", () => {
    const list = rule(".openspec-pipeline-node-tasks");
    expect(list).toContain(`margin-top: ${zoomed(r.tasksGap)};`);
    expect(list).toContain(`border: ${zoomed(r.tasksBorder)} solid var(--line);`);
    const task = rule(".openspec-pipeline-task");
    expect(task).toContain(`\n    height: ${zoomed(r.taskRow)};`);
    expect(task).toContain("box-sizing: border-box;");
    const section = rule(".openspec-pipeline-task-section");
    expect(section).toContain(`\n    height: ${zoomed(r.sectionRow)};`);
    expect(section).toContain("box-sizing: border-box;");
  });

  // a-card-opens-to-its-tasks 4.1
  it("scales the picture's unit by its zoom, as every length on a card is", () => {
    expect(rule(".openspec-pipeline-picture")).toContain("--u: calc(1rem * var(--pipeline-zoom, 1));");
  });

  it("colours each state's badge with a badge token and its own ink", () => {
    for (const [state, token] of [["running", "cobalt"], ["waiting", "amber"], ["blocked", "mauve"], ["done", "emerald"]] as const) {
      expect(shellThemeCss).toContain(`.openspec-pipeline-node-state[data-state="${state}"] { background: var(--${token}); color: var(--${token}-ink); }`);
    }
  });
});
