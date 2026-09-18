import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyRelationEdit, editChangeRelation } from "./change-relations-file.js";

// a-relation-is-set-where-it-is-read: measured 2026-09-18 at 135ms for
// the whole file, with no test over 20ms. Each writes a few small files
// in a temporary directory and reads them back, so the cost follows the
// filesystem under load rather than this repository's size - hence a
// ceiling well above the measurement rather than one derived from it.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const BASE = "schema: spec-driven\ncreated: 2026-09-18\n";

async function repoWith(changes: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-relation-edit-"));
  roots.push(root);
  for (const [relative, metadata] of Object.entries(changes)) {
    const dir = path.join(root, "openspec", "changes", relative);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, ".openspec.yaml"), metadata, "utf8");
  }
  return root;
}

async function metadataOf(root: string, relative: string): Promise<string> {
  return readFile(path.join(root, "openspec", "changes", relative, ".openspec.yaml"), "utf8");
}

describe("applyRelationEdit", () => {
  it("appends a key the file does not state, as a scalar for one change", () => {
    expect(applyRelationEdit(BASE, "follows", ["first"])).toBe(`${BASE}follows: first\n`);
  });

  it("writes a block sequence for more than one change", () => {
    expect(applyRelationEdit(BASE, "blocked_by", ["first", "second"]))
      .toBe(`${BASE}blocked_by:\n  - first\n  - second\n`);
  });

  it("adds to an existing block sequence, keeping its indent", () => {
    const source = `${BASE}follows:\n    - first\n`;
    expect(applyRelationEdit(source, "follows", ["first", "second"]))
      .toBe(`${BASE}follows:\n    - first\n    - second\n`);
  });

  it("keeps a flow sequence a flow sequence", () => {
    const source = `${BASE}follows: [first, second]\n`;
    expect(applyRelationEdit(source, "follows", ["first"])).toBe(`${BASE}follows: [first]\n`);
  });

  it("removes the key where the last id goes, rather than leaving it stating nothing", () => {
    // `parseChangeRelations` reports a key with no value as an error, so
    // an empty key is not a neutral thing to leave behind.
    const source = `${BASE}follows:\n  - only\n`;
    expect(applyRelationEdit(source, "follows", [])).toBe(BASE);
  });

  it("passes every other line through, comments and other keys included", () => {
    const source = [
      "# what this change is for",
      "schema: spec-driven",
      "created: 2026-09-18",
      "# the relation below was stated by hand",
      "follows: old",
      "owner: DW",
      "",
    ].join("\n");

    expect(applyRelationEdit(source, "follows", ["old", "newer"])).toBe([
      "# what this change is for",
      "schema: spec-driven",
      "created: 2026-09-18",
      "# the relation below was stated by hand",
      "follows:",
      "  - old",
      "  - newer",
      "owner: DW",
      "",
    ].join("\n"));
  });

  it("keeps a CRLF file CRLF", () => {
    const source = `schema: spec-driven\r\ncreated: 2026-09-18\r\n`;
    expect(applyRelationEdit(source, "follows", ["first"]))
      .toBe(`schema: spec-driven\r\ncreated: 2026-09-18\r\nfollows: first\r\n`);
  });
});

describe("editChangeRelation", () => {
  it("states the relation, and says what the key holds now", async () => {
    const root = await repoWith({ first: BASE, second: BASE });

    const result = await editChangeRelation(root, { change: "second", key: "blocked_by", add: "first" });

    expect(result.ok).toBe(true);
    expect(result.ok && result.ids).toEqual(["first"]);
    expect(result.ok && result.written).toBe(true);
    expect(await metadataOf(root, "second")).toBe(`${BASE}blocked_by: first\n`);
  });

  it("takes one back, and writes nothing where the file already said it", async () => {
    const root = await repoWith({ first: BASE, second: `${BASE}blocked_by: first\n` });

    const removed = await editChangeRelation(root, { change: "second", key: "blocked_by", remove: "first" });
    expect(removed.ok && removed.ids).toEqual([]);
    expect(await metadataOf(root, "second")).toBe(BASE);

    const again = await editChangeRelation(root, { change: "second", key: "blocked_by", remove: "first" });
    expect(again.ok && again.written).toBe(false);
  });

  it("relates a live change to archived work", async () => {
    // Most relations point at archived changes: that is where their value
    // is, and archiving is not deletion.
    const root = await repoWith({ live: BASE, "archive/2026-08-08-old": BASE });

    const result = await editChangeRelation(root, { change: "live", key: "follows", add: "old" });

    expect(result.ok).toBe(true);
    expect(await metadataOf(root, "live")).toBe(`${BASE}follows: old\n`);
  });

  it("refuses an id no change has, and writes nothing", async () => {
    const root = await repoWith({ first: BASE });

    const result = await editChangeRelation(root, { change: "first", key: "follows", add: "absent" });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe("unknown-change");
    expect(!result.ok && result.ids).toEqual(["absent"]);
    expect(await metadataOf(root, "first")).toBe(BASE);
  });

  it("refuses a change naming itself", async () => {
    const root = await repoWith({ first: BASE });

    const result = await editChangeRelation(root, { change: "first", key: "follows", add: "first" });

    expect(!result.ok && result.reason).toBe("self-relation");
    expect(await metadataOf(root, "first")).toBe(BASE);
  });

  it("refuses an edit that closes a cycle, naming the changes in it", async () => {
    const root = await repoWith({ first: `${BASE}follows: second\n`, second: BASE });

    const result = await editChangeRelation(root, { change: "second", key: "blocked_by", add: "first" });

    expect(!result.ok && result.reason).toBe("cycle");
    expect(!result.ok && result.ids).toContain("first");
    expect(!result.ok && result.ids).toContain("second");
    expect(await metadataOf(root, "second")).toBe(BASE);
  });

  it("leaves a cycle that was already there alone, rather than blaming this edit for it", async () => {
    const root = await repoWith({
      left: `${BASE}follows: right\n`,
      right: `${BASE}follows: left\n`,
      third: BASE,
    });

    const result = await editChangeRelation(root, { change: "third", key: "follows", add: "left" });

    expect(result.ok).toBe(true);
  });

  it("refuses to edit an archived change", async () => {
    const root = await repoWith({ live: BASE, "archive/2026-08-08-old": BASE });

    const result = await editChangeRelation(root, { change: "old", key: "follows", add: "live" });

    expect(!result.ok && result.reason).toBe("archived-change");
    expect(await metadataOf(root, "archive/2026-08-08-old")).toBe(BASE);
  });

  it("refuses where the metadata cannot be read as relations", async () => {
    // A key that does not start its own line, which is what appending to a
    // file with no trailing newline produces.
    const root = await repoWith({ first: "schema: spec-driven\ncreated: 2026-09-18follows: second\n", second: BASE });

    const result = await editChangeRelation(root, { change: "first", key: "follows", add: "second" });

    expect(!result.ok && result.reason).toBe("unreadable-metadata");
  });

  it("refuses a change the workspace does not have", async () => {
    const root = await repoWith({ first: BASE });

    const result = await editChangeRelation(root, { change: "absent", key: "follows", add: "first" });

    expect(!result.ok && result.reason).toBe("unknown-change");
  });
});
