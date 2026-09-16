// A choice among a few named values, drawn as segments of one control, as
// ADR 0033's mockup draws the named configurations and the autonomy level
// (the-harness-settings-look-like-the-mockup).
//
// Native radio inputs, each inside the label drawn as its segment: arrow
// keys, focus, the checked state and the accessible name all come from the
// browser, and the group is named by `label`.

import { useId } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Said on hover, for a label cut short. */
  title?: string;
}

export function SegmentedChoice<T extends string>(
  { label, options, value, onChange, testId }: {
    label: string;
    options: ReadonlyArray<SegmentedOption<T>>;
    value: T;
    onChange: (value: T) => void;
    testId?: string;
  },
) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="openspec-segmented" data-testid={testId}>
      {options.map((option) => (
        <label key={option.value} className="openspec-segment" {...(option.title ? { title: option.title } : {})}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
