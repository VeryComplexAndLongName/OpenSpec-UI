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
} as const;

/** How many detail lines a card of `height` layout units holds whole,
 * where one unit is one `rem` (ADR 0025's `--u`). A card that carries a
 * state word spends a line on it. Never negative. */
export function pipelineCardDetailLines(height: number, options: { hasState: boolean }): number {
  const chrome = 2 * PIPELINE_CARD_REM.paddingBlock
    + 2 * PIPELINE_CARD_REM.borderBlock
    + PIPELINE_CARD_REM.nameLine
    + (options.hasState ? PIPELINE_CARD_REM.stateLine : 0);
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
