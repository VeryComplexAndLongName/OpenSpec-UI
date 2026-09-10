// "Run with Agentic Harness" dispatch (agentic-harness-run-menu) — the
// standalone shell's counterpart to the VS Code extension's
// `openspec-ui.runWithHarness` command handler. Extracted from
// `standalone-entry.tsx` (a bootstrap script, not independently unit
// tested — see its own header comment) into its own testable module,
// matching this package's existing convention of separating client/logic
// code from entry-point wiring (`harness-config-client.ts`,
// `change-editor-client.ts`).

import { buildRunPlan, changeTemplateConfigToWrite, openTaskCount, resolveRunWithHarnessTarget, type HarnessBudget, type HarnessTemplate, type RunPlan, type RunWithHarnessTarget } from "@openspec-ui/core/browser";
import { readChangeHarnessOverride, resolveHarnessConfig, writeHarnessConfig } from "./harness-config-client.js";
import { loadChangeTimeline } from "./change-timeline-client.js";
import type { ChangeEditorRequest } from "./change-editor-client.js";
import { buildDefaultChangeDir } from "./shell-ui.js";

export interface RunWithHarnessDispatch {
  target: RunWithHarnessTarget;
  /** Absolute path to the change's directory — always computed, for
   * either target, since the `"picker"` path also needs it to pre-load
   * the "Run a Command" tab. */
  changeDir: string;
  /** The resolved config's `budget`, carried out of the same resolution
   * rather than fetched again — the chain panel shows it beside a run's
   * recorded usage so a configured ceiling is legible. `undefined` when
   * none is configured, which is what makes the panel say nothing about
   * limits at all. */
  budget?: HarnessBudget;
  /** What the run entry says before it starts anything: which path the
   * configuration resolves to, which agent runs each stage, any ceiling
   * that cannot act, and which named configuration is recommended.
   *
   * The recommendation was left out of this host at first, on the
   * recorded ground that the shell "can read neither the task list nor
   * the audit log". Half of that was never checked: `/api/change-timeline`
   * returns every task with its `done` state. The audit log genuinely is
   * not served here, and the recommendation is built for that — it says
   * there is no previous run to go on, in the same breath as its answer.
   * See run-dialog-actually-advises. */
  plan: RunPlan;
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
  // `hasVsCodeAgent: false` — there is no VS Code Chat to open here, and
  // offering a path that cannot run is the same defect as a ceiling that
  // cannot act.
  const plan = buildRunPlan(config, {
    hasVsCodeAgent: false,
    ...(await readOpenTaskCount(request, cwd, changeName)),
  });
  return { target, changeDir, plan, ...(config.budget ? { budget: config.budget } : {}) };
}

/** The change's open task count, for the recommendation.
 *
 * A timeline that cannot be read leaves the recommendation out entirely
 * rather than passing a count of zero. Absent is honest; zero is a claim,
 * and it happens to be the claim that produces the thriftiest answer.
 *
 * The fetch is this host's; the count is `openTaskCount` in core, which
 * the extension's two command handlers now call as well — the same one
 * line had been written three times. See
 * a-date-is-one-day-in-every-source. */
async function readOpenTaskCount(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
): Promise<{ recommendationInput?: { openTaskCount: number } }> {
  try {
    const timeline = await loadChangeTimeline(request, cwd, changeName, false);
    return { recommendationInput: { openTaskCount: openTaskCount(timeline.tasks) } };
  } catch {
    return {};
  }
}

/** Applies a named configuration to a change, keeping what it does not
 * mention.
 *
 * Lives here rather than in `standalone-entry.tsx` for the reason this
 * module exists at all: that file is a bootstrap script and is not unit
 * tested, and this is exactly the kind of logic that needs to be.
 *
 * The writer replaces the file, so writing the template alone would
 * delete every key the change had that the template does not set —
 * `gitStageAllowlist` above all, which says which paths a chain may
 * stage. Someone reaching for a cheaper run has not asked for that to be
 * removed. See applying-a-template-keeps-the-rest.
 *
 * A failing read propagates rather than falling back to writing the
 * template alone: losing a key because a read failed is the same harm
 * arriving by a different route.
 *
 * The configuration carries an effort level rather than a value, so what
 * is written is computed by `changeTemplateConfigToWrite` — the one core
 * function every surface applies a configuration to a change through,
 * the extension's run dialog and the settings view included. See
 * presets-by-effort and a-stage-override-keeps-its-custom-agent. */
export async function applyTemplateToChange(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
  template: HarnessTemplate,
): Promise<void> {
  const [existing, global] = await Promise.all([
    readChangeHarnessOverride(request, cwd, changeName),
    // The global file, not the change's own override: the effort has to
    // be resolved against the agent the stage will actually use, and
    // that is usually named globally rather than in the change. The
    // core function merges the two.
    resolveHarnessConfig(request, cwd),
  ]);
  const config = changeTemplateConfigToWrite(template, global, existing ?? undefined);
  await writeHarnessConfig(request, cwd, config, changeName);
}
