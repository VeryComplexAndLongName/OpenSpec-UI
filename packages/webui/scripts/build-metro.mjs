// Derives the Metro UI copy the web UI ships from the vendored, pinned
// source (ADR 0030; the-web-ui-wears-metro design decision 2).
//
// Metro's own stylesheet restyles `*`, `html`, `body` and every bare
// element, and defines its colours as more than a thousand variables. This
// keeps only what the web UI's controls use:
//
// - rules whose selector names a class of a kept component, or one of the
//   native controls Metro styles without metro.js (`button`, `input`,
//   `select`, `textarea`, `table`), each selector scoped under
//   `.openspec-metro`;
// - from Metro's `:root` and `.dark-side` blocks, only the variables those
//   rules read, followed through the variables they read in turn;
// - the `@keyframes` the kept rules name.
//
// Every other rule on a bare element, `@font-face` and `@import` is dropped.
// The copy is wrapped in `@layer metro`, so the shell's own unlayered rules
// win wherever both set a property: Metro draws a control, the shell keeps
// its layout and widths.
//
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

/** The cascade layer the copy sits in, beneath the shell's own rules. */
export const LAYER = "metro";

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

/** The native elements Metro styles with no class and no metro.js. Its
 * `.input`, `.select` and `.textarea` classes are for the wrappers metro.js
 * builds (`display:flex; padding:0`), so a native field takes Metro's look
 * from these rules instead. */
export const KEPT_ELEMENTS = ["button", "input", "select", "textarea", "table"];

function isKeptClass(name) {
  return KEPT_COMPONENTS.some((component) => name === component || name.startsWith(`${component}-`));
}

/** The modifier classes a kept component may carry in the web UI: a colour
 * that says what an action or a state is, a size, and the states a control
 * passes through. A selector naming any other class belongs to something
 * else — a colour picker, a spinner, a tag input, a sortable column — that
 * happens to contain a button or an input, and is not carried. Measured on
 * 5.1.20, the broad rule kept 1661 rules and 221 KB. */
export const KEPT_MODIFIERS = [
  "primary",
  "alert",
  "success",
  "warning",
  "info",
  "small",
  "disabled",
  "active",
  "focused",
  "invalid",
  "valid",
  "selected",
  "checked",
  "striped",
  "compact",
];

/** The class names and element names a selector names, anywhere in it. */
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

/**
 * A selector is kept when it names a kept component's class or a kept native
 * element, and every class it names is a kept component's or a kept modifier.
 *
 * - **Beside a kept class,** any element is allowed: `.table td`,
 *   `.button-group>*`. It reaches only that component's own children.
 * - **Without a kept class,** every element must be a kept native control, so
 *   `input[type=text]` stays and `label:has(input)` goes.
 * - **`html` and `body`** are never kept.
 */
function isKeptSelector(selector) {
  const { classes, elements } = namesOf(selector);
  if (elements.includes("html") || elements.includes("body")) return false;
  if (!classes.every((name) => isKeptClass(name) || KEPT_MODIFIERS.includes(name))) return false;
  if (classes.some(isKeptClass)) return true;
  return elements.length > 0 && elements.every((name) => KEPT_ELEMENTS.includes(name));
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
  let droppedImportant = 0;

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

      const kept = selectors.filter(isKeptSelector);
      if (kept.length === 0) {
        if (selectors.every((selector) => namesOf(selector).classes.length === 0)) droppedBare += 1;
        return;
      }
      // An `!important` inside a layer beats every unlayered rule, which
      // would let Metro's literal hover colours (`.button.primary:hover`)
      // override the VS Code theme mapping and the shell's own rules. The
      // layer decides precedence instead.
      csstree.walk(node.block, {
        visit: "Declaration",
        enter(declaration) {
          if (declaration.important) {
            declaration.important = false;
            droppedImportant += 1;
          }
        },
      });
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

  const css = `@layer ${LAYER}{\n${out.join("\n")}\n}`;
  return {
    css,
    figures: {
      rules: keptRules.length,
      lightVariables: light.length,
      darkVariables: dark.length,
      keyframes: [...neededAnimations].filter((name) => keyframes.has(name)).length,
      droppedBareRules: droppedBare,
      droppedImportant,
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
