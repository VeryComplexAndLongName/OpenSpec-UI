import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkChangeGraph,
  findChangeGraphCycles,
  findUnmetBlockers,
  parseChangeRelations,
  readChangeGraph,
} from "./change-graph.js";

// change-graph-in-core:
// measured 2026-09-06 at 63ms idle for the slowest test, the one that
// reads this repository's own change directories. That is the repository
// floor rather than a figure derived from 63ms, and this file states a
// budget at all because the work grows with the repository: the gate
// reads every change there is, and there were 149 on the day it was
// written.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const BASE = "schema: spec-driven\ncreated: 2026-09-06\n";

async function repoWith(changes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-change-graph-"));
  roots.push(root);
  for (const [relative, metadata] of Object.entries(changes)) {
    const dir = path.join(root, "openspec", "changes", relative);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".openspec.yaml"), metadata, "utf8");
  }
  return root;
}

describe("parseChangeRelations", () => {
  it("reads all three documented shapes", () => {
    expect(parseChangeRelations(`${BASE}follows: one\n`).follows).toEqual(["one"]);
    expect(parseChangeRelations(`${BASE}follows: [one, two]\n`).follows).toEqual(["one", "two"]);
    expect(parseChangeRelations(`${BASE}follows:\n  - one\n  - two\n`).follows).toEqual(["one", "two"]);
  });

  it("keeps the three keys apart", () => {
    const parsed = parseChangeRelations(`${BASE}follows:\n  - a\nsupersedes:\n  - b\nblocked_by:\n  - c\n`);
    expect(parsed.follows).toEqual(["a"]);
    expect(parsed.supersedes).toEqual(["b"]);
    expect(parsed.blockedBy).toEqual(["c"]);
  });

  it("reports a key it cannot read rather than reading it as absent", () => {
    // A relation that parsed as "none stated" would be the worst outcome:
    // the gate would pass while the relation went unverified.
    expect(parseChangeRelations(`${BASE}follows:\n`).errors).toHaveLength(1);
    expect(parseChangeRelations(`${BASE}follows: [one, two\n`).errors).toHaveLength(1);
    expect(parseChangeRelations(`${BASE}follows: not a valid id\n`).errors).toHaveLength(1);
  });

  it("reports a relation key that does not start its own line", () => {
    // Several of these files end without a trailing newline, so appending
    // `follows:` yields `created: 2026-09-04follows:` — valid-looking and
    // silently ignored by every reader. The first attempt to prove the
    // gate bites failed on exactly this.
    const parsed = parseChangeRelations("created: 2026-09-04follows:\n  - x\n");
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0]).toContain("must start its own line");
    expect(parsed.follows).toEqual([]);
  });

  it("ignores a key mentioned in a comment", () => {
    expect(parseChangeRelations("# see follows: below\ncreated: x\n").errors).toEqual([]);
  });
});

describe("readChangeGraph", () => {
  it("resolves a relation to an active change", async () => {
    const root = await repoWith({ later: `${BASE}follows:\n  - earlier\n`, earlier: BASE });
    expect(checkChangeGraph(await readChangeGraph(root))).toEqual([]);
  });

  it("resolves a relation to an archived change, date prefix and all", async () => {
    // Most relations point at archived work, which is where their value
    // is. Archiving renames the directory; it must not break one.
    const root = await repoWith({
      later: `${BASE}supersedes:\n  - earlier\n`,
      "archive/2026-09-02-earlier": BASE,
    });
    expect(checkChangeGraph(await readChangeGraph(root))).toEqual([]);
  });

  it("prefers the active change when an id exists in both places", async () => {
    const root = await repoWith({ thing: BASE, "archive/2026-09-02-thing": BASE });
    const node = (await readChangeGraph(root)).get("thing");
    expect(node?.archived).toBe(false);
  });

  it("fails a relation to nothing, naming the change and the id", async () => {
    const root = await repoWith({ later: `${BASE}follows:\n  - never-created\n` });
    const violations = checkChangeGraph(await readChangeGraph(root));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.changeId).toBe("later");
    expect(violations[0]?.reason).toContain("never-created");
  });

  it("passes a change that states no relation", async () => {
    // The relation is optional. An absent one is not a defect, and a
    // check that demanded one would push authors into inventing them.
    const root = await repoWith({ solo: BASE, "archive/2026-09-01-old": BASE });
    expect(checkChangeGraph(await readChangeGraph(root))).toEqual([]);
  });
});

describe("cycles", () => {
  it("fails a cycle and names the changes in it", async () => {
    const root = await repoWith({ a: `${BASE}follows:\n  - b\n`, b: `${BASE}follows:\n  - a\n` });
    const violations = checkChangeGraph(await readChangeGraph(root));
    expect(violations).toHaveLength(1);
    expect(violations[0]?.reason).toContain("cycle: a -> b -> a");
  });

  it("treats two changes naming each other in different keys as a cycle", async () => {
    const root = await repoWith({ a: `${BASE}follows:\n  - b\n`, b: `${BASE}supersedes:\n  - a\n` });
    expect(checkChangeGraph(await readChangeGraph(root))[0]?.reason).toContain("cycle");
  });

  it("fails a cycle among blocking relations, because no order satisfies it", async () => {
    const root = await repoWith({ a: `${BASE}blocked_by:\n  - b\n`, b: `${BASE}blocked_by:\n  - a\n` });
    expect(findChangeGraphCycles(await readChangeGraph(root))).toHaveLength(1);
  });
});

describe("blocking relations", () => {
  it("reports an unmet blocker without failing", async () => {
    // It states a plan, and a plan not yet carried out is not a defect.
    const root = await repoWith({ waiting: `${BASE}blocked_by:\n  - base\n`, base: BASE });
    const nodes = await readChangeGraph(root);
    expect(checkChangeGraph(nodes)).toEqual([]);
    expect(findUnmetBlockers(nodes)).toEqual([{ changeId: "waiting", blockedBy: "base" }]);
  });

  it("resolves the blocker once it is archived", async () => {
    // Nothing needs editing: archiving is what lands a change.
    const root = await repoWith({
      waiting: `${BASE}blocked_by:\n  - base\n`,
      "archive/2026-09-06-base": BASE,
    });
    expect(findUnmetBlockers(await readChangeGraph(root))).toEqual([]);
  });

  it("fails a blocking relation that names nothing", async () => {
    const root = await repoWith({ waiting: `${BASE}blocked_by:\n  - never-created\n` });
    expect(checkChangeGraph(await readChangeGraph(root))).toHaveLength(1);
  });
});

describe("this repository's own changes", () => {
  // The gate. It replaces `npm run lint:change-graph`, and lives here so
  // that it needs no build — vitest runs TypeScript directly, while a
  // plain `node scripts/*.mjs` cannot import this module. Precedent:
  // `harness-config.test.ts` and `task-checklist.test.ts` already read
  // this repository's own openspec tree.
  it("states relations that all resolve, with no cycle", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(here, "..", "..", "..");
    await expect(stat(path.join(workspaceRoot, "openspec", "changes"))).resolves.toBeDefined();

    const nodes = await readChangeGraph(workspaceRoot);
    expect(nodes.size).toBeGreaterThan(100);
    expect(checkChangeGraph(nodes)).toEqual([]);
  });
});
