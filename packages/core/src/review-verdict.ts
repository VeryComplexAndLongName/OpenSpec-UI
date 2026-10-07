// Whether a review says the plan is ready - the-plan-is-updated-from-its-review,
// ADR 0041.
//
// The review instruction asks the agent to end with a line of its own,
// `Review verdict: ready` or `Review verdict: changes needed`. This reads such
// a line, as task-marker.ts reads `Starting task <n>`: at the start of a line,
// with the list, quote and heading marks and the emphasis a model wraps it in.
// Prose is not read: "the plan looks ready" says nothing here.

/** What a review said of the plan. */
export type ReviewVerdict = "ready" | "changes-needed";

/** Leading quote, heading and list marks, as task-marker.ts allows. */
const LEADING_MARKS_RE = /^(?:[>#*-]\s*)+/u;

const EMPHASIS = "(?:\\*\\*|__|`)?";

const VERDICT_RE = new RegExp(
  `^${EMPHASIS}Review verdict:${EMPHASIS}\\s*${EMPHASIS}(ready|changes needed)${EMPHASIS}\\.?${EMPHASIS}\\s*$`,
  "iu",
);

/** The verdict one line states, or `undefined` for any other line. */
export function readReviewVerdictLine(line: string): ReviewVerdict | undefined {
  const text = line.trim().replace(LEADING_MARKS_RE, "");
  const said = VERDICT_RE.exec(text)?.[1]?.toLowerCase();
  if (said === "ready") return "ready";
  if (said === "changes needed") return "changes-needed";
  return undefined;
}

/** The verdict a reply states: its last verdict line, or `undefined` where it
 * has none. */
export function readReviewVerdict(text: string): ReviewVerdict | undefined {
  let verdict: ReviewVerdict | undefined;
  for (const line of text.split(/\r?\n/u)) {
    const found = readReviewVerdictLine(line);
    if (found !== undefined) verdict = found;
  }
  return verdict;
}
