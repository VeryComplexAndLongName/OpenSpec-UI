// The pipeline picture — ADR 0025.
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

import { useCallback, useEffect, useRef, useState } from "react";
import {
  describeCollision,
  layoutChanges,
  type ChangeLayout,
  type ChangeLayoutEdge,
  type ChangeLayoutNode,
  type ChangeReadinessReport,
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

export interface PipelineViewProps {
  /** Reads the report. Injected so a test never needs a server, and so
   * this component cannot quietly acquire a second way to get one. */
  load: () => Promise<ChangeReadinessReport>;
  /** Whether this is the tab being looked at. Re-reading behind a hidden
   * tab is work nobody asked for against a picture nobody sees. */
  isActive: boolean;
  onOpenChange?: (changeName: string) => void;
}

export function PipelineView({ load, isActive, onOpenChange }: PipelineViewProps) {
  const [report, setReport] = useState<ChangeReadinessReport | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [readAt, setReadAt] = useState<Date | undefined>(undefined);
  // Survives re-renders and is checked after every await: a reply that
  // arrives once the tab has been left, or after unmount, must not set
  // state — and must not be mistaken for a current reading.
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const read = useCallback(async () => {
    try {
      const next = await load();
      if (!alive.current) return;
      setReport(next);
      setReadAt(new Date());
      setError(undefined);
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [load]);

  useEffect(() => {
    if (!isActive) return;
    void read();
    const timer = setInterval(() => void read(), PIPELINE_POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isActive, read]);

  if (error !== undefined) {
    return <p className="openspec-shell-error" role="alert" data-testid="pipeline-error">{error}</p>;
  }
  if (report === undefined) {
    return <p className="openspec-shell-note" data-testid="pipeline-loading">Reading what is running…</p>;
  }
  if (report.changes.length === 0) {
    return <p className="openspec-shell-note" data-testid="pipeline-empty">No active changes.</p>;
  }

  const layout = layoutChanges(report);

  return (
    <div data-testid="pipeline">
      {layout.cycles.length > 0 ? <Cycles cycles={layout.cycles} /> : null}
      <Picture layout={layout} onOpenChange={onOpenChange} />
      {/* From the report this already read: no second fetch, and no
          suggestion computed here — `buildHints` derived them in core
          before the payload was sent. */}
      <HintList hints={report.hints} />
      <p className="openspec-shell-note" data-testid="pipeline-read-at">
        {/* A reading, not a subscription: between two of them a run can
            start and finish, so this never presents itself as live. */}
        Last read {readAt ? readAt.toLocaleTimeString() : "never"}.
      </p>
    </div>
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

function Picture({ layout, onOpenChange }: { layout: ChangeLayout; onOpenChange?: (name: string) => void }) {
  const byColumn = layout.columns.map((names, column) =>
    layout.nodes.filter((node) => node.column === column && names.includes(node.change.changeName)));

  return (
    // Its own scroller, so a wide repository never makes the page body
    // scroll sideways — the rule the shell's tables already follow.
    <div className="openspec-pipeline-scroll">
      <div
        className="openspec-pipeline-picture"
        data-testid="pipeline-picture"
        style={{ "--pipeline-w": layout.width, "--pipeline-h": layout.height } as Record<string, number>}
      >
        <Edges edges={layout.edges} width={layout.width} height={layout.height} />
        {byColumn.map((nodes, column) => (
          <div className="openspec-pipeline-lane" key={column}>
            {/* Numbered rather than named: the repository states an
                order, not stages, and a heading that invented stage names
                would be inventing something. Each card says what it
                waits on. */}
            <h3 className="openspec-pipeline-lane-heading">Step {column + 1}</h3>
            {nodes.map((node) => <Node key={node.change.changeName} node={node} onOpenChange={onOpenChange} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The declared blockers, and only those.
 *
 * `aria-hidden` because what a line draws is already on the card it
 * points from, in words. A reader who cannot see it would otherwise be
 * read the same relation twice. */
function Edges({ edges, width, height }: { edges: ChangeLayoutEdge[]; width: number; height: number }) {
  if (edges.length === 0) return null;
  return (
    <svg
      className="openspec-pipeline-edges"
      aria-hidden="true"
      focusable="false"
      data-testid="pipeline-edges"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {edges.map((edge) => (
        <path
          key={`${edge.from}->${edge.to}`}
          data-testid={`pipeline-edge-${edge.from}-to-${edge.to}`}
          d={edge.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")}
          fill="none"
        />
      ))}
    </svg>
  );
}

function Node({ node, onOpenChange }: { node: ChangeLayoutNode; onOpenChange?: (name: string) => void }) {
  const { change } = node;
  const detail = describeChange(node);
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
