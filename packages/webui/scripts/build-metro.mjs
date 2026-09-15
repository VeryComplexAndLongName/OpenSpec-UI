#!/usr/bin/env node
// Derives the Metro UI copy the web UI ships from the vendored, pinned
// source (ADR 0030; the-web-ui-wears-metro design decision 2).
//
// Metro's own stylesheet restyles `*`, `html`, `body` and every bare
// element, and defines its colours as more than a thousand variables. This
// keeps only what the web UI's controls use:
//
// - rules whose selector names a class of a kept component, each selector
//   scoped under `.openspec-metro`;
// - from Metro's `:root` and `.dark-side` blocks, only the variables those
//   rules read, followed through the variables they read in turn;
// - the `@keyframes` the kept rules name.
//
// Every rule on a bare element, `@font-face` and `@import` is dropped.
// The result is written as a TypeScript module, committed, and checked
// against a fresh run by a test, so a forgotten rebuild fails there.
//
// Run: npm run build:metro -w @openspec-ui/webui

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as csstree from "css-tree";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE = path.resolve(here, "../vendor/metro/metro.css");
export const OUTPUT = path.resolve(here, "../src/metro-css.generated.ts");

/** The root every kept selector is placed under. */
export const ROOT_CLASS = "openspec-metro";

/** The Metro components the web UI's controls use. A class belongs to a
 * component when it is the component's name or starts with it and a dash
 * (`button`, `button-group`). Adding a control of a new kind starts here. */
export const KEPT_COMPONENTS = [
  "button",
  "input",
  "select",
  "textarea",
  "checkbox",
  "table",
  "tabs",
  "dialog",
  "progress",
  "badge",
  "panel",
  "card",
];

function isKeptClass(name) {
  return KEPT_COMPONENTS.some((component) => name === component || name.startsWith(`${component}-`));
}

/** Every class name a selector names, anywhere in it. */
function classesOf(selector) {
  const names = [];
  csstree.walk(selector, {
    visit: "ClassSelector",
    enter(node) {
      names.push(node.name);
    },
  });
  return names;
}

/** `:root` alone, or `.dark-side` alone, as Metro writes its variable blocks. */
function variableBlockKind(selector) {
  const parts = selector.children.toArray();
  if (parts.length !== 1) return undefined;
  const [only] = parts;
  if (only.type === "PseudoClassSelector" && only.name === "root") return "root";
  if (only.type === "ClassSelector" && only.name === "dark-side") return "dark";
  return undefined;
}

/** A selector placed under the root class. `:root` becomes the root itself,
 * and a selector starting with `.dark-side` keeps it on the root. */
function scoped(selectorText) {
  if (selectorText === ":root") return `.${ROOT_CLASS}`;
  if (selectorText === ".dark-side") return `.${ROOT_CLASS}.dark-side`;
  if (selectorText.startsWith(".dark-side ")) return `.${ROOT_CLASS}.dark-side ${selectorText.slice(".dark-side ".length)}`;
  return `.${ROOT_CLASS} ${selectorText}`;
}

/** The custom properties a node reads through `var()`. */
function variablesReadBy(node) {
  const names = new Set();
  csstree.walk(node, {
    visit: "Function",
    enter(fn) {
      if (fn.name !== "var") return;
      const first = fn.children.first;
      if (first && first.type === "Identifier" && first.name.startsWith("--")) names.add(first.name);
    },
  });
  return names;
}

/** The animation names a node's declarations name. */
function animationsNamedBy(node) {
  const names = new Set();
  csstree.walk(node, {
    visit: "Declaration",
    enter(declaration) {
      if (declaration.property !== "animation" && declaration.property !== "animation-name") return;
      csstree.walk(declaration.value, {
        visit: "Identifier",
        enter(identifier) {
          names.add(identifier.name);
        },
      });
    },
  });
  return names;
}

/**
 * Derives the shipped CSS from Metro's stylesheet text.
 * Returns the CSS and figures a test and the change's record can state.
 */
