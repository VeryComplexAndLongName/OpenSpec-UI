import { useEffect, useState } from "react";
import { templatesForScope, type HarnessTemplate } from "@openspec-ui/core/browser";

// One list of named configurations, applied with one button, used by
// both settings views and by the run dialog.
//
// The four configurations used to be four bordered titles, each followed
// by four paragraphs, in three places. Nothing about a bordered title said
// it applied anything, and the list filled a screen before the first
// setting. A select holds the choice in one line, the description beneath
// it is the one being considered, and what applying did is said beside the
// button that did it rather than somewhere out of view. See
// a-change-is-configured-from-the-change.

export function NamedConfigurationPicker(
  { scope, recommendedId, describeEffort, onApply, status, note, testIdPrefix }: {
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
    <section className="openspec-harness-section openspec-named-configuration" data-testid={`${testIdPrefix}-named-configuration`}>
      <label className="openspec-shell-field">
        Named configuration
        <select
          aria-label="Named configuration"
          data-testid={`${testIdPrefix}-named-configuration-select`}
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.id === recommendedId ? `${template.title} (recommended)` : template.title}
            </option>
          ))}
        </select>
      </label>
      <div className="openspec-named-configuration-description" data-testid={`${testIdPrefix}-named-configuration-description`}>
        {/* The level first: it is what separates these configurations from
            each other, and a description that hides its axis asks the
            reader to apply one to find out. */}
        <p className="openspec-shell-note">
          <strong>Effort:</strong> {describeEffort ? describeEffort(selected) : `${selected.effortLevel} of what each agent accepts`}
        </p>
        <p className="openspec-shell-note">{selected.intent}</p>
        <p className="openspec-shell-note"><strong>Not for:</strong> {selected.notFor}</p>
        <p className="openspec-shell-note">{selected.basis}</p>
      </div>
      <p className="openspec-shell-note">{note}</p>
      <div className="openspec-ai-panel-controls">
        <button
          type="button"
          data-testid={`${testIdPrefix}-named-configuration-apply`}
          onClick={() => {
            setAppliedId(selected.id);
            onApply(selected);
          }}
        >
          Apply
        </button>
        {status && appliedId === selected.id ? (
          <p className="openspec-shell-note" role="status" data-testid={`${testIdPrefix}-named-configuration-status`}>
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
