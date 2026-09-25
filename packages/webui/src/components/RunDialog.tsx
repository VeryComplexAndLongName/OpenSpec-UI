import { useEffect, useRef, useState } from "react";
import {
  checkScheduleTime,
  groupHarnessFindings,
  resolveEffortLevel,
  type ChangeStateKey,
  type DescribedChangeState,
  type HarnessEffortLevel,
  type HarnessTemplate,
  type RunPathId,
  type RunPlan,
  type VerifyQuality,
  type WorkspaceRunStats,
} from "@openspec-ui/core/browser";
import { NamedConfigurationPicker } from "./NamedConfigurationPicker.js";
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
// fine. The named configurations were then four bordered titles that read
// as text, and what applying one wrote was said above the dialog, out of
// view. They are one list now, and the answer is said beside the button
// that asked. See a-change-is-configured-from-the-change.

/** What a level means for the agents this change would actually use.
 *
 * A configuration carries a level rather than a value, because `max` is
 * a value `claude` accepts and `codex` does not. Resolving it here is
 * what lets the dialog say what applying one would set, before it is
 * applied — and say plainly when the answer is "nothing", which is the
 * case for the five agents that take no effort setting at all. */
export function effortNote(
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

/** The words that make the dialog ask before any path can start: the change
 * is being worked on now, or is settled somewhere else. It asks rather than
 * refuses, since ADR 0026 forbids nothing (a-change-says-where-it-stands). */
const ASKS_FIRST: ReadonlySet<ChangeStateKey> = new Set<ChangeStateKey>([
  "running",
  "running-elsewhere",
  "waiting",
  "waiting-elsewhere",
  "archived-on-main",
  "merged",
  "deleted-on-main",
]);

export function RunDialog(
  { changeName, plan, standing, stats, note, onChoose, onApplyTemplate, appliedNote, onUseAgent, useAgentNote, onSchedule, onDismiss }: {
    changeName: string;
    plan: RunPlan;
    /** Where the change stands across the repository, read after a fresh
     * fetch. Shown first. Absent where it could not be read. */
    standing?: DescribedChangeState;
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
    /** What the host says the last apply wrote, and where. Shown beside
     * the Apply button rather than above the dialog. */
    appliedNote?: string | null;
    /** Puts one agent a run-statistics recommendation names on every stage
     * of this change. Absent, the recommendations stay remarks. */
    onUseAgent?: (agentId: string) => void;
    useAgentNote?: string | null;
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
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleProblem, setScheduleProblem] = useState<string | undefined>(undefined);
  const [startAnyway, setStartAnyway] = useState(false);
  const container = useRef<HTMLElement | null>(null);
  const asksFirst = standing !== undefined && ASKS_FIRST.has(standing.key);
  const held = asksFirst && !startAnyway;

  // A dialog that opened by itself takes focus, so a screen reader says
  // a run dialog appeared without anyone asking for it just now. Only
  // then: stealing focus from a person who pressed the button would move
  // them away from what they were reading. `note` is set by a schedule
  // and by nothing else. See a-schedule-keeps-its-promise.
  useEffect(() => {
    if (note) container.current?.focus();
  }, [note]);

  function schedule(path: RunPathId): void {
    // Checked before it is converted: `toISOString()` throws a
    // `RangeError` on a value no date can be made of. A local
    // `datetime-local` value has no zone; the person means their own
    // clock, which is what `new Date()` reads it as, here and in the check.
    const problem = checkScheduleTime(scheduleAt, new Date());
    setScheduleProblem(problem);
    if (problem) return;
    onSchedule?.(path, new Date(scheduleAt).toISOString());
  }

  return (
    <section
      className="openspec-panel openspec-run-dialog"
      data-testid="run-dialog"
      ref={container}
      role="dialog"
      aria-label={`Run ${changeName}`}
      tabIndex={-1}
    >
      {/* A panel with its head, as every redrawn screen has
          (the-remaining-tabs-wear-metro 4.5); the dialog role, the focus
          and every testid are what they were. */}
      <div className="openspec-panel-head"><h2>{`Run ${changeName}`}</h2></div>
      {/* Said before anything else: this dialog opening by itself is a
          different event from a person opening it, and which one it was
          has to be legible. */}
      {note ? <p className="openspec-shell-note" data-testid="run-dialog-note"><strong>{note}</strong></p> : null}
      {standing ? (
        <div
          className={`openspec-change-standing-block openspec-change-standing--${standing.colour}`}
          data-testid="run-dialog-standing"
        >
          <p className="openspec-shell-note"><strong>{standing.word}</strong></p>
          {standing.lines.length > 0 ? (
            <ul className="openspec-shell-note">
              {standing.lines.map((line) => <li key={`${line.text}-${line.source}`}>{`${line.text} (${line.source})`}</li>)}
            </ul>
          ) : null}
          {asksFirst ? (
            <label className="openspec-shell-note">
              <input
                type="checkbox"
                data-testid="run-dialog-start-anyway"
                checked={startAnyway}
                onChange={(e) => setStartAnyway(e.target.checked)}
              />
              {" Start it anyway"}
            </label>
          ) : null}
        </div>
      ) : null}
      <p className="openspec-shell-note" data-testid="run-dialog-because">{plan.because}.</p>
      {/* Where a press begins, before what runs each stage: a change almost
          done read as a change about to be proposed again
          (the-run-dialog-says-where-it-starts). */}
      {plan.startsAt ? (
        <p className="openspec-shell-note" data-testid="run-dialog-starts-at"><strong>{plan.startsAt.says}</strong></p>
      ) : null}
      {plan.withheld ? (
        <p className="openspec-shell-note" data-testid="run-dialog-withheld">{plan.withheld.says}</p>
      ) : null}

      {/* Headed, because the two lists below are both bullets and read as
          one list without them. */}
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
          "examined and fine" identical to "not examined". */}
      <p className="openspec-shell-note"><strong>What this configuration cannot do</strong></p>
      {plan.findings.length > 0 ? (
        <ul className="openspec-shell-note" data-testid="run-dialog-findings">
          {/* Said once each, naming every stage it holds on
              (a-warning-is-said-once). */}
          {groupHarnessFindings(plan.findings).map((group) => (
            <li key={`${group.kind}-${group.agent}-${group.stages.join("-")}`}>{group.message}</li>
          ))}
        </ul>
      ) : (
        <p className="openspec-shell-note" data-testid="run-dialog-no-findings">
          Every ceiling configured here can act on the agent chosen for its stage.
        </p>
      )}

      {stats ? (
        <WorkspaceRunStatsPanel
          stats={stats}
          {...(stats.quality ? { quality: stats.quality } : {})}
          {...(onUseAgent ? { onUseAgent } : {})}
          {...(useAgentNote !== undefined ? { useAgentNote } : {})}
        />
      ) : null}

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
          configurations a change may be given are offered — the same
          `templatesForScope` the settings views use, so one refused on
          save is never proposed here. */}
      <NamedConfigurationPicker
        scope="change"
        {...(advice?.template?.id ? { recommendedId: advice.template.id } : {})}
        describeEffort={(template) => effortNote(template.effortLevel, plan.stageAgents)}
        onApply={onApplyTemplate}
        status={appliedNote ?? null}
        note={`Applying one writes openspec/changes/${changeName}/harness.json, and this dialog then shows what the change resolves to.`}
        testIdPrefix="run-dialog"
      />

      <div className="openspec-ai-panel-controls">
        {plan.offered.map((path) => (
          <button
            key={path.id}
            type="button"
            // The configured path is the one this dialog recommends.
            className={path.id === plan.resolved ? "button primary" : "button"}
            data-testid={`run-dialog-path-${path.id}`}
            title={path.describes}
            disabled={held}
            onClick={() => onChoose(path.id)}
          >
            {path.id === plan.resolved ? `${path.title} (configured)` : path.title}
          </button>
        ))}
        <button className="button" type="button" data-testid="run-dialog-cancel" onClick={onDismiss}>Cancel</button>
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
              <button className="button"
                key={`schedule-${path.id}`}
                type="button"
                data-testid={`run-dialog-schedule-${path.id}`}
                disabled={held}
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
