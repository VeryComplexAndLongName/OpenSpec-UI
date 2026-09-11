import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runDeclaredChecks } from "./declared-checks.js";

// every-varying-check-has-a-budget: the checks selected here are pure
// filesystem reads — no npm script is spawned — so this is a few writes
// and a directory walk. Measured 2026-09-11 under 120ms.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-declared-checks-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function makeChange(root: string, changeName: string, tasks: string): Promise<string> {
  const changeDir = path.join(root, "openspec", "changes", changeName);
  await mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, "proposal.md"), "# A change\n\n## Why\n\nBecause.\n", "utf8");
  await writeFile(path.join(changeDir, "tasks.md"), tasks, "utf8");
  return path.join(changeDir, "tasks.md");
}

async function adoptChangesets(root: string, pending: boolean): Promise<void> {
  await mkdir(path.join(root, ".changeset"), { recursive: true });
  await writeFile(path.join(root, ".changeset", "config.json"), "{}\n", "utf8");
  if (pending) await writeFile(path.join(root, ".changeset", "a-change.md"), "---\n---\n\nA change.\n", "utf8");
}

describe("runDeclaredChecks", () => {
  it("runs the checks a change declares and reports what each found", async () => {
    const root = await temporaryRoot();
    await adoptChangesets(root, true);
    await makeChange(root, "a-change", "- [ ] 1.1 A changeset exists. `check(changeset-present)`\n");

    const outcome = await runDeclaredChecks(root, "a-change");

    expect(outcome.ranAny).toBe(true);
    expect(outcome.failed).toHaveLength(0);
    expect(outcome.passed[0]).toMatchObject({
      lineNumber: 0,
      check: { name: "changeset-present" },
      result: { pass: true },
    });
  });

  it("separates what failed from what passed, and says why", async () => {
    const root = await temporaryRoot();
    await adoptChangesets(root, false);
    await makeChange(root, "a-change", "- [ ] 1.1 A changeset exists. `check(changeset-present)`\n");

    const outcome = await runDeclaredChecks(root, "a-change");

    expect(outcome.passed).toHaveLength(0);
    expect(outcome.failed[0]?.result.reason).toContain("no pending");
  });

  it("writes nothing back to tasks.md", async () => {
    // The checkbox is the `verify` stage's to write: it records what a
    // check found during a run. Asking the same question outside a run —
    // which is all `openspec-ui-cli check` does — must not tick anything.
    const root = await temporaryRoot();
    await adoptChangesets(root, true);
    const source = "- [ ] 1.1 A changeset exists. `check(changeset-present)`\n";
    const tasksPath = await makeChange(root, "a-change", source);

    await runDeclaredChecks(root, "a-change");

    expect(await readFile(tasksPath, "utf8")).toBe(source);
  });

  it("says a change declares none rather than reporting an empty pass", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", "- [ ] 1.1 Do the thing\n");

    const outcome = await runDeclaredChecks(root, "a-change");

    // `ranAny: false` is distinct from "everything passed" on purpose:
    // a caller reporting to a person has to be able to tell them which
    // of the two happened.
    expect(outcome).toEqual({ ranAny: false, passed: [], failed: [] });
  });

  it("refuses a check name the registry does not have", async () => {
    const root = await temporaryRoot();
    await makeChange(root, "a-change", "- [ ] 1.1 Typecheck it. `check(typcheck)`\n");

    // A misspelled check must never read as a check that passed.
    await expect(runDeclaredChecks(root, "a-change")).rejects.toThrow(/typcheck/);
  });
});
