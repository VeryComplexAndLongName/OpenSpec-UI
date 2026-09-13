import { describeVerifyQuality, ENOUGH_VERIFIES, recommendFromRunStats } from "@openspec-ui/core/browser";
import type { AgentRunGroup, VerifyQuality, WorkspaceRunStats } from "@openspec-ui/core/browser";

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
 * otherwise.
 *
 * Where the host can write the change's configuration, each agent a
 * recommendation names can be put on every stage from here. A
 * recommendation that cannot be acted on is a remark; one agent per
 * button, because a tie names several and choosing between them is the
 * reader's. See a-change-is-configured-from-the-change. */
function Recommendations(
  { stats, onUseAgent, useAgentNote }:
  { stats: WorkspaceRunStats; onUseAgent?: (agentId: string) => void; useAgentNote?: string | null },
) {
  const { offered, gaps } = recommendFromRunStats(stats);
  if (offered.length === 0 && gaps.length === 0) return null;
  // One button per agent, however many recommendations name it. An agent
  // that is cheapest, fastest and most likely to finish is one choice,
  // and three identical buttons would read as three different ones.
  const agents = [...new Set(offered.flatMap((entry) => entry.agents))];
  return (
    <div data-testid="run-stats-recommendations">
      {offered.map((entry) => (
        <p className="openspec-shell-note" key={entry.kind} data-testid={`run-stats-recommendation-${entry.kind}`}>
          <strong>{entry.title}: {entry.agents.join(", ")}</strong>
          {` — ${entry.because}`}
        </p>
      ))}
      {onUseAgent && agents.length > 0 ? (
        <div className="openspec-ai-panel-controls">
          {agents.map((agent) => (
            <button
              key={agent}
              type="button"
              data-testid={`run-stats-use-${agent}`}
              onClick={() => onUseAgent(agent)}
            >
              {`Use ${agent} for every stage`}
            </button>
          ))}
        </div>
      ) : null}
      {useAgentNote ? (
        <p className="openspec-shell-note" role="status" data-testid="run-stats-use-agent-status">{useAgentNote}</p>
      ) : null}
      {gaps.map((gap) => (
        <p className="openspec-shell-note" key={gap.kind} data-testid={`run-stats-gap-${gap.kind}`}>
          <em>{`Not recommending on ${gap.kind.replaceAll("-", " ")}: ${gap.reason}.`}</em>
        </p>
      ))}
    </div>
  );
}

/** What the verifying stages found, beside what the runs cost.
 *
 * Two questions about the same log: an agent that is cheap and fails its
 * checks is not the cheap one. Rendered even when it has nothing to say,
 * because "no verify has reported yet" and "every verify passed" are
 * different facts and an empty space says neither.
 *
 * See quality-of-what-a-verify-found and
 * quality-is-charged-to-the-agent-whose-work-was-checked. */
function VerifyQualityBlock({ quality }: { quality: VerifyQuality }) {
  return (
    <div data-testid="verify-quality">
      <p className="openspec-shell-note">
        <strong>What the verifying stages found, by the agent whose work was checked</strong>
      </p>
      <p className="openspec-shell-note" data-testid="verify-quality-basis">{describeVerifyQuality(quality)}</p>
      {quality.byAgent.length > 0 ? (
        <ul className="openspec-shell-note" data-testid="verify-quality-by-agent">
          {quality.byAgent.map((group) => (
            <li key={group.agent}>
              <strong>{group.agent}</strong>
              {` — ${group.withFailures} of ${group.verifies} verifying stage${group.verifies === 1 ? "" : "s"}`}
              {` found something; ${group.checksFailed} of ${group.checksRan} checks failed`}
              {/* The threshold travels with the figure: a rate over two
                  stages is an accumulation, not an answer. */}
              {group.enough ? "" : ` (too few to read as a rate — fewer than ${ENOUGH_VERIFIES})`}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function WorkspaceRunStatsPanel(
  { stats, quality, onUseAgent, useAgentNote }: {
    stats: WorkspaceRunStats;
    /** What the verifying stages found. Absent in a host that reads the
     * figures without it — then the block is not rendered rather than
     * rendered empty, which would claim every verify passed. */
    quality?: VerifyQuality;
    /** Puts one agent on every stage of the change being run. Absent
     * where there is no change to write to, and then no button is shown. */
    onUseAgent?: (agentId: string) => void;
    /** What the host says the last use of an agent wrote, and where. */
    useAgentNote?: string | null;
  },
) {
  return (
    <section data-testid="run-stats">
      <p className="openspec-shell-note"><strong>What runs have cost in this workspace</strong></p>

      {stats.runs > 0 ? (
        <Recommendations
          stats={stats}
          {...(onUseAgent ? { onUseAgent } : {})}
          {...(useAgentNote !== undefined ? { useAgentNote } : {})}
        />
      ) : null}

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

      {quality ? <VerifyQualityBlock quality={quality} /> : null}
    </section>
  );
}
