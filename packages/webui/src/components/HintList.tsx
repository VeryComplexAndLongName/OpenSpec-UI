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
//   that does. A host that can copy offers Copy beside a command, which
//   puts the text on the clipboard and runs nothing
//   (the-pipeline-cards-wear-metro).
// - Nothing to suggest renders nothing at all — not an empty region
//   with a heading, which reads as a surface that is broken rather than
//   one with no news.

import type { Hint } from "@openspec-ui/core/browser";
import { CopyIcon, HintIcon } from "./pipeline-icons.js";

export interface HintListProps {
  hints: readonly Hint[] | undefined;
  /** Copies a command, for a host that allows it. Absent, no Copy is
   * offered and the command is text to select. */
  copyText?: (text: string) => Promise<void>;
}

export function HintList({ hints, copyText }: HintListProps): JSX.Element | null {
  if (!hints || hints.length === 0) return null;

  return (
    <section className="openspec-panel openspec-hints" data-testid="hint-list" aria-label="Suggestions">
      <div className="openspec-panel-head">
        <h2>Worth doing</h2>
        <span className="openspec-panel-head-note">{hints.length === 1 ? "1 hint" : `${hints.length} hints`}</span>
      </div>
      <ul className="openspec-hints-list">
        {hints.map((hint) => (
          <li key={hint.id} className="openspec-hint" data-testid={`hint-${hint.id}`}>
            <span className="openspec-hint-icon" aria-hidden="true"><HintIcon /></span>
            <div className="openspec-hint-text">
              <strong>{hint.subject}</strong>
              {/* The fact it came from, always: a suggestion a reader can
                  check in one step is one they can disagree with, and one
                  without a reason becomes folklore the first time it is
                  wrong. */}
              <p className="openspec-shell-note">{hint.because}</p>
              {hint.commands.map((command) => (
                <div key={command} className="openspec-hint-command-row">
                  <pre className="openspec-hint-command">{command}</pre>
                  {copyText !== undefined ? (
                    <button type="button" className="openspec-pipeline-button" aria-label={`Copy ${command}`} onClick={() => void copyText(command)}>
                      <CopyIcon />Copy
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
