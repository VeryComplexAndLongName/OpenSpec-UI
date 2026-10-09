import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readActionTitle } from "@openspec-ui/core/browser";
import { describe, expect, it, vi } from "vitest";

// every-control-is-a-verb-and-a-noun (ADR 0045): a control outside a dialog
// is a verb and a noun from the product's lists, with three dots where it
// asks first. Read from the source, as the extension's manifest test reads
// its manifest: what a person reads on a button is written there.
// Reads every component once; measured 2026-10-09 at 0.2 s.
vi.setConfig({ testTimeout: 10_000 });

const SOURCE = path.dirname(fileURLToPath(import.meta.url));

/** What is not an action, or is one inside a dialog whose title already
 * names its object: the verb alone, as every system dialog does. */
const NOT_A_PAIR = new Set([
  // Inside a dialog or a prompt that names what it is about.
  "Answer", "Allow", "Deny", "Cancel", "Close", "Archive", "Delete", "Rollback",
  // Switches and choices, not actions.
  "By step", "By stage", "One change", "Compare changes", "Sprint report",
  "All", "None", "Archived in the range, and under way", "agent-harness.json", "All archived changes",
  // Words inside a row or a control that are not its label.
  "Zoom", "no dates",
]);

/** A word a button says while it works, or once it has: "Saving...",
 * "Refreshing…", "Answered". */
function saysAState(text: string): boolean {
  return /(ing|ed)(\.\.\.|…)?$/u.test(text);
}

function sources(): Array<{ file: string; text: string }> {
  return readdirSync(SOURCE, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test."))
    .map((entry) => {
      const file = path.join(entry.parentPath, entry.name);
      return { file: path.relative(SOURCE, file), text: readFileSync(file, "utf8") };
    });
}

/** The words a button's body writes, literally: its text, and the strings
 * it chooses between. A label built from a value is left to its own test. */
function buttonWords(body: string): string[] {
  let depth = 0;
  let end = -1;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === ">" && depth === 0) { end = index; break; }
  }
  const inner = end === -1 ? "" : body.slice(end + 1);
  const words: string[] = [];
  // Text between tags, a string written as a child, and the two strings a
  // child chooses between - never an attribute's value.
  const patterns = [/>([^<>{}]+)</gu, /\{\s*"([^"]+)"\s*\}/gu, /\?\s*"([^"]+)"\s*:\s*"([^"]+)"/gu];
  for (const pattern of patterns) {
    for (const match of inner.matchAll(pattern)) {
      for (const group of match.slice(1)) {
        const text = (group ?? "").replace(/\s+/gu, " ").trim();
        // Words, not punctuation, arrows or a check box drawn in text.
        if (/[A-Za-z]{2}/u.test(text)) words.push(text);
      }
    }
  }
  // Text after the last tag inside the button, up to its end.
  const tail = /([^<>{}]+)$/u.exec(inner)?.[1]?.replace(/\s+/gu, " ").trim();
  if (tail !== undefined && /[A-Za-z]{2}/u.test(tail)) words.push(tail);
  return words;
}

function labels(): Array<{ file: string; text: string }> {
  const found: Array<{ file: string; text: string }> = [];
  for (const { file, text } of sources()) {
    for (const match of text.matchAll(/<button\b([\s\S]*?)<\/button>/gu)) {
      const body = match[1] ?? "";
      // A switch says what it switches to, not an action: one that is
      // pressed or a tab.
      if (/aria-pressed=|role="tab"/u.test(body.slice(0, body.indexOf(">") + 1 || body.length))) continue;
      for (const words of buttonWords(body)) found.push({ file, text: words });
    }
    for (const match of text.matchAll(/\b(?:saveLabel|applyLabel)\s*=\s*"([^"]+)"/gu)) found.push({ file, text: match[1] ?? "" });
    const targets = /OPEN_TARGET_WORDS[^=]*=\s*\{([\s\S]*?)\};/u.exec(text)?.[1];
    for (const match of (targets ?? "").matchAll(/:\s*"([^"]+)"/gu)) found.push({ file, text: match[1] ?? "" });
  }
  return found;
}

describe("every control is a verb and a noun", () => {
  it("names every button outside a dialog with a verb and a noun from the lists", () => {
    const outside = labels().filter(({ text }) => !NOT_A_PAIR.has(text) && !saysAState(text) && readActionTitle(text) === undefined);

    expect(outside.map(({ file, text }) => `${file}: ${text}`)).toEqual([]);
  });

  it("asks first on every button with a Danger verb", () => {
    const unasked = labels().filter(({ text }) => {
      const read = readActionTitle(text);
      return read !== undefined && read.verb.group === "danger" && !read.asksFirst;
    });

    expect(unasked.map(({ file, text }) => `${file}: ${text}`)).toEqual([]);
  });

  it("reads the labels it is meant to", () => {
    const texts = labels().map(({ text }) => text);
    // A scan that found nothing would pass anything.
    for (const expected of ["Run Change...", "Show Tasks", "Answer Questions...", "Stop Run...", "Save Settings", "Open Proposal", "Delete Leftover..."]) {
      expect(texts).toContain(expected);
    }
  });
});
