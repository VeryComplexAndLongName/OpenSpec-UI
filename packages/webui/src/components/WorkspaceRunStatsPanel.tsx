import { recommendFromRunStats } from "@openspec-ui/core/browser";
import type { AgentRunGroup, WorkspaceRunStats } from "@openspec-ui/core/browser";

// What runs have cost in this workspace, shown where a person decides
// what to spend. See dialog-shows-what-runs-cost.
//
// Every figure carries the number of runs behind it. A median over
// fifteen samples and a median over two are different claims, and one
// that does not say which will be believed equally.

function money(value: number | undefined): string {
  return value === undefined ? "—" : `$${value.toFixed(2)}`;
}

function minutes(seconds: number | undefined): string {
  return seconds === undefined ? "—" : `${(seconds / 60).toFixed(1)} min`;
}

function GroupRow({ group, enoughRuns }: { group: AgentRunGroup; enoughRuns: number }) {
  const name = group.effort === undefined ? group.agent : `${group.agent} · ${group.effort}`;
  return (
    <li data-testid={`run-stats-group-${group.agent}${group.effort ? `-${group.effort}` : ""}`}>
      <strong>{name}</strong>
      {" — "}
      {group.runs} run{group.runs === 1 ? "" : "s"}, {group.completed} completed
      {group.enough ? null : (
        // Marked rather than omitted: leaving a thin group out makes "too
        // little is known here" indistinguishable from "this has never
        // run", which are different facts.
        <em data-testid="run-stats-below-threshold">{` — ${group.runs} of ${enoughRuns} needed before these figures mean much`}</em>
      )}
      <br />
      {group.costSamples === 0
        // An agent that reports nothing has runs and no costs. A cost of
        // zero would say something false; six of the ten agents report
        // nothing at all.
        ? <span>no cost reported by this agent</span>
        : <span>{`cost ${money(group.medianCostUsd)} median, ${money(group.p90CostUsd)} p90, from ${group.costSamples} run${group.costSamples === 1 ? "" : "s"}`}</span>}
      {" · "}
      <span>{`${minutes(group.medianSeconds)} median, ${minutes(group.p90Seconds)} p90`}</span>
    </li>
  );
}

/** The conclusions, above the figures they were drawn from.
 *
 * Named for what they recommend rather than for an intent chosen in
 * advance — that is what the named configurations are for. Where a
 * comparison cannot be made, the reason is shown: "nothing can be
 * compared yet" and "no comparison was attempted" look identical
 * otherwise. */
function Recommendations({ stats }: { stats: WorkspaceRunStats }) {
  const { offered, gaps } = recommendFromRunStats(stats);
  if (offered.length === 0 && gaps.length === 0) return null;
  return (
    <div data-testid="run-stats-recommendations">
      {offered.map((entry) => (
        <p className="openspec-shell-note" key={entry.kind} data-testid={`run-stats-recommendation-${entry.kind}`}>
          <strong>{entry.title}: {entry.agents.join(", ")}</strong>
          {` — ${entry.because}`}
        </p>
      ))}
      {gaps.map((gap) => (
        <p className="openspec-shell-note" key={gap.kind} data-testid={`run-stats-gap-${gap.kind}`}>
          <em>{`Not recommending on ${gap.kind.replaceAll("-", " ")}: ${gap.reason}.`}</em>
        </p>
      ))}
    </div>
  );
}

export function WorkspaceRunStatsPanel({ stats }: { stats: WorkspaceRunStats }) {
  return (
    <section data-testid="run-stats">
      <p className="openspec-shell-note"><strong>What runs have cost in this workspace</strong></p>

      {stats.runs > 0 ? <Recommendations stats={stats} /> : null}

      {stats.runs === 0 ? (
        // Not an empty space. A box that looks the same before and after a
        // run has happened gives a reader no way to tell it is working,
        // and this one will be empty for a while in a new workspace.
        <p className="openspec-shell-note" data-testid="run-stats-empty">
          {`Nothing recorded yet — ${stats.entriesRead} audit entr${stats.entriesRead === 1 ? "y" : "ies"} read`}
          {stats.entriesFromDeletedChanges > 0
            ? `, ${stats.entriesFromDeletedChanges} of them from changes that no longer exist`
            : ""}
          . Figures appear as runs accumulate.
        </p>
      ) : (
        <>
          <ul className="openspec-shell-note" data-testid="run-stats-by-agent">
            {stats.byAgent.map((group) => (
              <GroupRow key={group.agent} group={group} enoughRuns={stats.enoughRuns} />
            ))}
          </ul>

          <p className="openspec-shell-note" data-testid="run-stats-by-effort-note">
            {stats.byAgentAndEffort.length === 0
              // Said, not left blank: the effort field is recent, so this
              // grouping is empty for reasons that have nothing to do with
              // whether it works.
              ? `No run has recorded which effort it used yet — ${stats.runs} run${stats.runs === 1 ? "" : "s"} read, ${stats.runsWithEffort} with an effort.`
              : `By effort — ${stats.runsWithEffort} of ${stats.runs} runs recorded one.`}
          </p>
          {stats.byAgentAndEffort.length > 0 ? (
            <ul className="openspec-shell-note" data-testid="run-stats-by-effort">
              {stats.byAgentAndEffort.map((group) => (
                <GroupRow key={`${group.agent}-${group.effort}`} group={group} enoughRuns={stats.enoughRuns} />
              ))}
            </ul>
          ) : null}

          <p className="openspec-shell-note" data-testid="run-stats-basis">
            {`Read from ${stats.entriesRead} audit entries`}
            {stats.entriesFromDeletedChanges > 0
              // Said outright: a reader who knows some entries were set
              // aside can judge whether the rule that set them aside was
              // right, which a total alone does not allow.
              ? `, ${stats.entriesFromDeletedChanges} set aside as belonging to changes that no longer exist`
              : ""}
            .
          </p>
        </>
      )}
    </section>
  );
}
