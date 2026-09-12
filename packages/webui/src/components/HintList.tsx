// What the repository suggests, shown beside what it reports —
// a-hint-says-what-can-run-together.
//
// This file renders; it decides nothing. Every suggestion was derived by
// `buildHints` in core from the readiness report the host already
// fetched, so the shell, the extension and `openspec-ui-cli advise`
// cannot disagree about what to suggest.
//
// Two rules the markup enforces:
//
// - The commands are text a person selects and copies. There is no
//   button that runs one. This capability writes nothing and starts
//   nothing, and a control that acted would make it the kind of thing
//   that does.
// - Nothing to suggest renders nothing at all — not an empty region
//   with a heading, which reads as a surface that is broken rather than
//   one with no news.

import type { Hint } from "@openspec-ui/core/browser";

export interface HintListProps {
  hints: readonly Hint[] | undefined;
}

export function HintList({ hints }: HintListProps): JSX.Element | null {
  if (!hints || hints.length === 0) return null;

  return (
    <section className="openspec-hints" data-testid="hint-list" aria-label="Suggestions">
      <h3>Worth doing</h3>
      <ul className="openspec-hints-list">
        {hints.map((hint) => (
          <li key={hint.id} className="openspec-hint" data-testid={`hint-${hint.id}`}>
            <strong>{hint.subject}</strong>
            {/* The fact it came from, always: a suggestion a reader can
                check in one step is one they can disagree with, and one
                without a reason becomes folklore the first time it is
                wrong. */}
            <p className="openspec-shell-note">{hint.because}</p>
            {hint.commands.map((command) => (
              <pre key={command} className="openspec-hint-command">{command}</pre>
            ))}
          </li>
        ))}
      </ul>
    </section>
  );
}
