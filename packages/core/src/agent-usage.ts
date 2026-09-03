// This project's own shape for a run's resource usage — adapter-agnostic,
// not a copy of any one vendor's payload (see design.md, "The usage shape
// is this project's own, not the vendor's"). Every field is optional: per
// ADR 0017 decision 5, an adapter that can fill only part of this shape
// fills that part rather than discarding the rest. No Node imports — this
// type must stay describable in the browser bundle (see browser.ts).

/** One model's contribution within a run that used more than one
 * (Claude's `modelUsage` carried two models in one run, confirmed live —
 * see design.md's "Load-bearing facts"). */
export interface AgentUsageByModel {
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

export interface AgentUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  /** Vendor-computed cost in USD. Never derived locally from tokens and a
   * price table — ADR 0017 rejected that as silently wrong at the next
   * vendor price change. */
  costUsd?: number;
  /** Per-model split, keyed by the vendor's own model id. Absent when the
   * agent does not report a per-model breakdown, or when a run used only
   * one model. */
  byModel?: Record<string, AgentUsageByModel>;
  /** Reasoning/thought tokens, where the agent separates them from output
   * (ACP's `Usage.thoughtTokens`). Not folded into `outputTokens`: an
   * agent that reports both would otherwise be double-counted. */
  thoughtTokens?: number;
  /** A vendor-reported cost in a currency that is **not** USD, kept whole
   * rather than converted.
   *
   * ACP's `Cost` carries `{ amount, currency }`, and `costUsd` above is
   * named for dollars. Writing a euro amount into it would read correctly
   * for a year and then bill someone wrongly, and converting would mean
   * inventing an exchange rate — the same reasoning that kept
   * `maxCostUsd` and `maxAiCredits` as separate fields rather than one
   * `budget: number`. */
  cost?: { amount: number; currency: string };
}