export function deriveMetroCss(sourceText) {
  const ast = csstree.parse(sourceText, { parseValue: true, parseCustomProperty: true });

  /** Kept rules, in source order, with the at-rule context they sit in. */
  const keptRules = [];
  /** Declarations of variables, by name, for the light and dark blocks. */
  const lightVariables = new Map();
  const darkVariables = new Map();
  /** `@keyframes` blocks by name. */
  const keyframes = new Map();
  let droppedBare = 0;

  function collect(list, media) {
    list.forEach((node) => {
      if (node.type === "Atrule") {
        const name = node.name.toLowerCase();
        if (name === "keyframes" || name.endsWith("-keyframes")) {
          keyframes.set(csstree.generate(node.prelude).trim(), node);
          return;
        }
        if (name === "media" && node.block) {
          collect(node.block.children, csstree.generate(node.prelude));
        }
        // @font-face, @import, @supports and the rest are not carried.
        return;
      }
      if (node.type !== "Rule" || node.prelude.type !== "SelectorList") return;

      const selectors = node.prelude.children.toArray();
      const kinds = selectors.map(variableBlockKind);
      if (media === undefined && kinds.length > 0 && kinds.every((kind) => kind !== undefined)) {
        node.block.children.forEach((declaration) => {
          if (declaration.type !== "Declaration" || !declaration.property.startsWith("--")) return;
          for (const kind of kinds) (kind === "root" ? lightVariables : darkVariables).set(declaration.property, declaration);
        });
        return;
      }

      const kept = selectors.filter((selector) => classesOf(selector).some(isKeptClass));
      if (kept.length === 0) {
        if (selectors.every((selector) => classesOf(selector).length === 0)) droppedBare += 1;
        return;
      }
      keptRules.push({ selectors: kept.map((selector) => scoped(csstree.generate(selector))), block: node.block, media });
    });
  }
  collect(ast.children, undefined);

  // Follow the variables the kept rules read, through the variables those
  // variables read, in either palette.
  const needed = new Set();
  const pending = [];
  for (const rule of keptRules) for (const name of variablesReadBy(rule.block)) pending.push(name);
  while (pending.length > 0) {
    const name = pending.pop();
    if (needed.has(name)) continue;
    needed.add(name);
    for (const table of [lightVariables, darkVariables]) {
      const declaration = table.get(name);
      if (declaration) for (const next of variablesReadBy(declaration.value)) pending.push(next);
    }
  }

  const neededAnimations = new Set();
  for (const rule of keptRules) for (const name of animationsNamedBy(rule.block)) neededAnimations.add(name);

  const out = [];
  const light = [...needed].filter((name) => lightVariables.has(name)).sort();
  const dark = [...needed].filter((name) => darkVariables.has(name)).sort();
  if (light.length > 0) out.push(`.${ROOT_CLASS}{${light.map((name) => csstree.generate(lightVariables.get(name))).join(";")}}`);
  if (dark.length > 0) out.push(`.${ROOT_CLASS}.dark-side{${dark.map((name) => csstree.generate(darkVariables.get(name))).join(";")}}`);

  let currentMedia;
  let mediaBody = [];
  const flush = () => {
    if (currentMedia !== undefined && mediaBody.length > 0) out.push(`@media ${currentMedia}{${mediaBody.join("")}}`);
    mediaBody = [];
  };
  for (const rule of keptRules) {
    const text = `${rule.selectors.join(",")}${csstree.generate(rule.block)}`;
    if (rule.media !== currentMedia) {
      flush();
      currentMedia = rule.media;
    }
    if (currentMedia === undefined) out.push(text);
    else mediaBody.push(text);
  }
  flush();

  for (const name of [...neededAnimations].sort()) {
    const block = keyframes.get(name);
    if (block) out.push(csstree.generate(block));
  }

  const css = out.join("\n");
  return {
    css,
    figures: {
      rules: keptRules.length,
      lightVariables: light.length,
      darkVariables: dark.length,
      keyframes: [...neededAnimations].filter((name) => keyframes.has(name)).length,
      droppedBareRules: droppedBare,
      bytes: Buffer.byteLength(css, "utf8"),
    },
  };
}

/** The module text written to `OUTPUT`. */
export function moduleText(css) {
  return [
    "// GENERATED by packages/webui/scripts/build-metro.mjs from",
    "// packages/webui/vendor/metro/metro.css (Metro UI 5.1.20). Do not edit:",
    "// run `npm run build:metro -w @openspec-ui/webui`. See ADR 0030.",
    "",
    `export const metroCss = ${JSON.stringify(css)};`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = await readFile(SOURCE, "utf8");
  const { css, figures } = deriveMetroCss(source);
  await writeFile(OUTPUT, moduleText(css), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT)}: ${JSON.stringify(figures)}`);
}
