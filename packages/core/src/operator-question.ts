// A question an agent puts to the operator (the-agent-asks-the-operator,
// ADR 0042).
//
// Every agent stage's instruction asks the agent, where it needs a decision
// the change's files do not make, to print a line of its own
// `Question for the operator: <the question>` and not to make the decision
// itself. This reads such a line the way task-marker.ts reads its own:
// only at the start of a line, list, quote and heading marks and emphasis
// tolerated, and prose never read for one.

/** Leading quote, heading and list marks, however many and in any order. */
const LEADING_MARKS_RE = /^(?:[>#*-]\s*|\d+[.)]\s+)+/;

/** An optional emphasis mark: bold, underline bold, or a single backtick. */
const EMPHASIS = "(?:\\*\\*|__|`)?";

const MARKER_RE = new RegExp(`^${EMPHASIS}Question for the operator${EMPHASIS}\\s*:${EMPHASIS}\\s*(.*)$`, "i");

/** The question a marker line asks, or `undefined` for any other line, and
 * for a marker that asks nothing. Emphasis closing at the end is dropped. */
export function readOperatorQuestion(line: string): string | undefined {
  const text = line.trim().replace(LEADING_MARKS_RE, "");
  const match = MARKER_RE.exec(text);
  if (match === null) return undefined;
  const question = (match[1] ?? "").trim().replace(/(?:\*\*|__|`)+$/u, "").trim();
  return question.length > 0 ? question : undefined;
}

/** Splits streamed text into whole lines, keeping the unfinished end for
 * the next chunk: an agent's reply arrives in pieces that cut lines
 * anywhere. */
export class LineCollector {
  private pending = "";

  /** The whole lines this chunk completes. */
  take(chunk: string): string[] {
    const text = this.pending + chunk;
    const lines = text.split(/\r?\n/u);
    this.pending = lines.pop() ?? "";
    return lines;
  }

  /** What is left once the stream has ended. */
  rest(): string[] {
    const rest = this.pending;
    this.pending = "";
    return rest.trim().length > 0 ? [rest] : [];
  }
}
