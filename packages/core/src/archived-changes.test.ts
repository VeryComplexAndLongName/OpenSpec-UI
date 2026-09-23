import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ARCHIVE_SHOWN_AT_MOST, ARCHIVE_SHOWN_FOR_DAYS, archivedRecently, describeOlderArchive, readArchivedNames } from "./archived-changes-facts.js";
import { readArchivedChanges } from "./archived-changes.js";

// the-board-remembers-what-was-archived: the date is in the directory's
// name, so nothing else is read.
//
// Four of these make a temporary directory and a handful of empty
// directories in it; the rest are pure. Measured on 2026-09-23 at 81ms for
// the whole file, the slowest test under 30ms. The budget is a second,
// which is room for a slow disk without hiding a hang.
vi.setConfig({ testTimeout: 1_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }).catch(() => undefined)));
});

async function workspaceWith(names: string[]): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "archive-"));
  roots.push(root);
  for (const name of names) await mkdir(path.join(root, "openspec", "changes", "archive", name), { recursive: true });
  return root;
}

describe("readArchivedNames", () => {
  it("reads the date out of each name, newest first", () => {
    expect(readArchivedNames(["2026-09-20-alpha", "2026-09-23-beta", "2026-09-22-gamma"])).toEqual([
      { changeName: "beta", archivedAs: "2026-09-23-beta", archivedOn: "2026-09-23" },
      { changeName: "gamma", archivedAs: "2026-09-22-gamma", archivedOn: "2026-09-22" },
      { changeName: "alpha", archivedAs: "2026-09-20-alpha", archivedOn: "2026-09-20" },
    ]);
  });

  // A name nobody here wrote is not dated by a guess.
  it("leaves out a name with no date", () => {
    expect(readArchivedNames(["not-ours", "2026-09-23-beta", "2026-9-1-short"]).map((one) => one.changeName)).toEqual(["beta"]);
  });

  it("keeps a change whose own name begins with digits", () => {
    expect(readArchivedNames(["2026-09-23-2026-plans"])).toEqual([
      { changeName: "2026-plans", archivedAs: "2026-09-23-2026-plans", archivedOn: "2026-09-23" },
    ]);
  });
});

describe("archivedRecently", () => {
  const all = readArchivedNames(["2026-09-23-today", "2026-09-17-a-week-ago", "2026-08-01-long-ago"]);

  it("draws the window and counts the rest", () => {
    const split = archivedRecently(all, new Date("2026-09-23T12:00:00Z"));

    expect(split.recent.map((one) => one.changeName)).toEqual(["today", "a-week-ago"]);
    expect(split.older).toBe(1);
  });

  // Seven days means today and the six before it, whatever the hour: a
  // day is all the directory's name carries.
  it("takes the whole first day of the window and nothing before it", () => {
    const edges = readArchivedNames(["2026-09-17-first-day", "2026-09-16-the-day-before"]);

    const split = archivedRecently(edges, new Date("2026-09-23T23:59:00Z"), { days: 7 });

    expect(split.recent.map((one) => one.changeName)).toEqual(["first-day"]);
    expect(split.older).toBe(1);
  });

  it("shows a week by default", () => {
    expect(ARCHIVE_SHOWN_FOR_DAYS).toBe(7);
  });

  // A week of this repository is 75 archived changes, and 75 cards in one
  // column is the wall the window was meant to prevent.
  it("draws no more than the cap, and counts everything it did not draw", () => {
    const many = readArchivedNames(Array.from({ length: 30 }, (_, index) => `2026-09-2${index % 4}-change-${index}`));

    const split = archivedRecently(many, new Date("2026-09-23T12:00:00Z"), { most: 4 });

    expect(split.recent).toHaveLength(4);
    expect(split.older).toBe(26);
    expect(ARCHIVE_SHOWN_AT_MOST).toBe(10);
  });
});

describe("readArchivedChanges", () => {
  it("reads the default branch where it can be read", async () => {
    const root = await workspaceWith(["2026-01-01-on-disk-only"]);
    const listTreeNames = vi.fn(async () => ["2026-09-23-from-the-branch"]);

    const reading = await readArchivedChanges(root, { git: { listTreeNames }, now: () => new Date("2026-09-23T10:00:00Z") });

    expect(listTreeNames).toHaveBeenCalledWith("origin/main", "openspec/changes/archive");
    expect(reading.from).toBe("default-branch");
    expect(reading.recent.map((one) => one.changeName)).toEqual(["from-the-branch"]);
  });

  // No remote, never fetched, a repository of one machine: this
  // directory's archive is better than none, and the reading says which.
  it("falls back to this working directory, and says so", async () => {
    const root = await workspaceWith(["2026-09-23-here", "2026-01-01-older"]);
    const listTreeNames = vi.fn(async () => { throw new Error("no such ref"); });

    const reading = await readArchivedChanges(root, { git: { listTreeNames }, now: () => new Date("2026-09-23T10:00:00Z") });

    expect(reading.from).toBe("working-directory");
    expect(reading.recent.map((one) => one.changeName)).toEqual(["here"]);
    expect(reading.older).toBe(1);
    expect(describeOlderArchive(reading)).toBe("1 more in the archive, as this working directory has it");
  });

  it("says nothing of an archive with nothing older", async () => {
    const root = await workspaceWith(["2026-09-23-here"]);

    const reading = await readArchivedChanges(root, { now: () => new Date("2026-09-23T10:00:00Z") });

    expect(describeOlderArchive(reading)).toBeUndefined();
  });

  it("answers an empty archive rather than failing", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "archive-"));
    roots.push(root);

    const reading = await readArchivedChanges(root);

    expect(reading).toMatchObject({ recent: [], older: 0, from: "working-directory" });
  });
});
