import { describe, expect, it } from "vitest";
import { ICONS } from "./icons.js";
import { metroIconsCss } from "./metro-icons.generated.js";

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
