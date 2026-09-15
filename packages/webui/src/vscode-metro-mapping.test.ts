import { describe, expect, it } from "vitest";
import { metroCss } from "./metro-css.generated.js";
import { vscodeThemeCss } from "./shell-ui.js";

// the-web-ui-wears-metro 4.2: inside VS Code every colour Metro draws comes
// from the editor theme. A Metro variable left unset there falls back to
// Metro's own palette — a light grey button in a dark editor — which no
// picture of one theme would show.

/** Innermost rule blocks, as selector and body. `@layer` and `@media`
 * wrappers are skipped over, because their braces hold other braces. */
function innermostRules(css: string): Array<{ selector: string; body: string }> {
  return [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((match) => ({
    selector: (match[1] ?? "").trim(),
    body: match[2] ?? "",
  }));
}

function declaredIn(body: string): string[] {
  return [...body.matchAll(/(--[A-Za-z0-9-]+)\s*:/g)].map((match) => match[1] as string);
}

const PALETTE_SELECTORS = new Set([".openspec-metro", ".openspec-metro.dark-side"]);

describe("the VS Code layer over Metro", () => {
  it("sets every variable the derived Metro copy reads from its palette", () => {
    const rules = innermostRules(metroCss);
    const read = new Set([...metroCss.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/g)].map((match) => match[1] as string));
    const palette = new Set(rules.filter((rule) => PALETTE_SELECTORS.has(rule.selector)).flatMap((rule) => declaredIn(rule.body)));
    // A variable a component rule declares for itself, such as the
    // button's --control-height, is not the palette's to set.
    const local = new Set(rules.filter((rule) => !PALETTE_SELECTORS.has(rule.selector)).flatMap((rule) => declaredIn(rule.body)));
    const needed = [...read].filter((name) => palette.has(name) || !local.has(name));
    const set = new Set(declaredIn(vscodeThemeCss));

    expect(needed.length).toBeGreaterThan(40);
    expect(needed.filter((name) => !set.has(name)).sort()).toEqual([]);
  });

  it("writes no colour of its own for the editor", () => {
    expect(vscodeThemeCss.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(vscodeThemeCss.match(/\brgba?\(/g) ?? []).toEqual([]);
  });
});
