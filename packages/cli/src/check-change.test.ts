import { describe, expect, it } from "vitest";
import type { DeclaredCheckRunOutcome } from "@openspec-ui/core";
import { checkChange } from "./check-change.js";

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

function entry(name: string, line: number, pass: boolean, reason: string) {
  return { text: `${line}.1 Something`, lineNumber: line, check: { name, param: undefined }, result: { pass, reason } };
}

const NONE: DeclaredCheckRunOutcome = { ranAny: false, passed: [], failed: [] };

describe("checkChange", () => {
  it("reports each declared check and exits 0 when they pass", async () => {
    const io = collectingIo();
    const outcome = {
      ranAny: true,
      passed: [entry("lint", 9, true, "npm run lint: exit 0"), entry("test", 10, true, "npm run test: exit 0")],
      failed: [],
    } as unknown as DeclaredCheckRunOutcome;

    const code = await checkChange(
      { workspaceRoot: "/w", changeName: "a-change", format: "text" },
      { ...io, runChecks: () => Promise.resolve(outcome) },
    );

    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("OK    lint — npm run lint: exit 0");
    expect(io.out.join("\n")).toContain("All 2 declared check(s) passed.");
  });

  it("exits 1 on a failure but still reports every check", async () => {
    const io = collectingIo();
    const outcome = {
      ranAny: true,
      passed: [entry("lint", 9, true, "npm run lint: exit 0")],
      failed: [entry("test", 10, false, "npm run test: exit 1, 3 failing")],
    } as unknown as DeclaredCheckRunOutcome;

    const code = await checkChange(
      { workspaceRoot: "/w", changeName: "a-change", format: "text" },
      { ...io, runChecks: () => Promise.resolve(outcome) },
    );

    expect(code).toBe(1);
    const printed = io.out.join("\n");
    // The passing one is still named: a report that shows only failures
    // cannot be read as "what was checked".
    expect(printed).toContain("OK    lint");
    expect(printed).toContain("FAIL  test — npm run test: exit 1, 3 failing");
    expect(printed).toContain("1 of 2 declared check(s) failed.");
  });

  it("says a change declares none, and exits 0", async () => {
    const io = collectingIo();

    const code = await checkChange(
      { workspaceRoot: "/w", changeName: "a-change", format: "text" },
      { ...io, runChecks: () => Promise.resolve(NONE) },
    );

    // Most changes in this repository's history declared no checks.
    // Calling that a failure would be a false statement about them.
    expect(code).toBe(0);
    expect(io.out.join("\n")).toContain("declares no mechanical checks");
  });

  it("exits 2 when the checks could not be run at all", async () => {
    const io = collectingIo();

    const code = await checkChange(
      { workspaceRoot: "/w", changeName: "a-change", format: "text" },
      { ...io, runChecks: () => Promise.reject(new Error('Unknown mechanical check "typcheck"')) },
    );

    // A malformed declaration is "the check itself could not run", not
    // "the change failed its checks" — the reader acts differently on
    // each, which is what the 1/2 split is for.
    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain('Unknown mechanical check "typcheck"');
  });

  it("reports the same run as one JSON document for a machine", async () => {
    const io = collectingIo();
    const outcome = {
      ranAny: true,
      passed: [],
      failed: [entry("lint", 9, false, "npm run lint: exit 1")],
    } as unknown as DeclaredCheckRunOutcome;

    const code = await checkChange(
      { workspaceRoot: "/w", changeName: "a-change", format: "json" },
      { ...io, runChecks: () => Promise.resolve(outcome) },
    );

    expect(code).toBe(1);
    expect(JSON.parse(io.out[0] as string)).toEqual({
      ok: false,
      declared: true,
      results: [{ check: "lint", task: "9.1 Something", line: 9, pass: false, reason: "npm run lint: exit 1" }],
    });
  });
});
