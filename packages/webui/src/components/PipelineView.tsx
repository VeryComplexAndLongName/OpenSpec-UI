// The pipeline picture — ADR 0025 — and every other working directory of
// the repository beneath it — ADR 0026.
//
// This file draws; it decides nothing. Where each node goes, where each
// edge turns, and how wide the whole thing is were all worked out by
// `layoutChanges` in core, from the report the host read. Nothing here
// is measured: one unit is one `em` for both the cards and the SVG, so
// the two line up without either being asked where the other ended up.
//
// The same DOM is the narrow view. Below 720px the cards stop being
// positioned and the lanes they are grouped in become headed lists —
// four columns of cards do not fit a phone in any implementation, and
// the words on a card are what the edges were an illustration of.
//
// Another working directory's changes are drawn in a picture of their
// own, laid out against that directory's own queue, and carry no action
// at all: read-only is what they can do, not how they look. No relation
// is drawn between directories — the repository declares no order
// between them. See openspec/changes/what-the-others-are-doing.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  describeCollision,
  describeDirectoryRuns,
  describeRun,
  layoutChanges,
  type ChangeLayout,
  type ChangeLayoutEdge,
  type ChangeLayoutNode,
  type ChangeReadiness,
  type ChangeReadinessReport,
  type SurveyedChange,
  type SurveyedDirectory,
  type WorktreeSurvey,
} from "@openspec-ui/core/browser";
import { HintList } from "./HintList.js";

/** How often the picture re-reads while it is being looked at.
 *
 * The lease heartbeat is five seconds and a lease goes stale at twenty,
 * so a picture older than that is misleading about what is running.
 * Halfway between: often enough that a finished run does not linger,
 * seldom enough that walking the changes directory and listing git
 * worktrees is not something this does continuously. */
export const PIPELINE_POLL_INTERVAL_MS = 10_000;

/** How often the other working directories are read while the tab is
 * being looked at: less often than this directory's own picture. Nothing
 * there can be acted on from here, and a reading walks every directory
 * (ADR 0026). */
export const SURVEY_POLL_INTERVAL_MS = 30_000;

export interface PipelineViewProps {
  /** Reads the report. Injected so a test never needs a server, and so
   * this component cannot quietly acquire a second way to get one. */
  load: () => Promise<ChangeReadinessReport>;
  /** Reads every working directory of the repository. Optional: a host
   * without it shows this directory's picture alone, as before. */
  survey?: () => Promise<WorktreeSurvey>;
  /** Whether this is the tab being looked at. Re-reading behind a hidden
   * tab is work nobody asked for against a picture nobody sees. */
  isActive: boolean;
  onOpenChange?: (changeName: string) => void;
}

/** One reading, repeated while the tab is looked at. A reply that arrives
 * once the tab has been left, or after unmount, sets nothing — and is
 * never mistaken for a current reading. */
