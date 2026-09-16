// @vitest-environment node
// The derived Metro UI copy the web UI ships (ADR 0030; the-web-ui-wears-metro
// 2.3). Written as a `.mjs` test beside the script it checks, so it can import
// the script without a type declaration.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as csstree from "css-tree";
import { describe, expect, it, vi } from "vitest";
import {
  KEPT_COMPONENTS,
  KEPT_ELEMENTS,
  LAYER,
  OUTPUT,
  ROOT_CLASS,
  SOURCE,
  deriveMetroCss,
  moduleText,
} from "./build-metro.mjs";

/** The published file's hash, as `vendor/metro/README.md` records it. */
const PUBLISHED_SHA256 = "50e237f90becdbae2f216e97d84c2d3e35ef2bde1bbd1b69d2b24ed9c762c1f1";

/** Each test reads Metro's 1.5 MB stylesheet or parses it or its derived
 * copy. Measured on 2026-09-15 on a developer machine: 311–331 ms for the
 * fresh derivation, and 407–655 ms for the whole file. 30 s leaves room for
 * a loaded CI runner. */
const PARSE_TIMEOUT_MS = 30_000;
vi.setConfig({ testTimeout: PARSE_TIMEOUT_MS });

function shippedCss() {
  const text = readFileSync(OUTPUT, "utf8");
  const match = text.match(/export const metroCss = (".*");/s);
  if (!match) throw new Error(`${OUTPUT} holds no metroCss export`);
  return JSON.parse(match[1]);
}

/** Every selector of every rule, at any depth, keyframe steps aside. */
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

function namesOf(selector) {
  const classes = [];
  const elements = [];
  csstree.walk(selector, {
    enter(node) {
      if (node.type === "ClassSelector") classes.push(node.name);
      if (node.type === "TypeSelector") elements.push(node.name.toLowerCase());
    },
  });
  return { classes, elements };
}

describe("the vendored Metro UI source", () => {
  it("is the published 5.1.20 file, byte for byte", () => {
    const hash = createHash("sha256").update(readFileSync(SOURCE)).digest("hex");
    expect(hash).toBe(PUBLISHED_SHA256);
  });
});

describe("the derived Metro UI copy", () => {
  it("is what the build script produces from the vendored source", () => {
    // A vendored file or a kept list changed without running
    // `npm run build:metro` fails here, not in a picture.
    const { css } = deriveMetroCss(readFileSync(SOURCE, "utf8"));
    expect(readFileSync(OUTPUT, "utf8")).toBe(moduleText(css));
  }, PARSE_TIMEOUT_MS);

  it("sits in one cascade layer, beneath the shell's own rules", () => {
    const top = csstree.parse(shippedCss()).children.toArray();
    expect(top.map((node) => `${node.type} ${node.name ?? ""} ${node.prelude ? csstree.generate(node.prelude) : ""}`.trim()))
      .toEqual([`Atrule layer ${LAYER}`]);
  }, PARSE_TIMEOUT_MS);

  it("scopes every selector under the web UI's root", () => {
    const unscoped = selectorsOf(shippedCss())
      .map((selector) => csstree.generate(selector))
      .filter((selector) => !selector.startsWith(`.${ROOT_CLASS}`));
    expect(unscoped).toEqual([]);
  }, PARSE_TIMEOUT_MS);

  it("carries no rule but a kept component's or a native control's", () => {
    // The root and the root in its dark palette are the only selectors that
    // may name neither. Anything else on a bare element, such as `img`, `a`
    // or a heading, would restyle the shell's own content.
    const isKeptClass = (name) => KEPT_COMPONENTS.some((component) => name === component || name.startsWith(`${component}-`));
    const stray = selectorsOf(shippedCss())
      .filter((selector) => {
        const { classes, elements } = namesOf(selector);
        return !classes.some(isKeptClass) && !elements.some((name) => KEPT_ELEMENTS.includes(name));
      })
      .map((selector) => csstree.generate(selector))
      .filter((selector) => selector !== `.${ROOT_CLASS}` && selector !== `.${ROOT_CLASS}.dark-side`);
    expect(stray).toEqual([]);
  }, PARSE_TIMEOUT_MS);

  it("names no html or body, and no * except inside a kept component", () => {
    const isKeptClass = (name) => KEPT_COMPONENTS.some((component) => name === component || name.startsWith(`${component}-`));
    const globals = selectorsOf(shippedCss())
      .filter((selector) => {
        const { classes, elements } = namesOf(selector);
        if (elements.includes("html") || elements.includes("body")) return true;
        return elements.includes("*") && !classes.some(isKeptClass);
      })
      .map((selector) => csstree.generate(selector));
    expect(globals).toEqual([]);
  }, PARSE_TIMEOUT_MS);

  it("marks nothing !important, so the layer alone decides precedence", () => {
    // Inside a layer an `!important` declaration beats every unlayered one:
    // Metro's literal hover colours would override the VS Code theme mapping.
    expect(shippedCss()).not.toMatch(/!\s*important/i);
  });

  it("fetches nothing from another origin", () => {
    const css = shippedCss();
    expect(css).not.toMatch(/url\(\s*["']?(https?:)?\/\//i);
    expect(css).not.toMatch(/@import/i);
  });

  it("stays under the stated byte ceiling", () => {
    // the-web-ui-wears-more-metro design.md's measured table: KEPT_COMPONENTS
    // with panel, card, badge and timeline added derives 120,388 bytes. A
    // family added later moves this number, and the failure message says by
    // how much, so growth is read in review rather than discovered later.
    const CEILING_BYTES = 120_388;
    const bytes = Buffer.byteLength(shippedCss(), "utf8");
    expect(bytes, `derived Metro copy is ${bytes} bytes, ceiling is ${CEILING_BYTES}`).toBeLessThanOrEqual(CEILING_BYTES);
  });
});
