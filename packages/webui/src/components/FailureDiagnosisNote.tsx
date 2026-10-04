// What is known about why a run failed, shown beneath the failure —
// the-supervisor-advises.
//
// This file renders; it diagnoses nothing. The diagnosis was made once, in
// core's agent runner, and rides the `failed` event and the run's log, so
// both hosts and the terminal show the same words for one failure.
//
// Nothing for an unknown cause: a line saying nothing is known is noise
// beneath a reason that already says what is. The remedy's commands are
// text a person selects and copies, never a control that runs them.

import { describeDiagnosis, type FailureDiagnosis } from "@openspec-ui/core/browser";

export interface FailureDiagnosisNoteProps {
  diagnosis: FailureDiagnosis | undefined;
}

export function FailureDiagnosisNote({ diagnosis }: FailureDiagnosisNoteProps): JSX.Element | null {
  if (diagnosis === undefined || diagnosis.cause === "unknown") return null;
  return (
    <div className="openspec-shell-note openspec-failure-diagnosis" data-testid="failure-diagnosis" role="note">
      <p><strong>{describeDiagnosis(diagnosis)}</strong></p>
      {diagnosis.evidence !== undefined ? <p>It printed: <code>{diagnosis.evidence}</code></p> : null}
      {diagnosis.remedy !== undefined ? <p>{diagnosis.remedy}</p> : null}
      {(diagnosis.commands ?? []).map((command) => (
        <pre key={command} className="openspec-hint-command">{command}</pre>
      ))}
    </div>
  );
}
