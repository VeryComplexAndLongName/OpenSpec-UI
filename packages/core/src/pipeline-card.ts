// What fits on a Pipeline card — the-pipeline-shows-what-it-has-read.
//
// A card has a fixed size in `rem` (ADR 0025), so how many lines of text
// it draws whole is arithmetic over the same `rem` the stylesheet uses,
// not a measurement taken after drawing: the reason ADR 0025 derives a
// node's position applies to its text as well. The stylesheet is written
// from these numbers (`packages/webui/src/shell-ui.ts`), and a test holds
// the two together.
//
// Browser-safe: no Node imports.

import { NODE_HEIGHT } from "./change-layout.js";

/** Every vertical length on a card, in `rem`. */
export const PIPELINE_CARD_REM = {
  /** Padding above and below the text. */
  paddingBlock: 0.25,
  /** The border's width at the top and at the bottom. */
  borderBlock: 0.0625,
  /** The change's name: one line, never shrunk. */
  nameLine: 1.125,
  /** The state word, on a card that carries one. */
  stateLine: 0.875,
  /** One line of detail. */
  detailLine: 0.875,
  /** The row of controls on a card whose run this host can answer or stop,
   * or that can be started (a-change-is-run-from-its-card). */
  controlsLine: 1.25,
  /** One task row on an open card: its number, state word and text on one
   * line (a-card-opens-to-its-tasks). */
  taskRow: 1,
  /** One section heading on an open card. */
  sectionRow: 1.25,
} as const;

/** How tall a card is while it lists its tasks, in layout units: the closed
 * height plus one row per task and one per section heading. Derived, never
 * measured (ADR 0025), so the column below it moves by exactly this much
 * more than a closed card would take. */
export function pipelineOpenCardHeight(taskCount: number, sectionCount: number): number {
  return NODE_HEIGHT
    + Math.max(0, taskCount) * PIPELINE_CARD_REM.taskRow
    + Math.max(0, sectionCount) * PIPELINE_CARD_REM.sectionRow;
}

/** How many detail lines a card of `height` layout units holds whole,
 * where one unit is one `rem` (ADR 0025's `--u`). A card that carries a
 * state word spends a line on it, and a card with controls spends their
 * row. Never negative. */
export function pipelineCardDetailLines(height: number, options: { hasState: boolean; hasControls?: boolean }): number {
  const chrome = 2 * PIPELINE_CARD_REM.paddingBlock
    + 2 * PIPELINE_CARD_REM.borderBlock
    + PIPELINE_CARD_REM.nameLine
    + (options.hasState ? PIPELINE_CARD_REM.stateLine : 0)
    + (options.hasControls ? PIPELINE_CARD_REM.controlsLine : 0);
  const room = height - chrome;
  // A hair of tolerance, so a room that is an exact multiple of a line is
  // not cut a line short by floating point.
  return Math.max(0, Math.floor(room / PIPELINE_CARD_REM.detailLine + 1e-9));
}

/** How a card's detail lines divide: the first `drawn` are drawn, and the
 * `beyond` after them stay on the card for assistive technology and in
 * its title. The last drawn line carries the count of the rest, so no
 * line is spent saying there is more. */
export function fitPipelineCardDetails(lineCount: number, budget: number): { drawn: number; beyond: number } {
  const drawn = Math.max(0, Math.min(lineCount, budget));
  return { drawn, beyond: lineCount - drawn };
}
