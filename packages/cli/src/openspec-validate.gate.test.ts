import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runValidateAll } from "./openspec-validate.js";

// every-varying-check-has-a-budget: each change is validated by spawning
// the real `openspec` CLI, one process per change, whose time varies
// with the machine and its load. The rule under test is the open-item
// one; the structural validation around it is what costs the seconds.
vi.setConfig({ testTimeout: 60_000 });

// a-change-lands-with-nothing-open 2. The rule applies to the change a
// pull request is for, and to no other.

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function workspace(changes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-gate-"));
  roots.push(root);
  for (const [name, tasks] of Object.entries(changes)) {
    const directory = path.join(root, "openspec", "changes", name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "proposal.md"), `## Why\n\nBecause.\n`, "utf8");
    await writeFile(path.join(directory, "tasks.md"), tasks, "utf8");
  }
  return root;
}

const CLOSED = "- [x] 1.1 Something done.\n";
const OPEN = "- [x] 1.1 Something done.\n- [ ] 1.2 Something not.\n";
const UNRECORDED = "- [x] 1.1 **Human-only.** Whether it reads.\n";
const RECORDED = "- [x] 1.1 **Human-only.** Whether it reads.\n  Looked on 2026-09-20: it reads.\n";

const forChange = (result: Awaited<ReturnType<typeof runValidateAll>>, id: string) =>
  result.results.find((one) => one.id === id);

describe("the open-item rule", () => {
  it("refuses the named change for an open item, and names it", async () => {
    const root = await workspace({ "the-change": OPEN });

    const result = await runValidateAll(root, { change: "the-change" });

    const named = forChange(result, "the-change");
    expect(named?.valid).toBe(false);
    expect(named?.openItems?.join(" ")).toContain("1.2 Something not.");
    expect(result.ok).toBe(false);
  });

  it("refuses a human-only item closed with nothing written under it", async () => {
    const root = await workspace({ "the-change": UNRECORDED });

    const result = await runValidateAll(root, { change: "the-change" });

    expect(forChange(result, "the-change")?.unrecordedItems?.join(" ")).toContain("Whether it reads");
  });

  it("accepts one that carries its record", async () => {
    const root = await workspace({ "the-change": RECORDED });

    const result = await runValidateAll(root, { change: "the-change" });

    expect(forChange(result, "the-change")?.unrecordedItems).toBeUndefined();
    expect(forChange(result, "the-change")?.openItems).toBeUndefined();
  });

  it("never fails one change for another change's open item", async () => {
    const root = await workspace({ "the-change": CLOSED, "somebody-elses": OPEN });

    const result = await runValidateAll(root, { change: "the-change" });

    expect(forChange(result, "the-change")?.openItems).toBeUndefined();
    expect(forChange(result, "somebody-elses")?.openItems).toBeUndefined();
  });

  it("applies no rule where the name is no active change", async () => {
    const root = await workspace({ "the-change": OPEN });

    const result = await runValidateAll(root, { change: "the-change-archive" });

    expect(forChange(result, "the-change")?.openItems).toBeUndefined();
  });

  it("applies no rule where no change was named at all", async () => {
    const root = await workspace({ "the-change": OPEN });

    const result = await runValidateAll(root);

    expect(forChange(result, "the-change")?.openItems).toBeUndefined();
  });
});
