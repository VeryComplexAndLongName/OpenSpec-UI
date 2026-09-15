import { describe, expect, it } from "vitest";
import { shellThemeCss, vscodeThemeCss } from "./shell-ui.js";

/** The `:root` block of a theme layer, and the token names it declares. */
function rootTokens(css: string): string[] {
    const start = css.indexOf(":root");
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    const block = css.slice(open + 1, close);
    return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string);
}

/** The standalone dark palette's selector (the-web-ui-wears-metro 4.1). */
const DARK_PALETTE = ':root[data-openspec-theme="dark"]';

/** The dark palette block, and the token names it declares. */
function darkTokens(css: string): string[] {
    const start = css.indexOf(DARK_PALETTE);
    if (start < 0) return [];
    const open = css.indexOf("{", start);
    const block = css.slice(open + 1, css.indexOf("}", open));
    return [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1] as string);
}

/** Everything after the `:root` block — the rules themselves. The dark
 * palette is a palette too, so it is cut out as well. */
function rulesAfterRoot(css: string): string {
    const open = css.indexOf("{", css.indexOf(":root"));
    const rules = css.slice(css.indexOf("}", open) + 1);
    const dark = rules.indexOf(DARK_PALETTE);
    if (dark < 0) return rules;
    return rules.slice(0, dark) + rules.slice(rules.indexOf("}", dark) + 1);
}

describe("shell themes", () => {
    it("is a whole stylesheet, not a fragment ending at a stray backtick", () => {
        // This one is not paranoia. A backtick inside the template
        // literal — in a COMMENT, describing a CSS selector — ended the
        // string early, and what followed happened to parse as valid
        // JavaScript (`"a" * `b``), so the build succeeded and
        // `shellThemeCss` became three characters. Every screen rendered
        // in Times New Roman on a transparent ground, and nothing failed.
        //
        // The length and the last rule are what a truncation cannot fake.
        expect(shellThemeCss.length).toBeGreaterThan(10_000);
        expect(shellThemeCss).toContain("@media (max-width: 720px)");
        expect(vscodeThemeCss.length).toBeGreaterThan(1_000);
    });

    it("keeps VS Code variables in an extension-only override layer", () => {
        expect(shellThemeCss).not.toContain("--vscode-editor-background");
        expect(vscodeThemeCss).toContain("--vscode-editor-background");
        expect(vscodeThemeCss).toContain("--vscode-editor-foreground");
        expect(vscodeThemeCss).toContain("--vscode-input-background");
        expect(vscodeThemeCss).toContain("--vscode-focusBorder");
        expect(vscodeThemeCss).toContain("color-scheme: light dark");
    });

    it("defines every shell token in the extension layer too", () => {
        // A token declared in one layer and missing from the other
        // renders that host's surface with no value at all — see ADR
        // 0023 decision 4. Nothing checked this before, and the two
        // layers were kept in step by hand.
        const missing = rootTokens(shellThemeCss).filter(
            (token) => !rootTokens(vscodeThemeCss).includes(token),
        );

        expect(missing).toEqual([]);
    });

    it("draws no colour literal outside the palette", () => {
        // ADR 0023 decision 3. A literal written into a rule is why a
        // palette change comes out patchy in the places nobody
        // re-checks: a diff tint, an event row's ground, a disabled
        // control. 21 of them, in 29 places, were lifted into tokens;
        // this is what keeps that true.
        const literals = rulesAfterRoot(shellThemeCss).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];

        expect(literals).toEqual([]);
    });

    it("gives the dark palette every colour token of the light one, and no other", () => {
        // A colour token left out of the dark palette keeps its light
        // value on a dark ground: a white panel in a dark shell.
        const start = shellThemeCss.indexOf(":root");
        const open = shellThemeCss.indexOf("{", start);
        const light = shellThemeCss.slice(open + 1, shellThemeCss.indexOf("}", open));
        const lightColours = [...light.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\()/g)]
            .map((match) => match[1] as string);
        const dark = darkTokens(shellThemeCss);

        expect(lightColours.filter((token) => !dark.includes(token))).toEqual([]);
        expect(dark.filter((token) => !rootTokens(shellThemeCss).includes(token))).toEqual([]);
    });

    it("gives a control a width for the kind of value it holds", () => {
        // Fault 3 of the three reported: every control filled its
        // container, so a dropdown holding "high" was the width of the
        // page and its indicator was at the far right of it.
        for (const token of ["--w-amount", "--w-name", "--w-sentence"]) {
            expect(rootTokens(shellThemeCss)).toContain(token);
        }
    });

    it("lets a select size itself, so no option is ever clipped", () => {
        // The first attempt gave selects a fixed width and clipped the
        // autonomy level to "assisted — one stage at a time, a cl". A
        // select already knows how wide its widest option is; the token
        // is only its floor, so a column of short ones stays tidy.
        // `min()` and not a bare floor: the preferred width has to give
        // way where the space is smaller than it, or a column of tidy
        // selects makes the page scroll sideways at phone width.
        expect(shellThemeCss).toContain("min-width: min(var(--w-name)");
        // Not a bare `width` on the same token — that is the fixed
        // width that clipped it. `min-width` contains the substring,
        // so the check has to exclude the prefixed forms.
        expect(shellThemeCss).not.toMatch(/(?<![a-z-])width: var\(--w-name\)/);
    });

    it("ends a settings section with a rule and more space than separates its fields", () => {
        // a-change-is-configured-from-the-change. "Save Global config" sat
        // directly above the heading of the next section, with nothing
        // between them, so the save read as belonging to both.
        const open = shellThemeCss.indexOf(".openspec-harness-section {");
        expect(open).toBeGreaterThan(-1);
        const rule = shellThemeCss.slice(open, shellThemeCss.indexOf("}", open));
        expect(rule).toContain("border-bottom: 1px solid var(--line)");
        const spacing = Number(/margin-bottom: (\d+)px/.exec(rule)?.[1]);
        const fieldGap = Number(/\.openspec-harness-settings \.openspec-harness-stage-row \{\s*margin-top: (\d+)px/.exec(shellThemeCss)?.[1]);
        expect(fieldGap).toBeGreaterThan(0);
        expect(spacing).toBeGreaterThan(fieldGap);
    });
});
