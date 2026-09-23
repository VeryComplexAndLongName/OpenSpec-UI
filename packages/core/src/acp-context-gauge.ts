// How much of its context a run has filled, where the agent says so
// (a-run-can-outgrow-its-context).
//
// ACP's `usage_update` notification carries `used` and `size`: the tokens
// now in the session's context, against the model's window. It is a
// gauge, not a bill. It goes *down* after a compaction, so counting it as
// consumption would under-count exactly the long runs that compact, and
// `agent-usage.ts` deliberately records none of it.
//
// A gauge is still worth a ceiling, just not a spending one. A session
// that has eaten most of its window is one whose next turn carries the
// whole conversation again: slower, dearer, and worse at the task than
// the same work started fresh. And unlike a cost, the gauge arrives
// *during* the run, so a ceiling on it can stop a stage that is already
// going - which of everything this product configures, only `timeout`
// could do before.
//
// Measured on 2026-09-23: `dsh` 0.1.5-rc.2 sends this on every turn, with
// `size` 1,000,000 and nothing else in it - no cost, no token split. So
// on DeepSeek this is the only ceiling of any kind that can act.
//
// A leaf module: no Node built-ins, so the browser bundle can carry it.

/** What an agent said about its context window. */
export interface AcpContextGauge {
  /** Tokens now in the session's context. */
  used: number;
  /** The window they are measured against. */
  size: number;
  /** `used / size`, between 0 and 1. */
  share: number;
}

/** The context gauge an ACP update carries, or `undefined` where it
 * carries none.
 *
 * `undefined` for everything unrecognised, as every reader of this
 * protocol here answers: the payload is carried verbatim, and a shape
 * nobody has seen is not guessed at. A `size` of zero reads as no gauge
 * rather than as a full window - a share computed from it would be
 * meaningless, and would fire every ceiling at once. */
export function readAcpContextGauge(update: Record<string, unknown>): AcpContextGauge | undefined {
  if (update.sessionUpdate !== "usage_update") return undefined;
  const used = update.used;
  const size = update.size;
  if (typeof used !== "number" || typeof size !== "number") return undefined;
  if (!Number.isFinite(used) || !Number.isFinite(size)) return undefined;
  if (size <= 0 || used < 0) return undefined;
  return { used, size, share: used / size };
}

/** A count as this product writes one, on every machine.
 *
 * Explicitly English-grouped. A bare `toLocaleString()` follows the
 * machine's own locale, so the same run's reason reads `850,000` on a
 * runner and `850 000`, with a non-breaking space, on a Russian desktop -
 * one line of text that is two lines depending on who is looking. */
export function formatTokenCount(value: number): string {
  return value.toLocaleString("en-US");
}

/** The ceiling as a person reads it back: a share as a percentage, with
 * the figures it was judged on. */
export function describeContextShare(gauge: AcpContextGauge, ceiling: number): string {
  const percent = (share: number): string => `${(share * 100).toFixed(1)}%`;
  return `stopped at the context ceiling: budget.maxContextShare is ${percent(ceiling)}`
    + `, and the agent reported ${formatTokenCount(gauge.used)} of ${formatTokenCount(gauge.size)} tokens in its context (${percent(gauge.share)})`;
}
