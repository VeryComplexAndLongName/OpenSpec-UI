import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { actionCommandId, readActionTitle } from "@openspec-ui/core";
import { describe, expect, it, vi } from "vitest";

// every-action-is-a-verb-and-a-noun (ADR 0045). Asserted over the manifest,
// as one-way-in.test.ts is: what a person reads is the manifest's titles.
// One synchronous read; sized above it as that file explains.
vi.setConfig({ testTimeout: 10000 });

const manifest = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
) as { contributes: { commands: Array<{ command: string; title: string; category?: string; icon?: string }> } };

describe("every command is a verb and a noun", () => {
  it("titles every command with a verb and a noun from the lists", () => {
    const outside = manifest.contributes.commands.filter((entry) => readActionTitle(entry.title) === undefined);

    expect(outside.map((entry) => `${entry.command}: ${entry.title}`)).toEqual([]);
  });

  it("gives every command the id its pair names, and the product's category", () => {
    const wrong = manifest.contributes.commands.filter((entry) => {
      const read = readActionTitle(entry.title);
      return read === undefined || entry.command !== actionCommandId(read.verb.verb, read.noun) || entry.category !== "OpenSpec Workbench";
    });

    expect(wrong.map((entry) => entry.command)).toEqual([]);
  });

  // The owner, on 2026-10-09: the Changes view's title bar showed the same
  // picture twice and three times, and a picture that two actions share
  // tells neither apart. Some codicons are two names for one glyph.
  it("gives every command its own picture: no icon, nor a second name of its glyph, is shared", () => {
    const sameGlyph: Record<string, string> = { pencil: "edit", trashcan: "trash", plus: "add", "gist-new": "add", "repo-create": "add", "file-add": "new-file", "settings": "gear" };
    const glyphs = manifest.contributes.commands.map((entry) => {
      const name = /^\$\(([a-z-]+)\)$/.exec(entry.icon ?? "")?.[1];
      return name === undefined ? undefined : (sameGlyph[name] ?? name);
    });

    expect(manifest.contributes.commands.filter((_, index) => glyphs[index] === undefined).map((entry) => entry.command)).toEqual([]);
    expect(manifest.contributes.commands.filter((_, index) => glyphs.indexOf(glyphs[index]) !== index).map((entry) => entry.command)).toEqual([]);
  });

  it("names each action once: no two commands share a title", () => {
    const titles = manifest.contributes.commands.map((entry) => entry.title);

    expect(titles.filter((title, index) => titles.indexOf(title) !== index)).toEqual([]);
  });
});
