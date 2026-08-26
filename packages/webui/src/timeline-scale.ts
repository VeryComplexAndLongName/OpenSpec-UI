// Log-scale position for the multi-change timeline (see
// openspec/changes/add-multi-change-timeline-view/design.md, "Log-scale
// direction"). Validated against this repository's own real archived-
// change timestamps from 2026-08-26 before picking a direction: a
// log1p of elapsed time *since the range start* spreads out a dense
// cluster of near-simultaneous changes (the common case this project's
// own squash-merge workflow produces) into something readable, while
// compressing sparser later activity — the opposite direction (log of
// remaining time until the range end) made the dense cluster *more*
// overlapped than a plain linear scale, defeating the point.

/** Returns a 0-100 position for `timestampMs` along `[rangeStartMs,
 * rangeEndMs]`, log-scaled from the range start. Clamped to [0, 100] —
 * a timestamp outside the picked range still renders at an edge rather
 * than off-screen. */
export function logPosition(timestampMs: number, rangeStartMs: number, rangeEndMs: number): number {
  const elapsed = Math.max(0, timestampMs - rangeStartMs);
  const span = Math.max(1, rangeEndMs - rangeStartMs);
  const raw = (Math.log1p(elapsed) / Math.log1p(span)) * 100;
  return Math.min(100, Math.max(0, raw));
}
