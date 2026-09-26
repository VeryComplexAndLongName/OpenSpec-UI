// A team's own columns on the board (ADR 0037, amended 2026-09-26;
// a-team-names-its-columns).
//
// A column is a view of stages, never a stage: a change's stage is still
// derived from facts, and a card moves when a fact moves it. So the file
// may join neighbouring stages under one title, and nothing else: every
// stage in exactly one column, the columns in the stages' order, no stage
// split. A file that breaks any of that is refused whole, and the board
// draws the stages' own columns. A leaf with no Node imports, so the
// browser can have it; the file is read in `board-columns.ts`.

import { CHANGE_STAGES, describeStage, type ChangeStage } from "./change-history-facts.js";

/** Where a team names its columns, beside the harness's own file. */
export const BOARD_COLUMNS_FILE = "openspec/board.json";

export interface BoardColumn {
  title: string;
  /** The stages it holds, in their order. */
  stages: ChangeStage[];
}

/** What reading the file found: nothing to read, columns to draw, or why
 * the file was refused. */
export type BoardColumnsReading =
  | { kind: "none" }
  | { kind: "columns"; columns: BoardColumn[] }
  | { kind: "refused"; reason: string };

function isStage(value: unknown): value is ChangeStage {
  return typeof value === "string" && (CHANGE_STAGES as readonly string[]).includes(value);
}

/** The columns a file's text names, or why they cannot be drawn. The reason
 * says what to change, in the words the file uses. */
export function parseBoardColumns(text: string): BoardColumnsReading {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { kind: "refused", reason: `${BOARD_COLUMNS_FILE} is not JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  const list = typeof parsed === "object" && parsed !== null ? (parsed as { columns?: unknown }).columns : undefined;
  if (!Array.isArray(list) || list.length === 0) {
    return { kind: "refused", reason: `${BOARD_COLUMNS_FILE} needs "columns", a list of { "title", "stages" }.` };
  }
  const columns: BoardColumn[] = [];
  const placed = new Map<ChangeStage, string>();
  for (const [index, entry] of list.entries()) {
    const title = typeof entry === "object" && entry !== null ? (entry as { title?: unknown }).title : undefined;
    const stages = typeof entry === "object" && entry !== null ? (entry as { stages?: unknown }).stages : undefined;
    if (typeof title !== "string" || title.trim().length === 0) {
      return { kind: "refused", reason: `Column ${index + 1} has no "title".` };
    }
    if (!Array.isArray(stages) || stages.length === 0) {
      return { kind: "refused", reason: `"${title}" names no "stages".` };
    }
    for (const stage of stages) {
      if (!isStage(stage)) {
        return { kind: "refused", reason: `"${title}" names ${JSON.stringify(stage)}, which is not a stage. The stages are ${CHANGE_STAGES.join(", ")}.` };
      }
      const already = placed.get(stage);
      if (already !== undefined) {
        return { kind: "refused", reason: `"${stage}" is in both "${already}" and "${title}": a card would stand in two places.` };
      }
      placed.set(stage, title);
    }
    columns.push({ title: title.trim(), stages: [...stages as ChangeStage[]] });
  }
  const missing = CHANGE_STAGES.filter((stage) => !placed.has(stage));
  if (missing.length > 0) {
    return { kind: "refused", reason: `No column holds ${missing.map((stage) => `"${stage}"`).join(", ")}: its cards would stand nowhere.` };
  }
  // In the stages' own order, each column's stages neighbours: a card moves
  // left to right, and a column that skipped a stage would split another.
  const order = columns.flatMap((column) => column.stages);
  const inOrder = order.every((stage, index) => stage === CHANGE_STAGES[index]);
  if (!inOrder) {
    return { kind: "refused", reason: `The columns must keep the stages' order, ${CHANGE_STAGES.join(", ")}: a column may join neighbouring stages, never reorder them.` };
  }
  return { kind: "columns", columns };
}

/** The column each stage stands in, by index. */
export function columnOfStage(columns: readonly BoardColumn[]): Map<ChangeStage, number> {
  return new Map(columns.flatMap((column, index) => column.stages.map((stage) => [stage, index] as const)));
}

/** A column's words for a reader who needs to know what it holds:
 * "Backlog (Drafted, Proposed)". */
export function describeBoardColumn(column: BoardColumn): string {
  return column.stages.length === 1 && describeStage(column.stages[0] as ChangeStage) === column.title
    ? column.title
    : `${column.title} (${column.stages.map((stage) => describeStage(stage)).join(", ")})`;
}
