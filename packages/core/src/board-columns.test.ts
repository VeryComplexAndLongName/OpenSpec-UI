import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { columnOfStage, describeBoardColumn, parseBoardColumns } from "./board-columns-facts.js";
import { readBoardColumns } from "./board-columns.js";
import { layoutChangesByStage } from "./change-layout.js";
import type { ChangeReadiness } from "./change-readiness-facts.js";

// a-team-names-its-columns. The rules are pure; one describe reads a real
// file, a few milliseconds of filesystem, budgeted as the rest of core's.
vi.setConfig({ testTimeout: 20_000 });

const TEAM = {
  columns: [
    { title: "Backlog", stages: ["drafted", "proposed"] },
    { title: "Ready", stages: ["planned"] },
    { title: "Doing", stages: ["in-progress"] },
    { title: "Review", stages: ["in-review"] },
    { title: "Done", stages: ["landed", "archived"] },
  ],
};

describe("parseBoardColumns", () => {
  it("reads a team's columns, each a run of neighbouring stages", () => {
    const reading = parseBoardColumns(JSON.stringify(TEAM));

    expect(reading.kind).toBe("columns");
    expect(reading.kind === "columns" ? reading.columns.map((column) => column.title) : []).toEqual(["Backlog", "Ready", "Doing", "Review", "Done"]);
  });

  it("refuses a stage no column holds, and names it", () => {
    const reading = parseBoardColumns(JSON.stringify({ columns: TEAM.columns.slice(0, 4) }));

    expect(reading).toEqual({ kind: "refused", reason: 'No column holds "landed", "archived": its cards would stand nowhere.' });
  });

  it("refuses a stage in two columns", () => {
    const reading = parseBoardColumns(JSON.stringify({ columns: [...TEAM.columns, { title: "Shipped", stages: ["landed"] }] }));

    expect(reading.kind === "refused" ? reading.reason : "").toBe('"landed" is in both "Done" and "Shipped": a card would stand in two places.');
  });

  it("refuses columns out of the stages' order, or joining stages that are not neighbours", () => {
    const reordered = parseBoardColumns(JSON.stringify({ columns: [TEAM.columns[1], TEAM.columns[0], ...TEAM.columns.slice(2)] }));
    const skipping = parseBoardColumns(JSON.stringify({
      columns: [
        { title: "Early", stages: ["drafted", "planned"] },
        { title: "Proposed", stages: ["proposed"] },
        ...TEAM.columns.slice(2),
      ],
    }));

    expect(reordered.kind === "refused" ? reordered.reason : "").toContain("must keep the stages' order");
    expect(skipping.kind === "refused" ? skipping.reason : "").toContain("must keep the stages' order");
  });

  it("refuses what is not a stage, a column without a title, and a file that is not JSON", () => {
    const unknown = parseBoardColumns(JSON.stringify({ columns: [{ title: "Doing", stages: ["doing"] }] }));
    const untitled = parseBoardColumns(JSON.stringify({ columns: [{ stages: ["drafted"] }] }));
    const broken = parseBoardColumns("{ columns: ");

    expect(unknown.kind === "refused" ? unknown.reason : "").toContain('names "doing", which is not a stage');
    expect(untitled.kind === "refused" ? untitled.reason : "").toBe('Column 1 has no "title".');
    expect(broken.kind === "refused" ? broken.reason : "").toContain("is not JSON");
  });

  it("says what a joined column holds, and a single stage's column by its title alone", () => {
    expect(describeBoardColumn({ title: "Backlog", stages: ["drafted", "proposed"] })).toBe("Backlog (Drafted, Proposed)");
    expect(describeBoardColumn({ title: "Planned", stages: ["planned"] })).toBe("Planned");
    expect(columnOfStage([{ title: "A", stages: ["drafted", "proposed"] }, { title: "B", stages: ["planned"] }]).get("proposed")).toBe(0);
  });
});

function ready(changeName: string): ChangeReadiness {
  return { changeName, run: { state: "ready" }, blockers: [], capabilities: [], canJoin: [], blockedFrom: [] } as unknown as ChangeReadiness;
}

describe("a board of a team's columns", () => {
  it("stands each card in the column its stage is in, headed by the team's titles", () => {
    const reading = parseBoardColumns(JSON.stringify(TEAM));
    const columns = reading.kind === "columns" ? reading.columns : [];
    const layout = layoutChangesByStage(
      { changes: [ready("new-idea"), ready("proposed-one"), ready("doing-it"), ready("landed-one")] },
      { stages: new Map([["new-idea", "drafted"], ["proposed-one", "proposed"], ["doing-it", "in-progress"], ["landed-one", "landed"]]), columns },
    );

    expect(layout.lanes).toEqual(["Backlog", "Ready", "Doing", "Review", "Done"]);
    expect(layout.columns).toEqual([["new-idea", "proposed-one"], [], ["doing-it"], [], ["landed-one"]]);
    // A joined column is drawn as its first stage is.
    expect(layout.laneLooks?.[0]?.token).toBe("stage-drafted");
    expect(layout.laneLooks?.[4]?.token).toBe("stage-landed");
  });
});

describe("readBoardColumns", () => {
  const roots: string[] = [];
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function workspace(board?: string): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-board-"));
    roots.push(root);
    await mkdir(path.join(root, "openspec"), { recursive: true });
    if (board !== undefined) await writeFile(path.join(root, "openspec", "board.json"), board, "utf8");
    return root;
  }

  it("reads none where the file is absent, and the columns or the refusal where it is not", async () => {
    expect(await readBoardColumns(await workspace())).toEqual({ kind: "none" });
    expect((await readBoardColumns(await workspace(JSON.stringify(TEAM)))).kind).toBe("columns");
    expect((await readBoardColumns(await workspace('{ "columns": [] }'))).kind).toBe("refused");
  });
});
