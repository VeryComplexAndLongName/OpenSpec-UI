// @vitest-environment node
// The derived Metro UI copy the web UI ships (ADR 0030; the-web-ui-wears-metro
// 2.3). Written as a `.mjs` test beside the script it checks, so it can import
// the script without a type declaration.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as csstree from "css-tree";
import { describe, expect, it } from "vitest";
import { OUTPUT, ROOT_CLASS, SOURCE, deriveMetroCss, moduleText } from "./build-metro.mjs";

/** The published file's hash, as `vendor/metro/README.md` records it. */
const PUBLISHED_SHA256 = "50e237f90becdbae2f216e97d84c2d3e35ef2bde1bbd1b69d2b24ed9c762c1f1";

/** Parsing Metro's 1.5 MB stylesheet takes a second or two on a loaded
 * runner, and each test here parses it or its derived copy. */
const PARSE_TIMEOUT_MS = 30_000;

function shippedCss() {
  const text = readFileSync(OUTPUT, "utf8");
  const match = text.match(/export const metroCss = (".*");/s);
  if (!match) throw new Error(`${OUTPUT} holds no metroCss export`);
  return JSON.parse(match[1]);
}

/** Every selector of every rule, keyframe steps aside. */
function selectorsOf(css) {
  const selectors = [];
  csstree.walk(csstree.parse(css), {
    visit: "Rule",
    enter(rule) {
      if (rule.prelude.type !== "SelectorList") return;
      rule.prelude.children.forEach((selector) => selectors.push(selector));
    },
  });
  return selectors;
}

describe("the vendored Metro UI source", () => {
  it("is the published 5.1.20 file, byte for byte", () => {
    const hash = createHash("sha256").update(readFileSync(SOURCE)).digest("hex");
    expect(hash).toBe(PUBLISHED_SHA256);
  });
});

describe("the derived Metro UI copy", () => {
  it("is what the build script produces from the vendored source", () => {
    // A vendored file or a kept-component list changed without running
    // `npm run build:metro` fails here, not in a picture.
    const { css } = deriveMetroCss(readFileSync(SOURCE, "utf8"));
    expect(readFileSync(OUTPUT, "utf8")).toBe(moduleText(css));
  }, PARSE_TIMEOUT_MS);

  it("scopes every selector under the web UI's root", () => {
    const unscoped = selectorsOf(shippedCss())
      .map((selector) => csstree.generate(selector))
      .filter((selector) => !selector.startsWith(`.${ROOT_CLASS}`));
    expect(unscoped).toEqual([]);
  }, PARSE_TIMEOUT_MS);

  it("carries no rule on a bare element, *, html or body", () => {
    // The root and the root in its dark palette are the only selectors that
    // may name no class of Metro's own.
    const bare = selectorsOf(shippedCss())
      .filter((selector) => {
        const names = [];
        csstree.walk(selector, {
          visit: "ClassSelector",
          enter(node) {
            names.push(node.name);
          },
        });
        return names.every((name) => name === ROOT_CLASS || name === "dark-side");
      })
      .map((selector) => csstree.generate(selector))
      .filter((selector) => selector !== `.${ROOT_CLASS}` && selector !== `.${ROOT_CLASS}.dark-side`);
    expect(bare).toEqual([]);

    // A `*` inside a kept selector, as in `.button-group>*`, reaches only
    // that component's children; a selector whose only class is the root was
    // caught above. `html` and `body` may not appear at all.
    const globals = selectorsOf(shippedCss())
      .filter((selector) => {
        let names = false;
        csstree.walk(selector, {
          visit: "TypeSelector",
          enter(node) {
            if (["html", "body"].includes(node.name.toLowerCase())) names = true;
          },
        });
        return names;
      })
      .map((selector) => csstree.generate(selector));
    expect(globals).toEqual([]);
  }, PARSE_TIMEOUT_MS);

  it("fetches nothing from another origin", () => {
    const css = shippedCss();
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//i);
    expect(css).not.toMatch(/@import/i);
  });
});
