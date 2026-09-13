// What an ACP `session/update` payload says, as one line for a person: a
// tool call's title, a tool call that failed, a plan's progress.
//
// The companion of acp-streamed-text.ts. That module reads the prose an
// agent streams; this one reads the rest of what is worth a line. Every
// surface that shows a run — the AI panel, the VS Code output channel,
// the terminal — asks the same question, so it is answered once, here.
//
// It knows ACP and no particular agent. An agent that does not speak ACP
// is translated into it by its own adapter (see agents/claude-acp.ts) and
// is never recognised here: a branch per imitating agent in a module
// every surface imports is what this arrangement exists to avoid. See
// openspec/changes/an-agent-update-says-something/design.md.
//
// A leaf module: no Node built-ins, so the browser bundle can carry it
// (`browser.ts`, gated by packages/server/src/static.test.ts).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The first line of a text, trimmed, or `undefined` when that is empty.
 *
 * A title is one line on every surface that shows it. With the multiline
 * flag, `$` matches right before the first line break, so the first
 * element of the split is the text up to it; `trim` drops a carriage
 * return left at its end. */
function firstLine(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const line = value.split(/$/m)[0]?.trim();
  return line ? line : undefined;
}

function describePlan(entries: unknown): string | undefined {
  if (!Array.isArray(entries)) return undefined;
  const readable = entries.filter(isRecord);
  // An empty plan says nothing worth a line: "plan 0/0" is noise.
  if (readable.length === 0) return undefined;
  const completed = readable.filter((entry) => entry.status === "completed").length;
  const current = firstLine(readable.find((entry) => entry.status === "in_progress")?.content);
  const progress = `plan ${completed}/${readable.length}`;
  return current ? `${progress}: ${current}` : progress;
}

/** Reads an ACP update into one line for a person, or `undefined` when it
 * has nothing to say in a line.
 *
 * - `tool_call`: its title.
 * - `tool_call_update` that failed: `failed: <title>`, or
 *   `a tool call failed` when it carries no title. One that did not fail
 *   says nothing: a call just shown finishing is noise, and the next call
 *   says more.
 * - `plan`: `plan <completed>/<total>`, with the step in progress after a
 *   colon when there is one.
 *
 * `undefined` for text chunks — prose belongs to `readAcpStreamedText`,
 * and the surface joins it — and for every kind this module does not
 * recognise, for the reason that module gives: ACP is not this project's
 * protocol, and a shape nobody here has seen is not guessed at.
 *
 * Shortening a line to fit is left to the surface; a terminal and a panel
 * have different widths. */
export function describeAcpUpdate(update: Record<string, unknown>): string | undefined {
  switch (update.sessionUpdate) {
    case "tool_call":
      return firstLine(update.title);
    case "tool_call_update": {
      if (update.status !== "failed") return undefined;
      const title = firstLine(update.title);
      return title ? `failed: ${title}` : "a tool call failed";
    }
    case "plan":
      return describePlan(update.entries);
    default:
      return undefined;
  }
}
