import type { RunPathId, RunPlan } from "@openspec-ui/core/browser";

// one-way-in-to-run.
//
// The standalone shell used to resolve the configuration, decide a path
// and act on it without saying what it had read. On an `assisted` change
// that looked like the button only changed tabs — a correct decision and
// a broken one were indistinguishable, because neither showed anything.
//
// So this shows the decision before making it: which path the
// configuration resolves to, why, which agent runs each stage, and any
// ceiling that cannot act. Choosing differently applies to this run only
// and writes no file — a run is not a configuration change.

export function RunDialog(
  { changeName, plan, onChoose, onDismiss }: {
    changeName: string;
    plan: RunPlan;
    onChoose: (path: RunPathId) => void;
    onDismiss: () => void;
  },
) {
  return (
    <section className="openspec-shell-panel" data-testid="run-dialog">
      <h3>{`Run ${changeName}`}</h3>
      <p className="openspec-shell-note" data-testid="run-dialog-because">{plan.because}.</p>

      {/* Headed, because the two lists below are both bullets and read as
          one list without them — found by looking at the captured
          screenshot, not by a test. */}
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

      {plan.findings.length > 0 ? (
        <>
          {/* Before the run, not after: a ceiling that cannot act is worth
              knowing while the money has not been spent. */}
          <p className="openspec-shell-note"><strong>What this configuration cannot do</strong></p>
          <ul className="openspec-shell-note" data-testid="run-dialog-findings">
            {plan.findings.map((finding) => (
              <li key={`${finding.kind}-${finding.stage}`}>{finding.stage}: {finding.message}</li>
            ))}
          </ul>
        </>
      ) : null}

      {plan.advice ? (
        <div className="openspec-shell-note" data-testid="run-dialog-advice">
          <p>
            {plan.advice.needsPerson
              ? "Recommended: a person should look, rather than a larger ceiling."
              : `Recommended configuration: ${plan.advice.template?.title ?? "none"}.`}
          </p>
          {/* The grounds travel with the answer. A recommendation whose
              reasons are hidden can only be accepted or ignored. */}
          <ul>
            {plan.advice.grounds.map((ground) => <li key={ground}>{ground}</li>)}
          </ul>
        </div>
      ) : null}

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
