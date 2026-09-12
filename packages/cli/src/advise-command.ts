// `openspec-ui-cli advise` — what the repository already knows, offered
// rather than printed (a-hint-says-what-can-run-together).
//
// Presentation only. `ready` prints the readiness report; this prints
// the suggestions `buildHints` derives from the same report, each with
// the fact it came from and the exact commands that act on it. It
// creates nothing, starts nothing, and writes nothing.

import {
  WORKSPACE_LEASE_STALE_AFTER_MS,
  buildHints,
  readChangeReadiness,
  resolveHarnessConfig,
  type Hint,
} from "@openspec-ui/core";

export interface AdviseOptions {
  workspaceRoot: string;
  base?: string;
  format: "text" | "json";
}

export interface AdviseDeps {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  /** Test seams, the same shape `readyCommand` already offers. */
  read?: typeof readChangeReadiness;
  readConfig?: typeof resolveHarnessConfig;
}

/** Always `0` where the suggestions could be produced — with or without
 * any — and `2` where they could not.
 *
 * The same contract `ready` and `lease` have, and for the same reason: a
 * repository with nothing to suggest is in a perfectly good state, and a
 * script asking "is there anything to do" should read the output rather
 * than infer it from a failure code. */
export async function adviseCommand(options: AdviseOptions, deps: AdviseDeps): Promise<number> {
  let hints: Hint[];
  try {
    const report = await (deps.read ?? readChangeReadiness)({
      workspaceRoot: options.workspaceRoot,
      ...(options.base !== undefined ? { base: options.base } : {}),
    });
    const config = await (deps.readConfig ?? resolveHarnessConfig)(options.workspaceRoot);
    // Off means not computed, not computed-and-hidden.
    hints = config.hints?.enabled === false
      ? []
      : buildHints(report, { staleAfterMs: WORKSPACE_LEASE_STALE_AFTER_MS });
  } catch (error) {
    deps.stderr(`openspec-ui-cli: could not work out what to suggest: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  if (options.format === "json") {
    deps.stdout(JSON.stringify(hints, null, 2));
    return 0;
  }

  if (hints.length === 0) {
    deps.stdout("Nothing to suggest here.");
    return 0;
  }

  for (const [index, hint] of hints.entries()) {
    if (index > 0) deps.stdout("");
    deps.stdout(hint.subject);
    deps.stdout(`  ${hint.because}`);
    for (const command of hint.commands) deps.stdout(`  $ ${command}`);
  }
  return 0;
}
