// A change chosen by typing part of its name (the-timeline-finds-a-change).
//
// A repository with hundreds of archived changes made the Timeline's picker a
// list nobody could find anything in. This is a combobox in the ARIA sense:
// an input that filters a list drawn under it, walked with the arrow keys and
// chosen with Enter or a click. What it chooses is an option's value, the
// same `active:<name>` or `archived:<folder>` the select it replaces gave.

import { useId, useMemo, useState, type KeyboardEvent } from "react";

export interface ChangePickerOption {
  /** What choosing the option reports. */
  value: string;
  /** The name a person reads: an archived change's name without its date. */
  name: string;
  archived: boolean;
  /** Further text the query is matched against, such as an archive folder's
   * date, which the name leaves out. */
  keywords?: string;
}

/** How many matches the list draws at once. The rest are counted, and
 * typing more of the name narrows them. */
export const CHANGE_PICKER_SHOWN = 100;

/** The options every word of `query` appears in, in their given order. A
 * blank query matches every option. Case does not matter. */
export function matchingChanges(options: readonly ChangePickerOption[], query: string): ChangePickerOption[] {
  const words = query.toLowerCase().split(/\s+/u).filter((word) => word.length > 0);
  if (words.length === 0) return [...options];
  return options.filter((option) => {
    const text = `${option.name} ${option.keywords ?? ""} ${option.archived ? "archived" : "active"}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

function optionLabel(option: ChangePickerOption): string {
  return option.archived ? `${option.name} · archived` : option.name;
}

export function ChangePicker({ label, placeholder, options, value, onChange, disabled = false, testId }: {
  label: string;
  placeholder: string;
  options: readonly ChangePickerOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const listId = useId();
  /** What the person has typed since the field took focus; `null` while the
   * field shows the chosen change instead. */
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const chosen = options.find((option) => option.value === value);
  const matches = useMemo(() => matchingChanges(options, query ?? ""), [options, query]);
  const shown = matches.slice(0, CHANGE_PICKER_SHOWN);
  const open = query !== null && !disabled;
  const optionId = (index: number) => `${listId}-option-${index}`;

  function choose(option: ChangePickerOption | undefined) {
    if (option === undefined) return;
    setQuery(null);
    onChange(option.value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setQuery("");
      else setActive((index) => Math.min(index + 1, shown.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      if (!open) return;
      event.preventDefault();
      choose(shown[active]);
    } else if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      setQuery(null);
    }
  }

  return (
    <div className="openspec-change-picker openspec-timeline-picker">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        {...(open && shown[active] !== undefined ? { "aria-activedescendant": optionId(active) } : {})}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        disabled={disabled}
        data-testid={testId}
        value={query ?? (chosen ? optionLabel(chosen) : "")}
        onFocus={() => {
          setQuery("");
          setActive(0);
        }}
        onBlur={() => setQuery(null)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open ? (
        <div className="openspec-change-picker-popup">
          <ul id={listId} role="listbox" aria-label={label} className="openspec-change-picker-list">
            {shown.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className={option.value === value ? "openspec-change-picker-option openspec-change-picker-option--chosen" : "openspec-change-picker-option"}
                data-testid={`change-picker-option-${option.value}`}
                // Down, not click: a click would blur the field first, and the
                // list would be gone before the click reached it.
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
                onMouseMove={() => setActive(index)}
              >
                <span className="openspec-change-picker-name">{option.name}</span>
                {option.archived ? <span className="openspec-change-picker-kind">archived</span> : null}
              </li>
            ))}
          </ul>
          <p className="openspec-change-picker-count" aria-live="polite" data-testid="change-picker-count">
            {matches.length === 0
              ? "No change matches."
              : matches.length > shown.length
                ? `${shown.length} of ${matches.length} matches shown; type more of the name.`
                : `${matches.length} of ${options.length} changes`}
          </p>
        </div>
      ) : null}
    </div>
  );
}
