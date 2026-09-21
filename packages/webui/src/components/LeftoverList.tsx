// What the workspace was left holding, said in the Summary
// (the-workspace-clears-what-it-left-behind).
//
// Each list says a different thing. What went, went without being
// asked: it is stated, because a product that removes something quietly
// is a product that took something. That now includes a working
// directory whose work has landed and a change branch that was rebased
// (git-says-a-working-directory-is-done, ADR 0034), under "Done for you".
// What stays says what it holds, so a person can see whether it is
// theirs, and offers the removal as a press. A working directory that is
// named here with nothing left to do is one the sweep kept - its tree
// holds uncommitted work - and removing it is the person's call.

import type { WorkspaceLeftoverReading } from "../change-leftovers-client.js";

export interface LeftoverListProps {
  reading: WorkspaceLeftoverReading | undefined;
  /** Removes one leftover directory or one working directory. */
  onRemove?: (target: { name: string } | { path: string }) => void;
  /** Why the reading could not be taken, where it could not. */
  error?: string;
}

const REASON_WORDS: Record<"merged" | "branch-gone", string> = {
  merged: "its branch is merged",
  "branch-gone": "no branch of that name is left",
};

export function LeftoverList({ reading, onRemove, error }: LeftoverListProps) {
  if (error !== undefined) {
    return (
      <section className="openspec-panel" data-testid="leftovers">
        <div className="openspec-panel-head"><h2>Left behind</h2></div>
        <p className="openspec-panel-body openspec-notice" data-testid="leftovers-error">
          {`The workspace could not be read for what it was left holding: ${error}`}
        </p>
      </section>
    );
  }

  const cleared = reading?.cleared ?? [];
  const kept = reading?.kept ?? [];
  const finished = reading?.finishedWith ?? [];
  const failures = reading?.failures ?? [];
  const swept = reading?.swept ?? [];
  if (cleared.length === 0 && kept.length === 0 && finished.length === 0 && failures.length === 0 && swept.length === 0) {
    return null;
  }

  return (
    <section className="openspec-panel" data-testid="leftovers">
      <div className="openspec-panel-head">
        <h2>Left behind</h2>
        <span className="openspec-panel-head-note">directories with no documents in them</span>
      </div>

      {swept.length > 0 ? (
        // Done without being asked, so it is said: removed directories,
        // rebased branches, and a conflict left for a person (ADR 0034).
        <div className="openspec-leftovers-group" data-testid="leftovers-swept">
          <h3>Done for you</h3>
          <ul className="openspec-leftovers-list">
            {swept.map((line) => (
              <li key={line}><span className="openspec-leftovers-note">{line}</span></li>
            ))}
          </ul>
        </div>
      ) : null}

      {cleared.length > 0 ? (
        <div className="openspec-leftovers-group" data-testid="leftovers-cleared">
          <h3>{cleared.length === 1 ? "Cleared 1 directory" : `Cleared ${cleared.length} directories`}</h3>
          <ul className="openspec-leftovers-list">
            {cleared.map((one) => (
              <li key={one.name}>
                <span className="openspec-leftovers-name">{one.name}</span>
                <span className="openspec-leftovers-note">
                  {`held ${one.files.length === 0 ? "nothing" : one.files.join(", ")}, and its change is archived`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {kept.length > 0 ? (
        <div className="openspec-leftovers-group" data-testid="leftovers-kept">
          <h3>Not cleared</h3>
          <ul className="openspec-leftovers-list">
            {kept.map((one) => (
              <li key={one.name}>
                <span className="openspec-leftovers-name">{one.name}</span>
                <span className="openspec-leftovers-note">
                  {one.archivedAs === undefined
                    ? `holds ${one.files.length === 0 ? "nothing" : one.files.join(", ")}, and no change of this name is archived`
                    : `holds ${one.files.join(", ")}, which this product did not write`}
                </span>
                <button
                  type="button"
                  data-testid={`remove-leftover-${one.name}`}
                  onClick={() => onRemove?.({ name: one.name })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {finished.length > 0 ? (
        <div className="openspec-leftovers-group" data-testid="leftovers-working-directories">
          <h3>Working directories with nothing left to do</h3>
          <ul className="openspec-leftovers-list">
            {finished.map((one) => (
              <li key={one.path}>
                <span className="openspec-leftovers-name">{one.label}</span>
                <span className="openspec-leftovers-note">
                  {`${one.branch ?? "no branch"} - ${one.reason ? REASON_WORDS[one.reason] : "finished with"}, and its tree is clean`}
                </span>
                <button
                  type="button"
                  data-testid={`remove-directory-${one.label}`}
                  onClick={() => onRemove?.({ path: one.path })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <p className="openspec-panel-fine" data-testid="leftovers-failures">
          {failures.map((failure) => `${failure.name} could not be removed: ${failure.reason}`).join("; ")}
        </p>
      ) : null}
    </section>
  );
}
