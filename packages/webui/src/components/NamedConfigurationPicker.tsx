import { useEffect, useState } from "react";
import { templatesForScope, type HarnessTemplate } from "@openspec-ui/core/browser";
import { SegmentedChoice } from "./SegmentedChoice.js";

// One list of named configurations, applied with one button, used by
// both settings views and by the run dialog.
//
// The four configurations used to be four bordered titles, each followed
// by four paragraphs, in three places. Nothing about a bordered title said
// it applied anything, and the list filled a screen before the first
// setting. The choice is held in one line, the description beneath it is
// the one being considered, and what applying did is said beside the button
// that did it rather than somewhere out of view. See
// a-change-is-configured-from-the-change.
//
// Drawn as ADR 0033's mockup draws it (the-harness-settings-look-like-the-
// mockup): the configurations as segments of one control, the button beside
// them, and the effort, purpose and what it is not for as one paragraph
// under them, with the basis in fine print.

export function NamedConfigurationPicker(
  { scope, recommendedId, describeEffort, onApply, status, note, testIdPrefix, applyLabel = "Apply" }: {
    /** Which configurations may be written where this picker writes.
     * `templatesForScope` is the one answer: a configuration refused on
     * save is never offered. */
    scope: "global" | "change";
    /** The recommended configuration, marked and chosen first. */
    recommendedId?: string;
    /** What the configuration's effort means for the agents in play.
     * Absent, the level is stated as a level. */
    describeEffort?: (template: HarnessTemplate) => string;
    onApply: (template: HarnessTemplate) => void;
    /** What the host says the last apply did. Shown beside the button
     * while the configuration it was about is still the one chosen. */
    status?: string | null;
    /** What applying does here: fills a form, or writes a file. */
    note: string;
    testIdPrefix: string;
    /** The button's words, which say where the configuration goes. */
    applyLabel?: string;
  },
) {
  const templates = templatesForScope(scope);
  const initial = templates.some((template) => template.id === recommendedId)
    ? recommendedId as string
    : templates[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initial);
  const [appliedId, setAppliedId] = useState<string | null>(null);

  // A recommendation that changes — the plan re-resolved after an apply —
  // moves the choice to it, as opening the picker fresh would.
  useEffect(() => {
    if (recommendedId && templates.some((template) => template.id === recommendedId)) setSelectedId(recommendedId);
  }, [recommendedId]);

  const selected = templates.find((template) => template.id === selectedId);
  if (!selected) return null;

  return (
    <section className="openspec-panel openspec-named-configuration" data-testid={`${testIdPrefix}-named-configuration`}>
      <div className="openspec-named-configuration-choose">
        <span className="openspec-named-configuration-label" aria-hidden="true">Named configuration</span>
        <SegmentedChoice
          label="Named configuration"
          testId={`${testIdPrefix}-named-configuration-choice`}
          value={selectedId}
          onChange={setSelectedId}
          options={templates.map((template) => ({
            value: template.id,
            label: template.id === recommendedId ? `${template.title} (recommended)` : template.title,
          }))}
        />
        <button
          type="button"
          className="button openspec-button-quiet openspec-button-small"
          data-testid={`${testIdPrefix}-named-configuration-apply`}
          onClick={() => {
            setAppliedId(selected.id);
            onApply(selected);
          }}
        >
          {applyLabel}
        </button>
      </div>
      <div className="openspec-named-configuration-description" data-testid={`${testIdPrefix}-named-configuration-description`}>
        {/* The level first: it is what separates these configurations from
            each other, and a description that hides its axis asks the
            reader to apply one to find out. */}
        <p>
          <strong>Effort:</strong> {describeEffort ? describeEffort(selected) : `${selected.effortLevel} of what each agent accepts`}
          {" — "}{selected.intent}
        </p>
        {/* A line of its own: run on after the purpose, the owner read the
            two as one sentence. */}
        <p data-testid={`${testIdPrefix}-named-configuration-not-for`}>
          <strong>Not for:</strong> {selected.notFor} {note}
        </p>
        <p className="openspec-named-configuration-basis">{selected.basis}</p>
      </div>
      {status && appliedId === selected.id ? (
        <p className="openspec-named-configuration-status" role="status" data-testid={`${testIdPrefix}-named-configuration-status`}>
          {status}
        </p>
      ) : null}
    </section>
  );
}
