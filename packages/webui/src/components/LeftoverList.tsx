// What the workspace was left holding, said in the Summary
// (the-workspace-clears-what-it-left-behind).
//
// Three lists, and each says a different thing. What went, went without
// being asked: it is stated, because a product that removes something
// quietly is a product that took something. What stays says what it
// holds, so a person can see whether it is theirs, and offers the
// removal as a press. A working directory with nothing left to do is
// named with the branch and the reason it is finished with - never swept,
// because a merged branch can still hold uncommitted work.

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
  if (cleared.length === 0 && kept.length === 0 && finished.length === 0 && failures.length === 0) return null;

  return (
    <section className="openspec-panel" data-testid="leftovers">
      <div className="openspec-panel-head">
        <h2>Left behind</h2>
        <span className="openspec-panel-head-note">directories with no documents in them</span>
      </div>

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
