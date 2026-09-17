// What fits on a Pipeline card — the-pipeline-shows-what-it-has-read, and
// how tall a card is — the-pipeline-cards-wear-metro.
//
// A card's size is in `rem` (ADR 0025), so how tall it is and how many lines
// it draws whole are arithmetic over the same `rem` the stylesheet uses, not
// a measurement taken after drawing: the reason ADR 0025 derives a node's
// position applies to its text as well. The stylesheet is written from these
// numbers (`packages/webui/src/shell-ui.ts`), and a test holds the two
// together.
//
// Browser-safe: no Node imports.

/** Every vertical length on a card, in `rem`. */
export const PIPELINE_CARD_REM = {
  /** The border's width at the top and at the bottom. */
  borderBlock: 0.0625,
  /** Room above the heading row. */
  headTop: 0.75,
  /** The heading row: the change's name, and the control that shows its
   * tasks. One line, never shrunk. */
  nameLine: 1.75,
  /** The state row: its gap above, then the badge. */
  stateGap: 0.375,
  stateLine: 1.25,
  /** The progress row: its gap above, then the bar and its count. */
  progressGap: 0.75,
  progressLine: 1.125,
  /** A waiting run's question: its gap above, then a box holding one line. */
  calloutGap: 0.75,
  calloutBox: 2.5,
  /** The facts: their gap above, then one line each. */
  detailsGap: 0.75,
  detailLine: 1.5,
  /** An open card's rows: their gap above, the list's border at top and
   * bottom, then one row per task and one per section heading
   * (a-card-opens-to-its-tasks). */
  tasksGap: 0.75,
  tasksBorder: 0.0625,
  taskRow: 1.75,
  sectionRow: 1.75,
  /** The footer of controls: its gap above, its top border, its padding
   * above and below the row of buttons (a-change-is-run-from-its-card). */
  controlsGap: 0.75,
  controlsBorder: 0.0625,
  controlsPadding: 0.5,
  controlsLine: 1.875,
  /** Room below the last row of a card with no footer. */
  bottom: 0.875,
} as const;

/** How many facts a card draws; the rest stay on the card for assistive
 * technology and in its title, and the last drawn line counts them. */
export const PIPELINE_CARD_DETAIL_LINES = 4;

/** What a card holds, as far as its height is concerned. */
export interface PipelineCardParts {
  /** A badge row: every card of this checkout has one, and a card of
   * another working directory has one while a run there is working. */
  hasState: boolean;
  /** A progress bar: a card whose change has a task list. */
  hasProgress: boolean;
  /** A waiting run's question. */
  hasCallout: boolean;
  /** How many facts the card has; it draws at most
   * `PIPELINE_CARD_DETAIL_LINES` of them. */
  detailLines: number;
  /** A footer of controls. */
  hasControls: boolean;
  /** While the card lists its tasks: how many rows and section headings. */
  open?: { rows: number; sections: number };
}

/** How tall a card is, in layout units (one unit is one `rem`), from what it
 * holds. Derived, never measured (ADR 0025), so a column stacks its cards by
 * exactly the room each takes. */
export function pipelineCardHeight(parts: PipelineCardParts): number {
  const r = PIPELINE_CARD_REM;
  let height = 2 * r.borderBlock + r.headTop + r.nameLine;
  if (parts.hasState) height += r.stateGap + r.stateLine;
  if (parts.hasProgress) height += r.progressGap + r.progressLine;
  if (parts.hasCallout) height += r.calloutGap + r.calloutBox;
  const lines = fitPipelineCardDetails(parts.detailLines).drawn;
  if (lines > 0) height += r.detailsGap + lines * r.detailLine;
  if (parts.open !== undefined && parts.open.rows + parts.open.sections > 0) {
    height += r.tasksGap + 2 * r.tasksBorder
      + Math.max(0, parts.open.rows) * r.taskRow
      + Math.max(0, parts.open.sections) * r.sectionRow;
  }
  height += parts.hasControls
    ? r.controlsGap + r.controlsBorder + 2 * r.controlsPadding + r.controlsLine
    : r.bottom;
  return height;
}

/** Where a line between cards meets a card, below its top: the middle of its
 * heading row, whatever the card holds under it (a-card-opens-to-its-tasks). */
export const PIPELINE_CARD_HEAD = PIPELINE_CARD_REM.borderBlock + PIPELINE_CARD_REM.headTop + PIPELINE_CARD_REM.nameLine / 2;

/** How a card's facts divide: the first `drawn` are drawn, and the `beyond`
 * after them stay on the card for assistive technology and in its title.
 * The last drawn line carries the count of the rest, so no line is spent
 * saying there is more. */
export function fitPipelineCardDetails(lineCount: number, budget: number = PIPELINE_CARD_DETAIL_LINES): { drawn: number; beyond: number } {
  const drawn = Math.max(0, Math.min(lineCount, budget));
  return { drawn, beyond: Math.max(0, lineCount - drawn) };
}
