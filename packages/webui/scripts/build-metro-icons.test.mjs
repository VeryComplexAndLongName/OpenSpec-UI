// @vitest-environment node
// The icon stylesheet the web UI ships (ADR 0032; the-web-ui-wears-more-metro
// 2.2 and 2.5). Written as a `.mjs` test beside the script it checks, so it
// can import the script without a type declaration.

import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  KEPT_GLYPHS,
  OUTPUT,
  deriveMetroIconsCss,
  moduleText,
  readVendoredSubset,
} from "./build-metro-icons.mjs";

/** Each test reads the vendored subset and the generated module from disk,
 * so its duration follows the machine's. Measured on 2026-09-16 on a
 * developer machine: 21 ms for all four, against a 2,388-byte subset and a
 * 4,818-byte module. Ten seconds leaves room for a loaded CI runner — a
 * third of `build-metro.test.mjs`'s ceiling, since nothing here parses
 * Metro's 1.5 MB stylesheet or subsets a font. */
const READ_TIMEOUT_MS = 10_000;
vi.setConfig({ testTimeout: READ_TIMEOUT_MS });

async function shippedCss() {
  const text = await readFile(OUTPUT, "utf8");
  const match = text.match(/export const metroIconsCss = (".*");/s);
  if (!match) throw new Error(`${OUTPUT} holds no metroIconsCss export`);
  return JSON.parse(match[1]);
}

describe("the shipped icon stylesheet", () => {
  it("is what the build script produces from the vendored subset", async () => {
    // A vendored file or the kept-glyph list changed without running
    // `npm run build:metro-icons` fails here, not in a picture.
    //
    // Compared with line endings made alike: git on Windows checks the
    // generated module out with CRLF, the script writes LF, and the two
    // are the same file. Without this the check failed on every Windows
    // checkout and was read past as "the known one"
    // (the-icon-stylesheet-check-ignores-line-endings).
    const { subsetBuffer, codepoints } = await readVendoredSubset();
    const { css } = deriveMetroIconsCss(subsetBuffer, codepoints);
    const CR = String.fromCharCode(13);
    expect((await readFile(OUTPUT, "utf8")).split(CR).join("")).toBe(moduleText(css));
  });

  it("inlines the subset as a data: URI rather than fetching it", async () => {
    const css = await shippedCss();
    const match = css.match(/@font-face\{[^}]*src:url\(([^)]*)\)/);
    expect(match).not.toBeNull();
    expect(match[1]).toMatch(/^data:font\/woff;base64,/);
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//i);
  });

  it("refuses a name the vendored subset does not carry", async () => {
    const { subsetBuffer, codepoints } = await readVendoredSubset();
    const withoutOne = { ...codepoints };
    delete withoutOne[KEPT_GLYPHS[0]];

    expect(() => deriveMetroIconsCss(subsetBuffer, withoutOne)).toThrow(KEPT_GLYPHS[0]);
  });

  it("refuses a glyph in the subset that nothing names", async () => {
    const { subsetBuffer, codepoints } = await readVendoredSubset();

    expect(() => deriveMetroIconsCss(subsetBuffer, { ...codepoints, "not-named": "e000" })).toThrow("not-named");
  });
});
