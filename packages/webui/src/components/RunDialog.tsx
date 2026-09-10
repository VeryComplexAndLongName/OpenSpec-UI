import { useState } from "react";
import {
  checkScheduleTime,
  resolveEffortLevel,
  templatesForScope,
  type HarnessEffortLevel,
  type HarnessTemplate,
  type RunPathId,
  type RunPlan,
  type VerifyQuality,
  type WorkspaceRunStats,
} from "@openspec-ui/core/browser";
import { WorkspaceRunStatsPanel } from "./WorkspaceRunStatsPanel.js";

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

/** What a level means for the agents this change would actually use.
 *
 * A configuration carries a level rather than a value, because `max` is
 * a value `claude` accepts and `codex` does not. Resolving it here is
 * what lets the dialog say what applying one would set, before it is
 * applied — and say plainly when the answer is "nothing", which is the
 * case for the five agents that take no effort setting at all. */
function effortNote(
  level: HarnessEffortLevel,
  stageAgents: RunPlan["stageAgents"],
): string {
  const agents = [...new Set(stageAgents.map((entry) => entry.agent).filter((agent): agent is string => !!agent))];
  if (agents.length === 0) return `${level} of what each agent accepts — no agent is configured yet`;
  const resolved = agents.map((agent) => ({ agent, effort: resolveEffortLevel(agent, level).effort }));
  const withEffort = resolved.filter((entry) => entry.effort !== undefined);
  if (withEffort.length === 0) {
    // Said rather than left to be noticed: for these agents the four
    // configurations differ in their ceilings alone.
    return `${level} — ${agents.join(", ")} takes no effort setting, so only the ceilings differ`;
  }
  const none = resolved.filter((entry) => entry.effort === undefined).map((entry) => entry.agent);
  return `${level} — ${withEffort.map((entry) => `${entry.agent} ${entry.effort}`).join(", ")}`
    + (none.length === 0 ? "" : `; ${none.join(", ")} takes no effort setting`);
}

export function RunDialog(
  { changeName, plan, stats, note, onChoose, onApplyTemplate, onSchedule, onDismiss }: {
    changeName: string;
    plan: RunPlan;
    /** What the workspace's recorded runs have cost. Absent where it
     * could not be read — shown as nothing rather than as zeroes, which
     * would be a claim. */
    stats?: WorkspaceRunStats & { quality?: VerifyQuality };
    onChoose: (path: RunPathId) => void;
    /** Applying a named configuration writes the change's file. That is
     * deliberate and is not the path override, which writes nothing: a
     * path is chosen for one run, a configuration is chosen until someone
     * changes it. */
    onApplyTemplate: (template: HarnessTemplate) => void;
    /** Asking for a run at a time rather than now. Absent in a host that
     * cannot keep a schedule, and then the section is not rendered at
     * all — an unusable control is the defect this dialog exists to
     * remove. See a-run-can-be-scheduled. */
    onSchedule?: (path: RunPathId, startAt: string) => void;
    /** Why this dialog is open, when something other than a person
     * opened it — a schedule that came due, and how late it is. */
    note?: string;
    onDismiss: () => void;
  },
) {
  const advice = plan.advice;
  const templates = templatesForScope("change");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleProblem, setScheduleProblem] = useState<string | undefined>(undefined);

  function schedule(path: RunPathId): void {
    // A local `datetime-local` value has no zone; the person means their
    // own clock, which is what `new Date()` reads it as.
    const startAt = new Date(scheduleAt).toISOString();
    const problem = checkScheduleTime(startAt, new Date());
    setScheduleProblem(problem);
    if (problem) return;
    onSchedule?.(path, startAt);
  }

  return (
    <section className="openspec-shell-panel" data-testid="run-dialog">
      <h3>{`Run ${changeName}`}</h3>
      {/* Said before anything else: this dialog opening by itself is a
          different event from a person opening it, and which one it was
          has to be legible. */}
      {note ? <p className="openspec-shell-note" data-testid="run-dialog-note"><strong>{note}</strong></p> : null}
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

      {stats ? <WorkspaceRunStatsPanel stats={stats} {...(stats.quality ? { quality: stats.quality } : {})} /> : null}

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
            <p className="openspec-shell-note" data-testid={`run-dialog-template-${template.id}-effort`}>
              <strong>Effort:</strong> {effortNote(template.effortLevel, plan.stageAgents)}
            </p>
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

      {onSchedule ? (
        <div data-testid="run-dialog-schedule">
          <p className="openspec-shell-note"><strong>Or start it at a time</strong></p>
          <label className="openspec-shell-field">
            Start at
            <input
              type="datetime-local"
              aria-label="Start at"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </label>
          <div className="openspec-ai-panel-controls">
            {plan.offered.map((path) => (
              <button
                key={`schedule-${path.id}`}
                type="button"
                data-testid={`run-dialog-schedule-${path.id}`}
                disabled={scheduleAt.trim().length === 0}
                onClick={() => schedule(path.id)}
              >
                {`Schedule: ${path.title}`}
              </button>
            ))}
          </div>
          {scheduleProblem
            ? <p className="openspec-shell-note" data-testid="run-dialog-schedule-problem">{scheduleProblem}</p>
            : null}
          {/* The limit, said before it is relied on rather than
              discovered afterwards. */}
          <p className="openspec-shell-note">
            A scheduled run needs this application open at that time. If it is closed, the run starts the next
            time you open it, and says how late it is.
          </p>
        </div>
      ) : null}
    </section>
  );
}
