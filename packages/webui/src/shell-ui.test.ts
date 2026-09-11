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

/** Everything after the `:root` block — the rules themselves. */
function rulesAfterRoot(css: string): string {
    const open = css.indexOf("{", css.indexOf(":root"));
    return css.slice(css.indexOf("}", open) + 1);
}

describe("shell themes", () => {
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
        expect(shellThemeCss).toContain("min-width: var(--w-name)");
        // Not a bare `width` on the same token — that is the fixed
        // width that clipped it. `min-width` contains the substring,
        // so the check has to exclude the prefixed forms.
        expect(shellThemeCss).not.toMatch(/(?<![a-z-])width: var\(--w-name\)/);
    });
});
