import { useMemo, useState } from "react";

// The changes a sprint report covers, picked from a list a person can see
// (the-sprint-picks-its-changes). A multiple select showed two rows of
// three hundred, and choosing a sprint's worth meant holding Ctrl through a
// list nobody could read.

export interface CheckableChange {
  /** What the selection carries: `active:<name>` or `archived:<folder>`. */
  value: string;
  name: string;
  archived: boolean;
}

export interface ChangeChecklistProps {
  label: string;
  changes: readonly CheckableChange[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
  /** The report's range, as the date inputs hold it (`YYYY-MM-DD`). */
  rangeStart: string;
  rangeEnd: string;
}

const DATE_PREFIX = /^([0-9]{4}-[0-9]{2}-[0-9]{2})-/u;

/** The day an archived change was archived, from the prefix `openspec
 * archive` gives its folder. */
export function archivedOn(name: string): string | undefined {
  return DATE_PREFIX.exec(name)?.[1];
}

/** Every change the range can be said to hold: the ones archived within
 * it, and the ones still under way, which a sprint report is also about. */
export function changesInRange(changes: readonly CheckableChange[], rangeStart: string, rangeEnd: string): string[] {
  return changes
    .filter((change) => {
      if (!change.archived) return true;
      const day = archivedOn(change.name);
      if (day === undefined) return false;
      return (rangeStart === "" || day >= rangeStart) && (rangeEnd === "" || day <= rangeEnd);
    })
    .map((change) => change.value);
}

export function ChangeChecklist({ label, changes, selected, onChange, rangeStart, rangeEnd }: ChangeChecklistProps) {
  const [filter, setFilter] = useState("");
  const chosen = useMemo(() => new Set(selected), [selected]);
  const shown = useMemo(() => {
    const words = filter.trim().toLowerCase().split(" ").filter((word) => word.length > 0);
    return words.length === 0 ? changes : changes.filter((change) => words.every((word) => change.name.toLowerCase().includes(word)));
  }, [changes, filter]);
  // In the list's own order, whatever order they were ticked in.
  const choose = (next: ReadonlySet<string>) => onChange(changes.map((change) => change.value).filter((value) => next.has(value)));
  const toggle = (value: string) => {
    const next = new Set(chosen);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    choose(next);
  };

  return (
    <fieldset className="openspec-change-checklist" aria-label={label} data-testid="change-checklist" disabled={changes.length === 0}>
      <legend>{label}</legend>
      <div className="openspec-change-checklist-tools">
        <input
          type="search"
          aria-label={`Find in ${label}`}
          placeholder="Find a change"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        <button
          type="button"
          className="button"
          data-testid="change-checklist-in-range"
          disabled={rangeStart === "" && rangeEnd === ""}
          onClick={() => choose(new Set(changesInRange(changes, rangeStart, rangeEnd)))}
        >
          Archived in the range, and under way
        </button>
        <button type="button" className="button" data-testid="change-checklist-all" onClick={() => choose(new Set(changes.map((change) => change.value)))}>All</button>
        <button type="button" className="button" data-testid="change-checklist-none" onClick={() => choose(new Set())}>None</button>
        <span className="openspec-change-checklist-count" data-testid="change-checklist-count">
          {selected.length} of {changes.length} chosen
        </span>
      </div>
      <ul className="openspec-change-checklist-list">
        {shown.map((change) => (
          <li key={change.value}>
            <label>
              <input type="checkbox" checked={chosen.has(change.value)} onChange={() => toggle(change.value)} />
              <span className="openspec-change-checklist-name">{change.name}</span>
              <span className="openspec-change-checklist-note">{change.archived ? "archived" : "under way"}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 ? <li className="openspec-change-checklist-note">No change matches.</li> : null}
      </ul>
    </fieldset>
  );
}
