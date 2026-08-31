// "Run with Agentic Harness" dispatch (agentic-harness-run-menu) — the
// standalone shell's counterpart to the VS Code extension's
// `openspec-ui.runWithHarness` command handler. Extracted from
// `standalone-entry.tsx` (a bootstrap script, not independently unit
// tested — see its own header comment) into its own testable module,
// matching this package's existing convention of separating client/logic
// code from entry-point wiring (`harness-config-client.ts`,
// `change-editor-client.ts`).

import { resolveRunWithHarnessTarget, type RunWithHarnessTarget } from "@openspec-ui/core/browser";
import { resolveHarnessConfig } from "./harness-config-client.js";
import type { ChangeEditorRequest } from "./change-editor-client.js";
import { buildDefaultChangeDir } from "./shell-ui.js";

export interface RunWithHarnessDispatch {
  target: RunWithHarnessTarget;
  /** Absolute path to the change's directory — always computed, for
   * either target, since the `"picker"` path also needs it to pre-load
   * the "Run a Command" tab. */
  changeDir: string;
}

/** Resolves the change's harness config fresh (never cached — see
 * agentic-harness-run-menu's design.md, "Menu entry always resolves
 * fresh") and decides which flow to dispatch to, via the same
 * `resolveRunWithHarnessTarget` the VS Code extension applies to its own
 * (Node-side) resolved config. */
export async function resolveRunWithHarnessDispatch(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
): Promise<RunWithHarnessDispatch> {
  const config = await resolveHarnessConfig(request, cwd, changeName);
  const target = resolveRunWithHarnessTarget(config);
  const separator = cwd.includes("\\") ? "\\" : "/";
  const changeDir = `${buildDefaultChangeDir(cwd)}${separator}${changeName}`;
  return { target, changeDir };
}
