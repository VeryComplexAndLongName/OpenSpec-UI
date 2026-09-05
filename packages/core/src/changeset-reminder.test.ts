import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkChangesetReminder } from "./changeset-reminder.js";

// every-varying-check-has-a-budget:
// measured 2026-09-05 for this file alone at 0.0s idle and 0.4s
// under deliberate 8-worker CPU co-load, for its slowest single test.
vi.setConfig({ testTimeout: 15_000 });

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-changeset-reminder-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("checkChangesetReminder", () => {
  it("reports not adopted when there is no .changeset directory at all", async () => {
    const root = await temporaryRoot();

    expect(await checkChangesetReminder(root)).toEqual({
      changesetsAdopted: false,
      pendingChangesetCount: 0,
    });
  });

  it("reports not adopted when .changeset exists but has no config.json", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".changeset"));
    await writeFile(path.join(root, ".changeset", "README.md"), "# Changesets\n");

    expect(await checkChangesetReminder(root)).toEqual({
      changesetsAdopted: false,
      pendingChangesetCount: 0,
    });
  });

  it("reports adopted with zero pending changesets when only config.json and README.md exist", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".changeset"));
    await writeFile(path.join(root, ".changeset", "config.json"), "{}");
    await writeFile(path.join(root, ".changeset", "README.md"), "# Changesets\n");

    expect(await checkChangesetReminder(root)).toEqual({
      changesetsAdopted: true,
      pendingChangesetCount: 0,
    });
  });

  it("counts pending changeset markdown files, excluding README.md", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".changeset"));
    await writeFile(path.join(root, ".changeset", "config.json"), "{}");
    await writeFile(path.join(root, ".changeset", "README.md"), "# Changesets\n");
    await writeFile(path.join(root, ".changeset", "fuzzy-cats-jump.md"), "---\n---\nSome change.\n");
    await writeFile(path.join(root, ".changeset", "brave-lions-run.md"), "---\n---\nAnother change.\n");

    expect(await checkChangesetReminder(root)).toEqual({
      changesetsAdopted: true,
      pendingChangesetCount: 2,
    });
  });
});