function usePolledReading<T>(load: (() => Promise<T>) | undefined, isActive: boolean, intervalMs: number) {
  const [value, setValue] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [readAt, setReadAt] = useState<Date | undefined>(undefined);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const read = useCallback(async () => {
    if (!load) return;
    try {
      const next = await load();
      if (!alive.current) return;
      setValue(next);
      setReadAt(new Date());
      setError(undefined);
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [load]);

  useEffect(() => {
    if (!isActive || !load) return;
    void read();
    const timer = setInterval(() => void read(), intervalMs);
    return () => clearInterval(timer);
  }, [isActive, load, read, intervalMs]);

  return { value, error, readAt };
}

export function PipelineView({ load, survey, isActive, onOpenChange }: PipelineViewProps) {
  const local = usePolledReading(load, isActive, PIPELINE_POLL_INTERVAL_MS);
  const others = usePolledReading(survey, isActive, SURVEY_POLL_INTERVAL_MS);

  if (local.error !== undefined) {
    return <p className="openspec-shell-error" role="alert" data-testid="pipeline-error">{local.error}</p>;
  }
  if (local.value === undefined) {
    return <p className="openspec-shell-note" data-testid="pipeline-loading">Reading what is running…</p>;
  }

  const report = local.value;
  const here = others.value?.directories.find((directory) => directory.isThis);
  const labels = new Map((others.value?.directories ?? []).map((directory) => [directory.path, directory.label]));

  return (
    <div data-testid="pipeline">
      {here ? <Reading directory={here} /> : null}
      {report.changes.length === 0
        // Names the branch it read where the survey says which: an empty
        // queue and a reading taken on a stale checkout otherwise look
        // identical.
        ? <p className="openspec-shell-note" data-testid="pipeline-empty">No active changes{here ? ` on ${branchPhrase(here)}` : ""}.</p>
        : <LocalPicture report={report} onOpenChange={onOpenChange} alsoIn={alsoInHere(here, labels)} />}
      {/* From the report this already read: no second fetch, and no
          suggestion computed here — `buildHints` derived them in core
          before the payload was sent. */}
      <HintList hints={report.hints} />
      {others.value ? <OtherDirectories survey={others.value} labels={labels} /> : null}
      {others.error !== undefined
        ? <p className="openspec-shell-note" data-testid="pipeline-survey-error">The other working directories could not be read: {others.error}</p>
        : null}
      <p className="openspec-shell-note" data-testid="pipeline-read-at">
        {/* A reading, not a subscription: between two of them a run can
            start and finish, so this never presents itself as live. */}
        Last read {local.readAt ? local.readAt.toLocaleTimeString() : "never"}
        {survey ? `; other working directories ${others.readAt ? others.readAt.toLocaleTimeString() : "not yet"}` : ""}.
      </p>
    </div>
  );
}

function branchPhrase(directory: SurveyedDirectory): string {
  if (directory.branch) return `branch ${directory.branch}`;
  if (directory.head) return `a detached head at ${directory.head.slice(0, 7)}`;
  return "no branch";
}

/** Which branch this picture was read from, and what this directory's own
 * runs say they are doing. */
function Reading({ directory }: { directory: SurveyedDirectory }) {
  return (
    <div className="openspec-pipeline-reading" data-testid="pipeline-reading">
      <p className="openspec-shell-note" data-testid="pipeline-reading-branch">
        Read from {branchPhrase(directory)} in {directory.label}.
      </p>
      <ul className="openspec-shell-note" data-testid="pipeline-reading-runs">
        {describeDirectoryRuns(directory).map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    </div>
  );
}

/** For each change here, the labels of the other directories that hold a
 * change of the same name. */
function alsoInHere(here: SurveyedDirectory | undefined, labels: Map<string, string>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!here?.readable) return result;
  for (const change of here.changes) {
    if (change.alsoIn.length > 0) result.set(change.changeName, change.alsoIn.map((other) => labels.get(other) ?? other));
  }
  return result;
}

function LocalPicture({ report, onOpenChange, alsoIn }: {
  report: ChangeReadinessReport;
  onOpenChange?: (name: string) => void;
  alsoIn: Map<string, string[]>;
}) {
  const layout = layoutChanges(report);
  return (
    <>
      {layout.cycles.length > 0 ? <Cycles cycles={layout.cycles} /> : null}
      <Picture
        layout={layout}
        testIdPrefix="pipeline-"
        laneHeading="h3"
        renderNode={(node) => (
          <Node key={node.change.changeName} node={node} onOpenChange={onOpenChange} alsoIn={alsoIn.get(node.change.changeName)} />
        )}
      />
    </>
  );
}

/** A cycle has no depth and so no column. Said in words, above the
 * picture, rather than placed somewhere plausible. */
function Cycles({ cycles }: { cycles: string[][] }) {
  return (
    <div className="openspec-pipeline-cycles" role="alert" data-testid="pipeline-cycles">
      <p>
        {cycles.length === 1 ? "These changes declare a cycle" : "These changes declare cycles"}
        {" "}of blockers, so they have no place in an order. Nothing waiting on them can be placed either.
      </p>
      <ul>
        {cycles.map((cycle) => <li key={cycle.join(",")}>{cycle.join(" → ")} → {cycle[0]}</li>)}
      </ul>
    </div>
  );
}

function Picture({ layout, testIdPrefix, laneHeading, renderNode }: {
  layout: ChangeLayout;
  testIdPrefix: string;
  laneHeading: "h3" | "h5";
  renderNode: (node: ChangeLayoutNode) => ReactNode;
}) {
  const byColumn = layout.columns.map((names, column) =>
    layout.nodes.filter((node) => node.column === column && names.includes(node.change.changeName)));
  const Heading = laneHeading;

  return (
    // Its own scroller, so a wide repository never makes the page body
    // scroll sideways — the rule the shell's tables already follow.
    <div className="openspec-pipeline-scroll">
      <div
        className="openspec-pipeline-picture"
        data-testid={`${testIdPrefix}picture`}
        style={{ "--pipeline-w": layout.width, "--pipeline-h": layout.height } as Record<string, number>}
      >
        <Edges edges={layout.edges} width={layout.width} height={layout.height} testIdPrefix={testIdPrefix} />
        {byColumn.map((nodes, column) => (
          <div className="openspec-pipeline-lane" key={column}>
            {/* Numbered rather than named: the repository states an
                order, not stages, and a heading that invented stage names
                would be inventing something. Each card says what it
                waits on. */}
            <Heading className="openspec-pipeline-lane-heading">Step {column + 1}</Heading>
            {nodes.map(renderNode)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The declared blockers, and only those, within one directory's picture.
 *
 * `aria-hidden` because what a line draws is already on the card it
 * points from, in words. A reader who cannot see it would otherwise be
 * read the same relation twice. */
function Edges({ edges, width, height, testIdPrefix }: {
  edges: ChangeLayoutEdge[];
  width: number;
  height: number;
  testIdPrefix: string;
}) {
  if (edges.length === 0) return null;
  return (
    <svg
      className="openspec-pipeline-edges"
      aria-hidden="true"
      focusable="false"
      data-testid={`${testIdPrefix}edges`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {edges.map((edge) => (
        <path
          key={`${edge.from}->${edge.to}`}
          data-testid={`${testIdPrefix}edge-${edge.from}-to-${edge.to}`}
          d={edge.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")}
          fill="none"
        />
      ))}
    </svg>
  );
}

function Node({ node, onOpenChange, alsoIn }: {
  node: ChangeLayoutNode;
  onOpenChange?: (name: string) => void;
  alsoIn?: string[];
}) {
  const { change } = node;
  const detail = [...describeChange(node), ...(alsoIn && alsoIn.length > 0 ? [`also in ${alsoIn.join(", ")}`] : [])];
  return (
    <button
      type="button"
      className="openspec-pipeline-node"
      data-testid={`pipeline-node-${change.changeName}`}
      data-state={change.run.state}
      // The coordinates core returned, in units the stylesheet turns into
      // `em`. In the narrow view the stylesheet ignores them.
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      // The whole of the text, for a reader whose card clipped it.
      title={`${change.changeName} — ${detail.join(" ")}`}
      onClick={() => onOpenChange?.(change.changeName)}
    >
      <span className="openspec-pipeline-node-name">{change.changeName}</span>
      {/* The state as a word, not only as a colour — two hues a reader
          cannot tell apart must still be two states. */}
      <span className="openspec-pipeline-node-state">{stateWord(node)}</span>
      {detail.map((line, index) => (
        // Clipped by the card, present in full in the DOM: a fixed card
        // must not be able to remove a fact the change is required to
        // state.
        <span className="openspec-pipeline-node-detail" key={index}>{line}</span>
      ))}
    </button>
  );
}

function stateWord(node: ChangeLayoutNode): string {
  switch (node.change.run.state) {
    case "running":
      return "Running";
    case "blocked":
      return "Blocked";
    case "ready":
      return "Ready";
  }
}

/** What this change has to say for itself, in the order a reader wants
 * it. Sentences rather than fields: the terminal's `ready` says the same
 * things the same way, and two surfaces wording one fact differently is
 * two facts as far as a reader is concerned. */
function describeChange(node: ChangeLayoutNode): string[] {
  const { change } = node;
  const lines: string[] = [];

  if (change.run.state === "running") {
    lines.push(`in ${change.run.worktreePath}`);
    // "git author", never "user": self-declared, and nothing is gated on
    // it (a-lease-says-who). A run that recorded none claims nothing.
    if (change.run.holder.author) lines.push(`git author ${change.run.holder.author}`);
  }

  if (change.run.state === "blocked") lines.push(`waiting on ${change.run.blockedBy.join(", ")}`);

  if (change.run.state === "ready") {
    if (change.needsWorktree) lines.push(`no working directory of its own — ${change.needsWorktree}`);
    else if (change.canJoin.length > 0) lines.push(`can start alongside ${change.canJoin.join(", ")}`);
    else if (change.blockedFrom.length === 0) lines.push("nothing else can start alongside it");
    for (const other of change.blockedFrom) {
      lines.push(`not with ${other.changeName} — ${other.collisions.map(describeCollision).join("; ")}`);
    }
  }

  return lines;
}

/** Every working directory other than this one, each in its own
 * recessed section with its own picture. */
function OtherDirectories({ survey, labels }: { survey: WorktreeSurvey; labels: Map<string, string> }) {
  const others = survey.directories.filter((directory) => !directory.isThis);
  if (others.length === 0 && survey.runsElsewhere.length === 0) return null;
  return (
    <div className="openspec-pipeline-others" data-testid="pipeline-others">
      <h3 className="openspec-pipeline-others-heading">Other working directories</h3>
      <p className="openspec-shell-note">
        Read here and never acted on: nothing below can be opened, run or changed from this checkout.
      </p>
      {others.map((directory, index) => (
        <OtherDirectory key={directory.path} directory={directory} index={index} labels={labels} />
      ))}
      {survey.runsElsewhere.length > 0 ? (
        <div data-testid="pipeline-runs-elsewhere">
          <p className="openspec-shell-note">
            Runs reporting from a directory that is no longer a working directory of this repository:
          </p>
          <ul className="openspec-shell-note">
            {survey.runsElsewhere.map((run) => <li key={run.instanceId}>{`${run.workingDirectory} — ${describeRun(run)}`}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OtherDirectory({ directory, index, labels }: {
  directory: SurveyedDirectory;
  index: number;
  labels: Map<string, string>;
}) {
  const testId = `pipeline-directory-${index}`;
  return (
    <section className="openspec-pipeline-directory" data-testid={testId} aria-label={`Working directory ${directory.label}`}>
      <h4 className="openspec-pipeline-directory-label">{directory.label}</h4>
      <p className="openspec-shell-note" data-testid={`${testId}-where`}>{`${branchPhrase(directory)} — ${directory.path}`}</p>
      {directory.readable && directory.holder ? (
        <p
          className="openspec-shell-note openspec-pipeline-directory-holder"
          data-testid={`${testId}-holder`}
          data-author-differs={directory.authorDiffers ? "true" : "false"}
        >
          {/* Said in words; the stylesheet only agrees with them. */}
          {"Held by a run"}
          {directory.holder.author ? ` — git author ${directory.holder.author}` : ""}
          {directory.authorDiffers ? ", a different git author from this checkout's" : ""}.
        </p>
      ) : null}
      <ul className="openspec-shell-note" data-testid={`${testId}-runs`}>
        {describeDirectoryRuns(directory).map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
      </ul>
      {directory.readable ? <ForeignChanges directory={directory} testId={testId} labels={labels} /> : null}
    </section>
  );
}

/** A surveyed change as the layout's input. Only its own blockers are
 * relations; nothing is known about collisions in another directory, and
 * nothing is computed. */
function asLayoutInput(change: SurveyedChange): ChangeReadiness {
  return {
    changeName: change.changeName,
    blockers: change.blockers,
    run: change.blockers.length > 0 ? { state: "blocked", blockedBy: change.blockers } : { state: "ready" },
    capabilities: [],
    canJoin: [],
    blockedFrom: [],
  };
}

function ForeignChanges({ directory, testId, labels }: {
  directory: Extract<SurveyedDirectory, { readable: true }>;
  testId: string;
  labels: Map<string, string>;
}) {
  if (directory.changes.length === 0) {
    return <p className="openspec-shell-note" data-testid={`${testId}-empty`}>No active changes on {branchPhrase(directory)}.</p>;
  }
  const layout = layoutChanges({ changes: directory.changes.map(asLayoutInput) });
  const byName = new Map(directory.changes.map((change) => [change.changeName, change]));
  return (
    <>
      {layout.cycles.length > 0 ? <Cycles cycles={layout.cycles} /> : null}
      <Picture
        layout={layout}
        testIdPrefix={`${testId}-`}
        laneHeading="h5"
        renderNode={(node) => (
          <ForeignNode
            key={node.change.changeName}
            node={node}
            change={byName.get(node.change.changeName)}
            labels={labels}
            testId={`${testId}-node-${node.change.changeName}`}
          />
        )}
      />
    </>
  );
}

/** A card with no action. Not a button, not focusable, no handler: a
 * change is the pair (directory, name), and nothing here may reach the
 * change of the same name in this checkout (ADR 0026). */
function ForeignNode({ node, change, labels, testId }: {
  node: ChangeLayoutNode;
  change: SurveyedChange | undefined;
  labels: Map<string, string>;
  testId: string;
}) {
  const name = node.change.changeName;
  const lines = [
    change?.tasksUnreadable
      ? `tasks could not be read: ${change.tasksUnreadable}`
      : `${change?.tasksDone ?? 0} of ${change?.tasksTotal ?? 0} tasks done`,
    ...(node.change.blockers.length > 0 ? [`waiting on ${node.change.blockers.join(", ")}`] : []),
    ...(change && change.alsoIn.length > 0 ? [`also in ${change.alsoIn.map((other) => labels.get(other) ?? other).join(", ")}`] : []),
  ];
  return (
    <div
      className="openspec-pipeline-node openspec-pipeline-node--foreign"
      data-testid={testId}
      data-state="foreign"
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      title={`${name} — ${lines.join(" ")}`}
    >
      <span className="openspec-pipeline-node-name">{name}</span>
      {lines.map((line, index) => <span className="openspec-pipeline-node-detail" key={index}>{line}</span>)}
    </div>
  );
}
