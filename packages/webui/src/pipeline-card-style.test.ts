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

describe("the Pipeline card's stylesheet", () => {
  it("pads and borders a card by the lengths core subtracts", () => {
    const card = rule(".openspec-pipeline-node");
    expect(card).toContain(`padding: ${PIPELINE_CARD_REM.paddingBlock}rem 8px;`);
    expect(card).toContain(`border-top-width: ${PIPELINE_CARD_REM.borderBlock}rem;`);
    expect(card).toContain(`border-bottom-width: ${PIPELINE_CARD_REM.borderBlock}rem;`);
  });

  it("gives the name, the state and each detail the line heights core counts", () => {
    expect(rule(".openspec-pipeline-node-name")).toContain(`line-height: ${PIPELINE_CARD_REM.nameLine}rem;`);
    expect(rule(".openspec-pipeline-node-state")).toContain(`line-height: ${PIPELINE_CARD_REM.stateLine}rem;`);
    expect(rule(".openspec-pipeline-node-detail")).toContain(`line-height: ${PIPELINE_CARD_REM.detailLine}rem;`);
  });

  // a-change-is-run-from-its-card 5.2–5.8
  it("gives a card's row of controls the height core subtracts for it", () => {
    const controls = rule(".openspec-pipeline-node-controls");
    expect(controls).toContain(`height: ${PIPELINE_CARD_REM.controlsLine}rem;`);
    expect(controls).toContain(`line-height: ${PIPELINE_CARD_REM.controlsLine}rem;`);
  });
});
