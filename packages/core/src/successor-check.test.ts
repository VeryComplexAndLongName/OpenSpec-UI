import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readChangeGraph } from "./change-graph.js";
import { checkNamedSuccessors, findNamedSuccessors } from "./successor-check.js";

// Cost-varying: every `checkNamedSuccessors` case writes a temporary
// directory, and the repository gate below reads every active and
// archived change. Measured 2026-09-06 on an idle machine: 579ms for the
// whole file, of which the repository gate is 402ms. Budgeted far above
// that, because the number that matters is the one a loaded machine
// reaches — a timeout sized to the idle measurement reports contention
// as a failure (LIMITS.md, "a budget is a ceiling, not a target").
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repoWith(changes: Record<string, { tasks?: string; metadata?: string }>): Promise<string> {
  const root = await mktempRoot();
  for (const [name, files] of Object.entries(changes)) {
    const dir = path.join(root, "openspec", "changes", name);
    await mkdir(dir, { recursive: true });
    if (files.tasks !== undefined) await writeFile(path.join(dir, "tasks.md"), files.tasks, "utf8");
    await writeFile(path.join(dir, ".openspec.yaml"), files.metadata ?? "schema: spec-driven\n", "utf8");
  }
  return root;
}

async function mktempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-successor-check-"));
  roots.push(root);
  return root;
}

describe("findNamedSuccessors", () => {
  it("matches the bare wording", () => {
    const found = findNamedSuccessors("a", "- [x] 4.3 Successor created: `the-successor`.");
    expect(found).toEqual([{ changeId: "a", successorId: "the-successor" }]);
  });

  it("matches the bold wording every-varying-check-has-a-budget actually used", () => {
    const found = findNamedSuccessors(
      "a",
      "Successor created: **`load-variance-not-per-file-cost`**, in `openspec/changes/`, not a note.",
    );
    expect(found).toEqual([{ changeId: "a", successorId: "load-variance-not-per-file-cost" }]);
  });

  it("finds nothing in ordinary prose", () => {
    expect(findNamedSuccessors("a", "- [x] 1.1 Add a test\n- [ ] 1.2 Fix the bug\n")).toEqual([]);
  });

  it("ignores a quoted example describing the wording, not declaring it", () => {
    // human-only-inbox's own tasks.md does exactly this, quoting
    // every-varying-check-has-a-budget's wording as an example of what to
    // search for — matching it would be the exact false accusation this
    // check exists to avoid.
    const text = 'Find the wording actually used: `x` wrote "Successor created: '
      + '**`load-variance-not-per-file-cost`**", and it is the phrasing to match first.';
    expect(findNamedSuccessors("human-only-inbox", text)).toEqual([]);
  });
});

describe("checkNamedSuccessors", () => {
  it("passes when the successor states it follows the naming change", async () => {
    const root = await repoWith({
      earlier: { tasks: "Successor created: `later`." },
      later: { metadata: "schema: spec-driven\nfollows:\n  - earlier\n" },
    });
    expect(await checkNamedSuccessors(root)).toEqual([]);
  });

  it("fails when no change states it follows the naming change", async () => {
    const root = await repoWith({
      earlier: { tasks: "Successor created: `later`." },
    });
    const violations = await checkNamedSuccessors(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.changeId).toBe("earlier");
    expect(violations[0]?.successorId).toBe("later");
    expect(violations[0]?.reason).toContain("earlier");
    expect(violations[0]?.reason).toContain("later");
    expect(violations[0]?.reason).toContain("follows");
  });

  it("fails even when the successor exists but does not state follows", async () => {
    // Naming a successor and creating a change of that id is not enough —
    // the relation itself must be stated, or the promise is unverified.
    const root = await repoWith({
      earlier: { tasks: "Successor created: `later`." },
      later: {},
    });
    const violations = await checkNamedSuccessors(root);
    expect(violations).toHaveLength(1);
  });

  it("fails when a different change follows the naming change but the named one was never created", async () => {
    // The requirement is "a named successor is a real one". A change that
    // promised `later` and produced `other` has still lost the residue
    // it named, so following the naming change is not on its own enough.
    const root = await repoWith({
      earlier: { tasks: "Successor created: `later`." },
      other: { metadata: "schema: spec-driven\nfollows:\n  - earlier\n" },
    });
    const violations = await checkNamedSuccessors(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.successorId).toBe("later");
  });

  it("passes a change with no successor named", async () => {
    const root = await repoWith({ solo: { tasks: "- [ ] 1.1 Just a task\n" } });
    expect(await checkNamedSuccessors(root)).toEqual([]);
  });
});

describe("this repository's own changes", () => {
  // The gate, in the shape `change-graph.test.ts` established: the check
  // runs against the real `openspec/` tree here rather than only over
  // fixtures, so a successor promised in prose and never created fails a
  // pull request instead of being noticed by whoever next reads the file.
  it("names no successor that no change follows", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(here, "..", "..", "..");
    await expect(stat(path.join(workspaceRoot, "openspec", "changes"))).resolves.toBeDefined();

    // Guards a clean result that is only clean because nothing was read.
    expect((await readChangeGraph(workspaceRoot)).size).toBeGreaterThan(100);
    expect(await checkNamedSuccessors(workspaceRoot)).toEqual([]);
  });
});
