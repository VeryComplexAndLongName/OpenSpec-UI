// Pure type + helper, deliberately its own leaf module with zero
// non-type imports — same reasoning as harness-stage.ts/harness-
// dispatch.ts. `normalizeStepAgent` must be importable from
// `@openspec-ui/core/browser` (HarnessSettingsView.tsx renders a
// `stepAgents` entry that may have come from a hand-edited config in
// either form), but `harness-config.ts` itself has top-level
// `node:fs/promises`/`node:path` imports for its other exports —
// re-exporting a value (not just a type) FROM that module would force
// the browser bundle to actually load it at runtime, pulling those Node
// built-ins in with it (see harness-dispatch.ts's identical note).

import type { HarnessStage } from "./harness-stage.js";

/** A stage's entry names an agent, either on its own (the bare-string
 * form, unchanged from before this capability) or together with a
 * model. Widened, not replaced — see harness-step-models design.md,
 * "Widen the entry, keep the string form working". */
export type HarnessStepAgent = string | { agent: string; model?: string };
export type HarnessStepAgents = Partial<Record<HarnessStage, HarnessStepAgent>>;

/** Allow-list of characters a model id may contain: cannot start with
 * `-` (so it can never be read as a second flag) and cannot contain
 * whitespace or quotes (so it can never become a shell/quoting escape)
 * — see harness-step-models design.md, "Validation is a closed
 * character set, not an escape". */
export const MODEL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/** Normalizes either form of a `HarnessStepAgents` entry to `{ agent,
 * model? }` — the single place that knows both shapes exist, so no
 * consumer has to. */
export function normalizeStepAgent(entry: HarnessStepAgent): { agent: string; model?: string } {
  return typeof entry === "string" ? { agent: entry } : entry;
}
