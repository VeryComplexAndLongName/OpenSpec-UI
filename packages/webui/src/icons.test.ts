import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ICONS } from "./icons.js";
import { metroIconsCss } from "./metro-icons.generated.js";

/** The entry check reads every `*-entry.tsx` from disk, so its duration
 * follows the machine's. Measured on 2026-09-16 on a developer machine:
 * 29 ms for the whole file, reading five entries. The ceiling leaves room
 * for a slow CI disk without hiding a hang. */
const READ_TIMEOUT_MS = 10_000;
vi.setConfig({ testTimeout: READ_TIMEOUT_MS });

/** Every glyph name the generated stylesheet carries a `::before` rule for. */
function glyphsInGeneratedCss(css: string): string[] {
  return [...css.matchAll(/\.openspec-icon-([a-z0-9-]+)::before\{/g)].map((match) => match[1] as string);
}

describe("the meaning-to-glyph map", () => {
  it("names no glyph the generated font does not carry", () => {
    // A meaning naming a glyph outside the subset would draw nothing: the
    // font-face has no such codepoint.
    const generated = new Set(glyphsInGeneratedCss(metroIconsCss));
    const missing = Object.values(ICONS).filter((glyph) => !generated.has(glyph));

    expect(missing).toEqual([]);
  });

  it("carries no glyph in the generated font that nothing names", () => {
    // The subset is built from the same list ICONS is checked against, so a
    // glyph kept for no meaning would sit in the bundle unused.
    const named: Set<string> = new Set(Object.values(ICONS));
    const unnamed = glyphsInGeneratedCss(metroIconsCss).filter((glyph) => !named.has(glyph));

    expect(unnamed).toEqual([]);
  });
});

describe("every entry that draws Metro", () => {
  it("also carries the icon stylesheet", () => {
    // The icon classes are Metro-shaped but live in their own generated
    // module. An entry that embeds metroCss without metroIconsCss renders
    // every Icon as an empty, zero-width span, and nothing else fails: the
    // markup, the names and the axe run are all still right. That is how
    // the standalone shell shipped with no visible icons.
    const src = path.dirname(fileURLToPath(import.meta.url));
    const entries = readdirSync(src).filter((name) => name.endsWith("-entry.tsx"));
    const withoutIcons = entries.filter((name) => {
      const text = readFileSync(path.join(src, name), "utf8");
      return text.includes("${metroCss}") || text.includes("[metroCss,")
        ? !text.includes("metroIconsCss}") && !text.includes("metroIconsCss,")
        : false;
    });

    expect(entries.length).toBeGreaterThan(0);
    expect(withoutIcons).toEqual([]);
  });
});
