// One workspace, read the two ways a person reads it: the word a listing
// gives a change, and the edges the picture of the declared order draws.
//
// They disagreed in the product until 2026-09-18, and nothing compared
// them: DW saw `application-lifecycle-completion` marked ready in the
// Changes view while the Change Graph showed it blocked by
// `apply-plan-stays-pending`, which was still active. The graph and the
// readiness reading were right; the listings asked for a word without the
// readiness fact, and every unfinished change fell through to Ready.
//
// This reads both from one fixture, so a listing that stops accounting for
// the declared order fails here rather than in a screenshot.

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readChangeGraph } from "./change-graph.js";
import { readChangeReadiness } from "./change-readiness.js";
import { describeChangeState } from "./change-state-word.js";
import type { ChangeStanding } from "./change-standing-facts.js";

// Cost-varying: each case writes a workspace and reads it twice, with no
// git and no network. Budgeted well above the measured cost, because a
// ceiling sized to an idle run reports a busy machine as a failure
// (LIMITS.md).
vi.setConfig({ testTimeout: 30_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-listing-graph-"));
  roots.push(root);
  await mkdir(path.join(root, "openspec", "changes"), { recursive: true });
  await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n", "utf8");
  return root;
}

async function change(root: string, name: string, options: { blockedBy?: string[]; done?: boolean } = {}): Promise<void> {
  const directory = path.join(root, "openspec", "changes", name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "proposal.md"), `## Why\n\n${name}.\n`, "utf8");
  await writeFile(path.join(directory, "tasks.md"), `- [${options.done ? "x" : " "}] 1.1 Do it\n`, "utf8");
  const blocked = (options.blockedBy ?? []).map((blocker) => `  - ${blocker}`).join("\n");
  await writeFile(
    path.join(directory, ".openspec.yaml"),
    `schema: spec-driven\ncreated: 2026-09-18\n${blocked ? `blocked_by:\n${blocked}\n` : ""}`,
    "utf8",
  );
}

/** A standing as a listing holds it: this checkout alone, with its counts. */
function standingOf(changeName: string, done: number, total: number): ChangeStanding {
  return {
    changeName,
    here: { label: "repo", path: "/repo", counts: { done, total }, runs: [] },
    elsewhere: [],
    main: { kind: "absent" },
  };
}

/** The word a listing gives, from the same two readings a host makes. */
async function wordFor(root: string, changeName: string, counts: { done: number; total: number }): Promise<string> {
  const readiness = await readChangeReadiness({ workspaceRoot: root });
  const read = readiness.changes.find((candidate) => candidate.changeName === changeName);
  return describeChangeState({
    standing: standingOf(changeName, counts.done, counts.total),
    ...(read ? { readiness: read.run.state, blockers: read.blockers } : {}),
  }).word;
}

describe("a listing and the picture of the declared order", () => {
  it("both say a change is blocked while its blocker is active", async () => {
    const root = await workspace();
    await change(root, "apply-plan-stays-pending");
    await change(root, "application-lifecycle-completion", { blockedBy: ["apply-plan-stays-pending"] });

    const graph = await readChangeGraph(root);

    expect(graph.get("application-lifecycle-completion")?.blockedBy).toEqual(["apply-plan-stays-pending"]);
    expect(await wordFor(root, "application-lifecycle-completion", { done: 0, total: 1 }))
      .toBe("Blocked by apply-plan-stays-pending");
  });

  it("both stop saying so once the blocker is archived", async () => {
    const root = await workspace();
    await mkdir(path.join(root, "openspec", "changes", "archive"), { recursive: true });
    const archived = path.join(root, "openspec", "changes", "archive", "2026-09-17-apply-plan-stays-pending");
    await mkdir(archived, { recursive: true });
    await writeFile(path.join(archived, "proposal.md"), "## Why\n\nDone.\n", "utf8");
    await change(root, "application-lifecycle-completion", { blockedBy: ["apply-plan-stays-pending"] });

    // The graph still draws the relation the change declares; what changes
    // is that nothing unmet is left, which is what a listing reports.
    const unmet = (await readChangeReadiness({ workspaceRoot: root })).changes
      .find((candidate) => candidate.changeName === "application-lifecycle-completion");

    expect(unmet?.blockers).toEqual([]);
    expect(await wordFor(root, "application-lifecycle-completion", { done: 0, total: 1 })).toBe("Ready");
  });

  it("says both where a blocked change has every task ticked", async () => {
    const root = await workspace();
    await change(root, "apply-plan-stays-pending");
    await change(root, "application-lifecycle-completion", { blockedBy: ["apply-plan-stays-pending"], done: true });

    const readiness = await readChangeReadiness({ workspaceRoot: root });
    const read = readiness.changes.find((candidate) => candidate.changeName === "application-lifecycle-completion");
    const described = describeChangeState({
      standing: standingOf("application-lifecycle-completion", 1, 1),
      ...(read ? { readiness: read.run.state, blockers: read.blockers } : {}),
    });

    expect(described.word).toBe("Done");
    expect(described.lines.map((line) => line.text)).toContain("Blocked by apply-plan-stays-pending");
  });
});
