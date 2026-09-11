// Running the mechanical checks a change declares, and nothing else —
// ADR 0020 decision 1.
//
// This is the answer to "let the CLI run lint and tests" that does not
// create a second spelling of `npm run lint`. The names come from the
// change's own `tasks.md`, resolved against the closed registry core owns
// (ADR 0019); this file selects nothing and adds nothing. No agent is
// resolved and nothing is spent.

import { runDeclaredChecks, type DeclaredCheckRunOutcome } from "@openspec-ui/core";

export interface CheckChangeOptions {
  workspaceRoot: string;
  changeName: string;
  format: "text" | "json";
}

export interface CheckChangeDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  runChecks?: (workspaceRoot: string, changeName: string) => Promise<DeclaredCheckRunOutcome>;
}

/** `0` every declared check passed, or the change declared none; `1` at
 * least one failed; `2` the checks could not be run at all.
 *
 * A change declaring no checks exits `0` on purpose. Most changes in this
 * repository's history declared none, and reporting them as failures
 * would be a false statement about them — the report says "none
 * declared", which is a visible answer rather than a pass in disguise. */
export async function checkChange(options: CheckChangeOptions, deps: CheckChangeDeps): Promise<number> {
  const run = deps.runChecks ?? ((root: string, name: string) => runDeclaredChecks(root, name));

  let outcome: DeclaredCheckRunOutcome;
  try {
    outcome = await run(options.workspaceRoot, options.changeName);
  } catch (error) {
    // A malformed `check(...)` declaration lands here, as does a change
    // with no readable `tasks.md`. Both are "the check itself could not
    // run", not "the change failed its checks".
    deps.stderr(`openspec-ui-cli: could not run the declared checks: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(
      {
        ok: outcome.failed.length === 0,
        declared: outcome.ranAny,
        results: [...outcome.passed, ...outcome.failed].map((entry) => ({
          check: entry.check.name,
          ...(entry.check.param !== undefined ? { param: entry.check.param } : {}),
          task: entry.text,
          line: entry.lineNumber,
          pass: entry.result.pass,
          reason: entry.result.reason,
        })),
      },
      null,
      2,
    ));
    return outcome.failed.length === 0 ? 0 : 1;
  }

  if (!outcome.ranAny) {
    deps.stdout(`"${options.changeName}" declares no mechanical checks.`);
    return 0;
  }

  // Reported in the order the file declares them, so a reader following
  // along in `tasks.md` sees the same sequence.
  const entries = [...outcome.passed, ...outcome.failed].sort((left, right) => left.lineNumber - right.lineNumber);
  for (const entry of entries) {
    const param = entry.check.param !== undefined ? `(${entry.check.param})` : "";
    deps.stdout(`${entry.result.pass ? "OK  " : "FAIL"}  ${entry.check.name}${param} — ${entry.result.reason}`);
  }
  deps.stdout(
    outcome.failed.length === 0
      ? `\nAll ${outcome.passed.length} declared check(s) passed.`
      : `\n${outcome.failed.length} of ${entries.length} declared check(s) failed.`,
  );
  return outcome.failed.length === 0 ? 0 : 1;
}
