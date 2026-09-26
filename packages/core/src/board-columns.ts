// Reads a team's own columns from `openspec/board.json`
// (a-team-names-its-columns). The rules are in `board-columns-facts.ts`.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { BOARD_COLUMNS_FILE, parseBoardColumns, type BoardColumnsReading } from "./board-columns-facts.js";

/** The workspace's columns: none where the file is absent, the columns
 * where it holds good ones, and why it was refused otherwise. */
export async function readBoardColumns(workspaceRoot: string): Promise<BoardColumnsReading> {
  let text: string;
  try {
    text = await readFile(path.join(workspaceRoot, BOARD_COLUMNS_FILE), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { kind: "none" };
    return { kind: "refused", reason: `${BOARD_COLUMNS_FILE} could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  return parseBoardColumns(text);
}
