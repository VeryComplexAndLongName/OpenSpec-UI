import { templatesForScope, type HarnessTemplate, type RunPathId, type RunPlan } from "@openspec-ui/core/browser";

// one-way-in-to-run, corrected by run-dialog-actually-advises.
//
// The standalone shell used to resolve the configuration, decide a path
// and act on it without saying what it had read. On an `assisted` change
// that looked like the button only changed tabs — a correct decision and
// a broken one were indistinguishable, because neither showed anything.
//
// The first version of this dialog fixed half of that and was reported,
// fairly, as "just a path picker": it never advised, it offered no way to
// act on advice, and it said nothing at all when the configuration was
// fine. All three are the same mistake as the one it was built to fix —
// showing less than was known.

export function RunDialog(
  { changeName, plan, onChoose, onApplyTemplate, onDismiss }: {
    changeName: string;
    plan: RunPlan;
    onChoose: (path: RunPathId) => void;
    /** Applying a named configuration writes the change's file. That is
     * deliberate and is not the path override, which writes nothing: a
     * path is chosen for one run, a configuration is chosen until someone
     * changes it. */
    onApplyTemplate: (template: HarnessTemplate) => void;
    onDismiss: () => void;
  },
) {
  const advice = plan.advice;
  const templates = templatesForScope("change");

  return (
    <section className="openspec-shell-panel" data-testid="run-dialog">
      <h3>{`Run ${changeName}`}</h3>
      <p className="openspec-shell-note" data-testid="run-dialog-because">{plan.because}.</p>

      <p className="openspec-shell-note"><strong>Which agent runs each stage</strong></p>
      <ul className="openspec-shell-note" data-testid="run-dialog-stage-agents">
        {plan.stageAgents.map((entry) => (
          <li key={entry.stage}>
            {/* A stage with no agent says so. Leaving it out would read as
                a stage that does not run. */}
            {entry.stage}: {entry.agent ?? "no agent set"}
          </li>
        ))}
      </ul>

      {/* Said either way. Rendering nothing when everything is fine makes
          "examined and fine" identical to "not examined" — the
          distinction this project has drawn four times and missed here. */}
      <p className="openspec-shell-note"><strong>What this configuration cannot do</strong></p>
      {plan.findings.length > 0 ? (
        <ul className="openspec-shell-note" data-testid="run-dialog-findings">
          {plan.findings.map((finding) => (
            <li key={`${finding.kind}-${finding.stage}`}>{finding.stage}: {finding.message}</li>
          ))}
        </ul>
      ) : (
        <p className="openspec-shell-note" data-testid="run-dialog-no-findings">
          Every ceiling configured here can act on the agent chosen for its stage.
        </p>
      )}

      {advice ? (
        <div data-testid="run-dialog-advice">
          <p className="openspec-shell-note">
            <strong>
              {advice.needsPerson
                ? "Recommended: a person should look, rather than a larger ceiling"
                : `Recommended configuration: ${advice.template?.title ?? "none"}`}
            </strong>
          </p>
          {/* The grounds travel with the answer. A recommendation whose
              reasons are hidden can only be accepted or ignored. */}
          <ul className="openspec-shell-note">
            {advice.grounds.map((ground) => <li key={ground}>{ground}</li>)}
          </ul>
        </div>
      ) : null}

      {/* A recommendation that cannot be acted on is a remark. Only the
          templates that may be written to a change are offered — the
          same `templatesForScope` the settings view uses, so a template
          refused on save is never proposed here. */}
      <p className="openspec-shell-note"><strong>Or apply a named configuration</strong></p>
      <ul className="openspec-harness-templates" data-testid="run-dialog-templates">
        {templates.map((template) => (
          <li key={template.id} data-testid={`run-dialog-template-${template.id}`}>
            <button type="button" onClick={() => onApplyTemplate(template)}>
              {template.id === advice?.template?.id ? `${template.title} (recommended)` : template.title}
            </button>
            <p className="openspec-shell-note">{template.intent}</p>
            <p className="openspec-shell-note"><strong>Not for:</strong> {template.notFor}</p>
            <p className="openspec-shell-note">{template.basis}</p>
          </li>
        ))}
      </ul>

      <div className="openspec-ai-panel-controls">
        {plan.offered.map((path) => (
          <button
            key={path.id}
            type="button"
            data-testid={`run-dialog-path-${path.id}`}
            title={path.describes}
            onClick={() => onChoose(path.id)}
          >
            {path.id === plan.resolved ? `${path.title} (configured)` : path.title}
          </button>
        ))}
        <button type="button" data-testid="run-dialog-cancel" onClick={onDismiss}>Cancel</button>
      </div>
    </section>
  );
}
