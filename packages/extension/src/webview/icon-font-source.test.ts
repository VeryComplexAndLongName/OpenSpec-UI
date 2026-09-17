import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { ICON_FONT_SOURCE } from "./icon-font-source.js";

// suite-survives-a-loaded-machine: this file reads the panels' sources from
// disk, so its cost varies with the machine. Measured 2026-09-17 at 15ms for
// both tests together. Sized well above that, since the work timed is a few
// synchronous reads of small files.
vi.setConfig({ testTimeout: 10000 });

// an-editor-panel-draws-its-icons. Every panel that runs a bundle draws the
// shell's icons, which are a `data:` font inside the stylesheet; a policy
// that does not name `font-src data:` refuses them. Read from the panels'
// own sources, so the next panel written without it fails here rather than
// in someone's editor.

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Every policy a panel source builds for a page that runs a script bundle. */
function bundlePolicies(): Array<{ file: string; policy: string }> {
  const found: Array<{ file: string; policy: string }> = [];
  for (const file of readdirSync(HERE).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
    const text = readFileSync(path.join(HERE, file), "utf8");
    for (const match of text.matchAll(/const csp = `([^`]*)`;/gu)) {
      if (match[1]!.includes("script-src")) found.push({ file, policy: match[1]! });
    }
  }
  return found;
}

describe("an editor panel's policy lets its icons draw", () => {
  it("allows data: fonts and nothing else as a font source", () => {
    expect(ICON_FONT_SOURCE).toBe("font-src data:;");
  });

  it("names the icon font source in every panel that runs a bundle", () => {
    const policies = bundlePolicies();
    expect(policies.map((entry) => entry.file).sort()).toEqual([
      "ai-panel.ts",
      "harness-settings-panel.ts",
      "pipeline-panel.ts",
      "timeline-panel.ts",
    ]);
    for (const { file, policy } of policies) {
      expect(policy, file).toContain("${ICON_FONT_SOURCE}");
      expect(policy, file).not.toMatch(/font-src(?! data:;)/u);
    }
  });
});
