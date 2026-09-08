// Named configurations chosen by cost and time rather than by field.
//
// Titled on the axis a person actually reasons on — what this will spend
// and how long it may take — with the figures in the title rather than
// three lines down. They were previously named for how closely the run is
// watched, which is a consequence of each choice and not the choice.
// See templates-by-cost-and-speed.
//
// Every ceiling here comes from this repository's own audit log, read
// through `buildChangeCostReport` on 2026-09-08 — 49 runs with a
// duration (median 7.7 min, p75 19.7, p90 34.9, longest 56.8) and 16
// with a cost (median $1.94, p90 $7.14, largest $8.67). Keep them
// measured: a ten-minute stage ceiling is the round number a person
// reaches for, and it would have cut nearly a third of those runs.
//
// Every template is asserted to produce no findings from
// `findHarnessConfigLimits`. That check is what separates a template
// from a suggestion — shipping a named configuration whose ceiling
// cannot act would publish, in the product's own voice, the confusion
// that diagnostic exists to report.

import type { HarnessConfig } from "./harness-config.js";

/** Where a template may be applied.
 *
 * `autonomyLevel: "autonomous"`, `reviewGate.mode: "agent-sufficient"`
 * and `checkpoints.requireConfirmationBetweenSteps: false` are refused in
 * a global file, so a template using any of them is per-change only.
 * Dropping those fields silently for a global apply would give a person a
 * template that behaves differently depending on where they clicked. */
export type HarnessTemplateScope = "global" | "change" | "either";

export interface HarnessTemplate {
  id: string;
  title: string;
  /** What this is for. */
  intent: string;
  /** When it is the wrong choice — the sentence that actually helps
   * someone pick, since a list of options carrying only advantages gives
   * no help choosing between them. */
  notFor: string;
  /** Where each number came from, so a reader can disagree with the
   * judgement and not with the measurement. */
  basis: string;
  scope: HarnessTemplateScope;
  config: Partial<HarnessConfig>;
}

export const HARNESS_TEMPLATES: readonly HarnessTemplate[] = [
  {
    id: "min-cost",
    title: "Minimum cost · up to $3, 45 min",
    intent:
      "Spend as little as the work allows. A smaller model at medium effort, with ceilings"
      + " close to what an ordinary change actually costs.",
    notFor:
      "Work that has already failed once. A smaller model needs a second attempt more often,"
      + " and two attempts at a hard change cost more than one at full effort.",
    basis:
      "$3 is above the measured median cost of $1.94 and well under p90 of $7.14. Stage"
      + " ceiling 20 minutes is p75; run ceiling 45 minutes is judgement.",
    scope: "either",
    config: {
      stepAgents: {
        propose: { agent: "claude-cli-acp", model: "claude-sonnet-5", effort: "medium" },
        review: { agent: "claude-cli-acp", model: "claude-sonnet-5", effort: "medium" },
        apply: { agent: "claude-cli-acp", model: "claude-sonnet-5", effort: "medium" },
        verify: { agent: "claude-cli-acp", model: "claude-sonnet-5", effort: "medium" },
      },
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 3, maxStageCostUsd: 2 },
      timeout: { maxRunSeconds: 2700, maxStageSeconds: 1200 },
      maxStageAttempts: 2,
    },
  },
  {
    id: "balanced",
    title: "Balanced · up to $5, 60 min",
    intent:
      "Between the two. A capable model at full effort, and the chain pauses between stages"
      + " so you can see each one before the next begins.",
    notFor:
      "Leaving unattended. It waits at every checkpoint, so a run you walk away from stops at"
      + " the first one and stays there.",
    basis:
      "Stage ceiling 20 minutes is p75 of measured runs — it cuts the slowest quarter."
      + " Run ceiling 60 minutes and $5 are judgement: above the median run, below p90.",
    scope: "either",
    config: {
      stepAgents: {
        propose: { agent: "claude-cli-acp", effort: "high" },
        review: { agent: "claude-cli-acp", effort: "high" },
        apply: { agent: "claude-cli-acp", effort: "medium" },
        verify: { agent: "claude-cli-acp", effort: "high" },
      },
      autonomyLevel: "semi-autonomous",
      reviewGate: { mode: "human-required" },
      budget: { maxCostUsd: 5, maxStageCostUsd: 3 },
      timeout: { maxRunSeconds: 3600, maxStageSeconds: 1200 },
      maxStageAttempts: 2,
    },
  },
  {
    id: "fastest",
    title: "Fastest · up to $25, 4 hours",
    intent:
      "Finish soonest. No checkpoints between stages, so the run never waits for you, and"
      + " ceilings wide enough that a stage is not cut and started over.",
    notFor:
      "A change you are unsure about. It will spend up to $25 and run for up to four hours"
      + " without asking, and review still needs a person before anything is pushed.",
    basis:
      "Nothing here makes an agent work faster. Two things make a run finish sooner and this"
      + " sets both: it never waits for a person, which is where most of a supervised run's"
      + " wall-clock goes, and its stage ceiling of 60 minutes is above the longest run"
      + " measured (56.8) — a stage cut at a ceiling is retried from the start, so a tight"
      + " ceiling makes a run take longer, not less. Four hours and $25 are judgement:"
      + " roughly three p90 runs, and a limit on how long an unattended run may go before"
      + " someone should look.",
    // `autonomous` is refused in a global file, so this one is per-change.
    scope: "change",
    config: {
      stepAgents: {
        propose: { agent: "claude-cli-acp", effort: "high" },
        review: { agent: "claude-cli-acp", effort: "high" },
        apply: { agent: "claude-cli-acp", effort: "high" },
        verify: { agent: "claude-cli-acp", effort: "high" },
      },
      autonomyLevel: "autonomous",
      reviewGate: { mode: "human-required" },
      // The "no checkpoints" the intent promises. Left unset, a change
      // configured from this template still paused for confirmation
      // between every stage — the one thing an unattended run must not
      // do. Found live, not by a test; see a-template-keeps-its-promises.
      checkpoints: { requireConfirmationBetweenSteps: false },
      budget: { maxCostUsd: 25, maxStageCostUsd: 10 },
      timeout: { maxRunSeconds: 14400, maxStageSeconds: 3600 },
      maxStageAttempts: 3,
    },
  },
];

/** The templates that may be written to the given file. A per-change-only
 * template is not offered globally, because the write would be refused. */
export function templatesForScope(scope: "global" | "change"): readonly HarnessTemplate[] {
  return HARNESS_TEMPLATES.filter((template) => template.scope === scope || template.scope === "either");
}
