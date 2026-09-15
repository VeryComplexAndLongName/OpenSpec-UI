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

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  NODE_HEIGHT,
  describeChangeCard,
  describeChangeCards,
  describeCollision,
  describeDirectoryRuns,
  describeRun,
  describeTaskRows,
  fitPipelineCardDetails,
  layoutChanges,
  pipelineCardDetailLines,
  pipelineOpenCardHeight,
  runsShownOnCards,
  STOP_REQUEST_READ_WITHIN_MS,
  type ChangeCard,
  type ChangeLayout,
  type ChangeLayoutEdge,
  type ChangeLayoutNode,
  type ChangeReadiness,
  type ChangeReadinessReport,
  type ChangeStandings,
  type LastRunsReport,
  type LiveRun,
  type SurveyedChange,
  type SurveyedDirectory,
  type SurveyedTask,
  type TaskRow,
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

/** How often a view that is told when to read reads anyway.
 *
 * A host that watches files signals what they change, but some things
 * raise no file event it sees: git's list of working directories, and a
 * record or a lease going stale by the clock alone. A minute bounds how
 * late those appear. See the-pipeline-opens-in-vs-code. */
export const PIPELINE_BACKSTOP_INTERVAL_MS = 60_000;

/** How often the view draws itself again, reading nothing, so the ages it
 * states keep counting between readings. */
export const PIPELINE_CLOCK_INTERVAL_MS = 5_000;
/** How long after a card's control the card reads its run again: long
 * enough for the run's record to have been written. */
export const RUN_CONTROL_REREAD_MS = 1_000;

/** The two readings a host can say are out of date. */
export type PipelineReading = "readiness" | "survey";

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
  /** A host that knows when a reading is out of date — the editor, which
   * watches the files — says so here, and the view reads on its word and
   * on `PIPELINE_BACKSTOP_INTERVAL_MS` instead of on its own clock.
   * Returns the unsubscribe. Absent, the view polls as it always has.
   * Must be stable across renders, or each render subscribes again. */
  subscribe?: (listener: (reading: PipelineReading) => void) => () => void;
  /** Fetches the repository's refs now, and says when they were last fetched
   * and what failed. The view then reads everything again. Absent, no
   * Refresh is offered (a-change-says-where-it-stands). */
  refresh?: () => Promise<string>;
  /** Reads how each change's last run ended. Read together with the
   * survey — on its interval, or on its signal — because a run ending is
   * what changes both (a-card-says-what-its-change-is-doing). */
  lastRuns?: () => Promise<LastRunsReport>;
  /** Reads where each change stands across the repository, with refs
   * fetched only where they are older than the fetch interval. Read with
   * the survey, so a card's word is the one the Changes list gives
   * (ADR 0029's amendment of 2026-09-13). Absent, a card's word is asked
   * about this checkout's copy alone. */
  standings?: () => Promise<ChangeStandings>;
  /** Reads the runs this host started and holds. A card offers to answer,
   * stop or stop now only a run among these (a-change-is-run-from-its-card).
   * Absent, no card offers any of them. `myLabel` is the roster label of the
   * host's own key, where it is enrolled: a card offers Stop on a run held
   * elsewhere only when that run is this person's, by its verified record
   * (a-run-elsewhere-can-be-asked-to-stop). */
  liveRuns?: () => Promise<{ runs: LiveRun[]; myLabel?: string }>;
  /** Sends a control for a held run: the host adds where it runs. */
  onRunControl?: (control: RunControl) => void;
  /** Starts a change: the host opens its run dialog. Absent, no Start. */
  onStart?: (changeName: string) => void;
  /** Copies text — a run's folder — for a host that allows it. */
  copyText?: (text: string) => Promise<void>;
  /** Keeps the zoom and the open cards for this viewer, where the host can.
   * A reader or writer that throws leaves the default zoom and every card
   * closed (a-card-opens-to-its-tasks). */
  viewState?: { read(): PipelineViewMemory | undefined; write(memory: PipelineViewMemory): void };
  /** Asks a run held elsewhere to stop, through the signed channel, with the
   * host's own key. Absent, no card offers it. */
  onAskToStop?: (request: AskToStop) => void;
}

/** The zoom steps the picture offers, as factors of its unit. */
export const PIPELINE_ZOOM_STEPS: readonly number[] = [0.75, 0.9, 1, 1.25, 1.5];
const DEFAULT_ZOOM = 1;

/** What a viewer left the picture as: its zoom, and the open cards, each by
 * the directory it is drawn for and its change's name. */
export interface PipelineViewMemory {
  zoom: number;
  open: Array<{ directory: string; changeName: string }>;
}

/** Which cards are open, by the directory a card is drawn for and its
 * change's name: a change is the pair, never the name alone (ADR 0026). */
interface OpenCards {
  isOpen(directory: string, changeName: string): boolean;
  toggle(directory: string, changeName: string): void;
}

function openKey(directory: string, changeName: string): string {
  return JSON.stringify([directory, changeName]);
}

function readViewMemory(viewState: PipelineViewProps["viewState"]): { zoom: number; open: string[] } {
  try {
    const memory = viewState?.read() as Partial<PipelineViewMemory> | undefined;
    if (typeof memory !== "object" || memory === null) return { zoom: DEFAULT_ZOOM, open: [] };
    const zoom = typeof memory.zoom === "number" && PIPELINE_ZOOM_STEPS.includes(memory.zoom) ? memory.zoom : DEFAULT_ZOOM;
    const entries: unknown[] = Array.isArray(memory.open) ? memory.open : [];
    const open = entries.flatMap((entry) => {
      if (typeof entry !== "object" || entry === null) return [];
      const { directory, changeName } = entry as { directory?: unknown; changeName?: unknown };
      return typeof directory === "string" && typeof changeName === "string" ? [openKey(directory, changeName)] : [];
    });
    return { zoom, open };
  } catch {
    return { zoom: DEFAULT_ZOOM, open: [] };
  }
}

function writeViewMemory(viewState: PipelineViewProps["viewState"], zoom: number, open: ReadonlySet<string>): void {
  if (viewState === undefined) return;
  try {
    viewState.write({
      zoom,
      open: [...open].map((key) => {
        const [directory, changeName] = JSON.parse(key) as [string, string];
        return { directory, changeName };
      }),
    });
  } catch {
    // A host that cannot keep what the viewer left still draws the picture.
  }
}

/** A task list's rows, grouped under the headings they are listed under,
 * in order. Rows before any heading form a group with no heading. */
function taskGroups<T extends SurveyedTask>(rows: readonly T[]): Array<{ section?: string; rows: T[] }> {
  const groups: Array<{ section?: string; rows: T[] }> = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.section === row.section) last.rows.push(row);
    else groups.push({ ...(row.section !== undefined ? { section: row.section } : {}), rows: [row] });
  }
  return groups;
}

/** The height core derives for each open card with rows to list. */
function openHeights(
  names: readonly string[],
  tasksOf: (name: string) => readonly SurveyedTask[] | undefined,
  isOpen: (name: string) => boolean,
): Map<string, number> {
  const heights = new Map<string, number>();
  for (const name of names) {
    const tasks = tasksOf(name);
    if (tasks === undefined || tasks.length === 0 || !isOpen(name)) continue;
    heights.set(name, pipelineOpenCardHeight(tasks.length, taskGroups(tasks).filter((group) => group.section !== undefined).length));
  }
  return heights;
}

/** A request to stop a run held elsewhere, as a card sends it. */
export interface AskToStop {
  changeName: string;
  /** The instance id of the run, from its status record. */
  instanceId: string;
  reason: string;
}

/** What the reason form is open for: a run this host holds, by its run id, or
 * a run elsewhere, by its instance id. */
type StopTarget = { changeName: string; runId: string } | { changeName: string; instanceId: string };

/** A control a card sends for a run this host holds. */
export interface RunControl {
  changeName: string;
  runId: string;
  kind: "confirmCheckpoint" | "stop" | "cancel" | "resolvePermission";
  /** The reason a person gave, on a `stop`. */
  reason?: string;
  permissionRequestId?: string;
  permissionOutcome?: "allow" | "deny";
}

/** One reading, repeated while the tab is looked at: on a timer, or on a
 * host's signal naming it and a slow backstop. A reply that arrives once
 * the tab has been left, or after unmount, sets nothing — and is never
 * mistaken for a current reading. */
function usePolledReading<T>(
  load: (() => Promise<T>) | undefined,
  isActive: boolean,
  intervalMs: number,
  signal: { name: PipelineReading; subscribe: PipelineViewProps["subscribe"] },
) {
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

  const { name, subscribe } = signal;
  useEffect(() => {
    if (!isActive || !load) return;
    void read();
    const timer = setInterval(() => void read(), subscribe ? PIPELINE_BACKSTOP_INTERVAL_MS : intervalMs);
    const unsubscribe = subscribe?.((reading) => {
      if (reading === name) void read();
    });
    return () => {
      clearInterval(timer);
      unsubscribe?.();
    };
  }, [isActive, load, read, intervalMs, name, subscribe]);

  return { value, error, readAt, read };
}

/** The time the view states ages against, moved on while it is looked at.
 * Drawing again reads nothing. */
function useClock(isActive: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), PIPELINE_CLOCK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isActive]);
  return now;
}

export function PipelineView({
  load,
  survey,
  isActive,
  onOpenChange,
  subscribe,
  refresh,
  lastRuns,
  standings,
  liveRuns,
  onRunControl,
  onStart,
  copyText,
  viewState,
  onAskToStop,
}: PipelineViewProps) {
  const local = usePolledReading(load, isActive, PIPELINE_POLL_INTERVAL_MS, { name: "readiness", subscribe });
  const others = usePolledReading(survey, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const ended = usePolledReading(lastRuns, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const stands = usePolledReading(standings, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  // The runs this host holds, read with the survey: a card offers controls
  // only for these (a-change-is-run-from-its-card).
  const held = usePolledReading(liveRuns, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const [stopFor, setStopFor] = useState<StopTarget | undefined>(undefined);
  /** When this view asked each run elsewhere to stop, by instance id, so its
   * card can say it is waiting for the run to read the request. */
  const [stopsAsked, setStopsAsked] = useState<ReadonlyMap<string, string>>(() => new Map());
  // What the viewer left: read once, and kept as it changes. A host that
  // cannot give or keep it leaves the default zoom and every card closed
  // (a-card-opens-to-its-tasks).
  const [remembered] = useState(() => readViewMemory(viewState));
  const [zoom, setZoom] = useState(remembered.zoom);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(remembered.open));
  useEffect(() => writeViewMemory(viewState, zoom, open), [viewState, zoom, open]);
  const openCards = useMemo<OpenCards>(() => ({
    isOpen: (directory, changeName) => open.has(openKey(directory, changeName)),
    toggle: (directory, changeName) => setOpen((current) => {
      const next = new Set(current);
      const key = openKey(directory, changeName);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    }),
  }), [open]);
  const zoomIndex = PIPELINE_ZOOM_STEPS.indexOf(zoom);
  const now = useClock(isActive);
  const [refreshing, setRefreshing] = useState(false);
  const [refs, setRefs] = useState<string | undefined>(undefined);
  const [refreshError, setRefreshError] = useState<string | undefined>(undefined);
  /** Held in a ref as well as state, so a second press in the same tick
   * starts nothing. */
  const refreshInFlight = useRef(false);

  async function refreshNow(): Promise<void> {
    if (!refresh || refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      setRefs(await refresh());
      await Promise.all([local.read(), others.read(), ended.read(), stands.read(), held.read()]);
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  const report = local.value;
  const here = others.value?.directories.find((directory) => directory.isThis);
  const labels = new Map((others.value?.directories ?? []).map((directory) => [directory.path, directory.label]));
  // One card per change, derived in core from the three readings; this
  // view draws what it returns (a-card-says-what-its-change-is-doing).
  const cardList = report === undefined ? [] : describeChangeCards({
    report,
    ...(others.value !== undefined ? { survey: others.value } : {}),
    ...(ended.value !== undefined ? { lastRuns: ended.value } : {}),
    ...(stands.value !== undefined ? { standings: stands.value } : {}),
    ...(held.value !== undefined ? { liveRunIds: held.value.runs.map((run) => run.runId) } : {}),
    ...(held.value?.myLabel !== undefined ? { myLabel: held.value.myLabel } : {}),
    stopsAsked,
    now,
  });
  const cards = new Map(cardList.map((card) => [card.changeName, card]));
  const onCards = runsShownOnCards(cardList);
  const heldRuns = new Map((held.value?.runs ?? []).map((run) => [run.runId, run]));
  // A control changes what the run's record says within moments. The card
  // reads it again then, rather than on the next survey half a minute
  // later, so the person sees what their press did.
  const sendRunControl = onRunControl === undefined ? undefined : (control: RunControl) => {
    onRunControl(control);
    setTimeout(() => void Promise.all([others.read(), ended.read(), stands.read(), held.read()]), RUN_CONTROL_REREAD_MS);
  };
  const controls: CardControlHandlers = {
    heldRuns,
    ...(sendRunControl !== undefined ? { onRunControl: sendRunControl } : {}),
    ...(onStart !== undefined ? { onStart } : {}),
    ...(copyText !== undefined ? { copyText } : {}),
    onAskStop: setStopFor,
    canAskToStop: onAskToStop !== undefined,
  };
  // The cards Open all opens: every card with rows to list, here and in
  // every other working directory.
  const localDirectory = here?.path ?? "";
  const openableKeys = (): string[] => [
    ...(report?.changes ?? [])
      .filter((change) => (cards.get(change.changeName)?.tasks?.length ?? 0) > 0)
      .map((change) => openKey(localDirectory, change.changeName)),
    ...(others.value?.directories ?? []).flatMap((directory) => directory.isThis || !directory.readable
      ? []
      : directory.changes
        .filter((change) => change.changeName !== directory.belongsTo && (change.tasks?.length ?? 0) > 0)
        .map((change) => openKey(directory.path, change.changeName))),
  ];
  // One legend for the tab, above every picture, where any of them draws a
  // line: an edge between cards, or an open card's rail. Said once: the
  // first capture put the same three lines above every directory.
  const showLegend = open.size > 0
    || (report !== undefined && drawsAnEdge(report.changes))
    || (others.value?.directories ?? []).some((directory) => !directory.isThis
      && directory.readable
      && drawsAnEdge(directory.changes.filter((change) => change.changeName !== directory.belongsTo)));

  // Each reading is shown when it arrives (the-pipeline-shows-what-it-has-read).
  // This directory's part says it is still being read, or why it could not
  // be, in its own place; the other working directories are drawn whatever
  // became of it. A reading that failed after one that arrived keeps the
  // picture it had, under the error, and the read-at line says how old it is.
  return (
    // The zoom is one factor on everything the picture draws, cards, text
    // and lines alike; no layout unit changes with it.
    <div data-testid="pipeline" className="openspec-pipeline" style={{ "--pipeline-zoom": zoom } as Record<string, number>}>
      {here ? <Reading directory={here} now={now} onCards={onCards} /> : null}
      <div className="openspec-ai-panel-controls" data-testid="pipeline-view-controls">
        <button className="button" type="button" data-testid="pipeline-open-all" onClick={() => setOpen(new Set(openableKeys()))}>Open all</button>
        <button className="button" type="button" data-testid="pipeline-close-all" disabled={open.size === 0} onClick={() => setOpen(new Set())}>Close all</button>
        <button className="button" type="button" data-testid="pipeline-zoom-out" disabled={zoomIndex <= 0} onClick={() => setZoom(PIPELINE_ZOOM_STEPS[zoomIndex - 1] ?? zoom)}>Zoom out</button>
        <span className="openspec-shell-note" data-testid="pipeline-zoom-level">{`Zoom ${Math.round(zoom * 100)}%`}</span>
        <button className="button" type="button" data-testid="pipeline-zoom-in" disabled={zoomIndex >= PIPELINE_ZOOM_STEPS.length - 1} onClick={() => setZoom(PIPELINE_ZOOM_STEPS[zoomIndex + 1] ?? zoom)}>Zoom in</button>
        <button className="button" type="button" data-testid="pipeline-zoom-reset" disabled={zoom === DEFAULT_ZOOM} onClick={() => setZoom(DEFAULT_ZOOM)}>Reset zoom</button>
      </div>
      {showLegend ? <Legend testId="pipeline-legend" /> : null}
      {local.error !== undefined
        ? <p className="openspec-shell-error" role="alert" data-testid="pipeline-error">{local.error}</p>
        : null}
      {report === undefined
        ? (local.error === undefined
          ? <p className="openspec-shell-note" data-testid="pipeline-loading">Reading what is running…</p>
          : null)
        : (
          <>
            {report.changes.length === 0
              // Names the branch it read where the survey says which: an
              // empty queue and a reading taken on a stale checkout
              // otherwise look identical.
              ? <p className="openspec-shell-note" data-testid="pipeline-empty">No active changes{here ? ` on ${branchPhrase(here)}` : ""}.</p>
              : <LocalPicture report={report} cards={cards} now={now} onOpenChange={onOpenChange} alsoIn={alsoInHere(here, labels)} controls={controls} directory={localDirectory} openCards={openCards} />}
            {/* From the report this already read: no second fetch, and no
                suggestion computed here — `buildHints` derived them in core
                before the payload was sent. */}
            <HintList hints={report.hints} />
          </>
        )}
      {others.value ? <OtherDirectories survey={others.value} labels={labels} now={now} onCards={onCards} openCards={openCards} /> : null}
      {others.error !== undefined
        ? <p className="openspec-shell-note" data-testid="pipeline-survey-error">The other working directories could not be read: {others.error}</p>
        : null}
      <p className="openspec-shell-note" data-testid="pipeline-read-at">
        {/* A reading, not a subscription: between two of them a run can
            start and finish, so this never presents itself as live. */}
        Last read {local.readAt ? local.readAt.toLocaleTimeString() : "not yet"}
        {survey ? `; other working directories ${others.readAt ? others.readAt.toLocaleTimeString() : "not yet"}` : ""}.
      </p>
      {refresh ? (
        <div className="openspec-ai-panel-controls">
          <button className="button" type="button" data-testid="pipeline-refresh" disabled={refreshing} onClick={() => void refreshNow()}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {refs ? <span className="openspec-shell-note" data-testid="pipeline-refs">{refs}</span> : null}
        </div>
      ) : null}
      {refreshError !== undefined
        ? <p className="openspec-shell-error" role="alert" data-testid="pipeline-refresh-error">{`Refresh failed: ${refreshError}`}</p>
        : null}
      {stopFor !== undefined && ("runId" in stopFor ? sendRunControl !== undefined : onAskToStop !== undefined) ? (
        <StopReasonForm
          changeName={stopFor.changeName}
          onAsk={(reason) => {
            if ("runId" in stopFor) {
              sendRunControl?.({ changeName: stopFor.changeName, runId: stopFor.runId, kind: "stop", reason });
            } else {
              // Through the signed channel to a run held elsewhere. The card
              // says it is waiting until the run's record shows the stop. It
              // reads the runs again soon, and at each clock tick until the
              // window a run has to read the request is past, so "has not
              // read" rests on a reading taken after that window, never on
              // one from before the run's renewal (found by 4.5's live stop).
              const { changeName, instanceId } = stopFor;
              onAskToStop?.({ changeName, instanceId, reason });
              setStopsAsked((current) => new Map(current).set(instanceId, new Date().toISOString()));
              const rereadUntil = Date.now() + STOP_REQUEST_READ_WITHIN_MS;
              const reread = () => {
                void Promise.all([others.read(), held.read()]);
                if (Date.now() <= rereadUntil) setTimeout(reread, PIPELINE_CLOCK_INTERVAL_MS);
              };
              setTimeout(reread, RUN_CONTROL_REREAD_MS);
            }
            setStopFor(undefined);
          }}
          onCancel={() => setStopFor(undefined)}
        />
      ) : null}
    </div>
  );
}

function branchPhrase(directory: SurveyedDirectory): string {
  if (directory.branch) return `branch ${directory.branch}`;
  if (directory.head) return `a detached head at ${directory.head.slice(0, 7)}`;
  return "no branch";
}

/** Which branch this picture was read from, and what this directory's own
 * runs say they are doing — less the runs a card below already shows. */
function Reading({ directory, now, onCards }: { directory: SurveyedDirectory; now: Date; onCards: ReadonlySet<string> }) {
  return (
    <div className="openspec-pipeline-reading" data-testid="pipeline-reading">
      <p className="openspec-shell-note" data-testid="pipeline-reading-branch">
        Read from {branchPhrase(directory)} in {directory.label}.
      </p>
      <ul className="openspec-shell-note" data-testid="pipeline-reading-runs">
        {describeDirectoryRuns(directory, now, onCards).map((line, index) => <li key={index}>{line}</li>)}
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

function LocalPicture({ report, cards, now, onOpenChange, alsoIn, controls, directory, openCards }: {
  report: ChangeReadinessReport;
  cards: Map<string, ChangeCard>;
  now: Date;
  onOpenChange?: (name: string) => void;
  alsoIn: Map<string, string[]>;
  controls: CardControlHandlers;
  /** The path this picture is drawn for, which its open cards are kept by. */
  directory: string;
  openCards: OpenCards;
}) {
  // An open card is as tall as its rows, and only the cards below it in its
  // column move; nothing is measured (a-card-opens-to-its-tasks).
  const heights = openHeights(
    report.changes.map((change) => change.changeName),
    (name) => cards.get(name)?.tasks,
    (name) => openCards.isOpen(directory, name),
  );
  const layout = layoutChanges(report, { heights });
  return (
    <>
      {layout.cycles.length > 0 ? <Cycles cycles={layout.cycles} /> : null}
      <Picture
        layout={layout}
        testIdPrefix="pipeline-"
        laneHeading="h3"
        renderNode={(node) => {
          // Every change of the report has a card: they are derived from it.
          const name = node.change.changeName;
          const card = cards.get(name);
          return card === undefined ? null : (
            <Node
              key={name}
              node={node}
              card={card}
              now={now}
              onOpenChange={onOpenChange}
              alsoIn={alsoIn.get(name)}
              controls={controls}
              open={openCards.isOpen(directory, name)}
              onToggle={() => openCards.toggle(directory, name)}
            />
          );
        }}
      />
    </>
  );
}

/** Whether a picture of these changes draws a line between two cards: a
 * blocker that is one of its own changes. */
function drawsAnEdge(changes: ReadonlyArray<{ changeName: string; blockers: readonly string[] }>): boolean {
  const names = new Set(changes.map((change) => change.changeName));
  return changes.some((change) => change.blockers.some((blocker) => blocker !== change.changeName && names.has(blocker)));
}

/** What a picture's lines mean, said where there is a line to explain. */
function Legend({ testId }: { testId: string }) {
  return (
    <ul className="openspec-shell-note openspec-pipeline-legend" data-testid={testId}>
      <li><span className="openspec-pipeline-legend-edge" aria-hidden="true" />A solid line from one card to another means the second waits for the first.</li>
      <li><span className="openspec-pipeline-legend-rail" aria-hidden="true" />A thin line inside a card means listed next in tasks.md.</li>
      <li>A collision is written on the card, and never drawn.</li>
    </ul>
  );
}

/** Shows or hides a card's tasks. */
function TasksToggle({ name, open, listId, testId, onToggle }: {
  name: string;
  open: boolean;
  listId: string;
  testId: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="openspec-pipeline-node-disclosure"
      data-testid={testId}
      aria-expanded={open}
      aria-controls={listId}
      aria-label={`${open ? "Hide" : "Show"} tasks of ${name}`}
      onClick={onToggle}
    >
      {open ? "Hide tasks" : "Show tasks"}
    </button>
  );
}

/** A marker a row's word already says: `**Human-only**:` or
 * `**Delegated to claude-cli**:` at the start of its text. */
const MARKER_LEAD_RE = /^\*\*[^*]+\*\*:?\s*/u;

/** An open card's tasks, in the task list's order, under their headings.
 * Kept in the page while the card is closed, and hidden, so the control
 * that shows it always names an element. */
function TaskList({ id, rows, open, testId }: { id: string; rows: readonly TaskRow[]; open: boolean; testId: string }) {
  const groups = taskGroups(rows);
  return (
    <div id={id} className="openspec-pipeline-node-tasks" data-testid={testId} hidden={!open}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.section !== undefined ? <p className="openspec-pipeline-task-section" title={group.section}>{group.section}</p> : null}
          <ol className="openspec-pipeline-tasks">
            {group.rows.map((row, index) => {
              const text = row.closedBy === "agent" ? row.text : row.text.replace(MARKER_LEAD_RE, "");
              const inHand = row.word === "in hand" || row.word === "probably next";
              return (
                <li
                  key={index}
                  className={inHand ? "openspec-pipeline-task openspec-pipeline-task--in-hand" : "openspec-pipeline-task"}
                  data-word={row.word}
                  title={`${row.number !== undefined ? `${row.number} ` : ""}${row.word}: ${text}`}
                >
                  {/* The rail runs to the row listed next, across the next
                      section's heading when this row ends a section: a
                      rail that stopped there read as two separate tracks
                      (found by 6.5's look). */}
                  {index < group.rows.length - 1
                    ? <span className="openspec-pipeline-task-rail" aria-hidden="true" />
                    : groupIndex < groups.length - 1
                      ? <span className="openspec-pipeline-task-rail openspec-pipeline-task-rail--across" aria-hidden="true" />
                      : null}
                  {row.number !== undefined ? <span className="openspec-pipeline-task-number">{row.number}</span> : null}
                  <span className="openspec-pipeline-task-word">{row.word}</span>
                  <span className="openspec-pipeline-task-text">{text}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
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
    <>
    {/* Its own scroller, so a wide repository never makes the page body
        scroll sideways — the rule the shell's tables already follow. */}
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
    </>
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

function Node({ node, card, now, onOpenChange, alsoIn, controls, open, onToggle }: {
  node: ChangeLayoutNode;
  card: ChangeCard;
  now: Date;
  onOpenChange?: (name: string) => void;
  alsoIn?: string[];
  controls: CardControlHandlers;
  open: boolean;
  onToggle: () => void;
}) {
  const { change } = node;
  // The card's own lines first — what the change is doing — then what
  // readiness says about starting it beside the others.
  const described = describeChangeCard(card, now);
  const detail = [
    ...described.lines,
    ...describeChange(node),
    ...(alsoIn && alsoIn.length > 0 ? [`also in ${alsoIn.join(", ")}`] : []),
  ];
  const buttons = cardControls(card, controls);
  const rows = card.tasks ?? [];
  const testId = `pipeline-node-${change.changeName}`;
  return (
    // A group, not one button: a card holds controls of its own, and a
    // button cannot hold a button (a-change-is-run-from-its-card). Its name
    // is the control that opens the change.
    <div
      role="group"
      aria-label={change.changeName}
      className="openspec-pipeline-node"
      data-testid={testId}
      data-state={card.state}
      data-open={open && rows.length > 0 ? "true" : "false"}
      // The coordinates core returned, in units the stylesheet turns into
      // `em`. In the narrow view the stylesheet ignores them.
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      // The whole of the text, for a reader whose card clipped it.
      title={`${change.changeName} — ${detail.join(" ")}`}
    >
      <div className="openspec-pipeline-node-head">
        <button
          type="button"
          className="openspec-pipeline-node-open"
          data-testid={`${testId}-open`}
          onClick={() => onOpenChange?.(change.changeName)}
        >
          <span className="openspec-pipeline-node-name">{change.changeName}</span>
        </button>
        {rows.length > 0
          ? <TasksToggle name={change.changeName} open={open} listId={`${testId}-tasks`} testId={`${testId}-tasks-toggle`} onToggle={onToggle} />
          : null}
      </div>
      {/* The state as a word, not only as a colour — two hues a reader
          cannot tell apart must still be two states. */}
      <span className="openspec-pipeline-node-state">{described.stateWords}</span>
      {/* The lines a closed card holds, open or not: opening a card adds its
          rows and changes nothing it says. */}
      <CardDetails lines={detail} budget={pipelineCardDetailLines(NODE_HEIGHT, { hasState: true, hasControls: buttons.length > 0 })} />
      {buttons.length > 0 ? (
        <div className="openspec-pipeline-node-controls" data-testid={`${testId}-controls`}>
          {buttons}
        </div>
      ) : null}
      {rows.length > 0 ? <TaskList id={`${testId}-tasks`} rows={rows} open={open} testId={`${testId}-tasks`} /> : null}
    </div>
  );
}

/** What a card's controls need from the view: the runs this host holds,
 * and where each control goes. */
interface CardControlHandlers {
  heldRuns: Map<string, LiveRun>;
  onRunControl?: (control: RunControl) => void;
  onStart?: (changeName: string) => void;
  copyText?: (text: string) => Promise<void>;
  onAskStop: (target: StopTarget) => void;
  /** The host can ask a run held elsewhere to stop. */
  canAskToStop: boolean;
}

/** The buttons a card offers, from its facts alone. Answer, Stop and Stop
 * now only for a run this host holds; for a run held elsewhere, only its
 * folder to copy (a-change-is-run-from-its-card 5.2–5.8). Every button's
 * accessible name includes the change's name. */
function cardControls(card: ChangeCard, handlers: CardControlHandlers): ReactNode[] {
  const name = card.changeName;
  const buttons: ReactNode[] = [];
  const run = card.run;

  if (run === undefined) {
    if (handlers.onStart !== undefined && (card.state === "ready" || card.state === "failed" || card.state === "stopped")) {
      const start = handlers.onStart;
      buttons.push(
        <button key="start" type="button" data-testid={`pipeline-start-${name}`} aria-label={`Start ${name}`} onClick={() => start(name)}>Start</button>,
      );
    }
    return buttons;
  }

  const held = run.ownedHere && run.runId !== null ? handlers.heldRuns.get(run.runId) : undefined;
  if (held === undefined || handlers.onRunControl === undefined) {
    // A run elsewhere that is this person's own, by its verified record, can
    // be asked to stop through the signed channel; nobody else's is offered
    // here (a-run-elsewhere-can-be-asked-to-stop). Not again while a request
    // is waiting to be read, or once the run has heard one.
    if (!run.ownedHere && run.stoppableByMe && handlers.canAskToStop && run.stopAskedAt === undefined && run.stopRequested === null) {
      const instanceId = run.instanceId;
      buttons.push(
        <button key="ask-stop" type="button" data-testid={`pipeline-ask-stop-${name}`} aria-label={`Stop ${name}`} onClick={() => handlers.onAskStop({ changeName: name, instanceId })}>Stop</button>,
      );
    }
    // Answered where it was started: the card names the folder, and offers
    // to copy it, never to open it.
    if (!run.ownedHere && handlers.copyText !== undefined && run.workingDirectory !== "") {
      const copy = handlers.copyText;
      buttons.push(
        <button key="copy" type="button" data-testid={`pipeline-copy-path-${name}`} aria-label={`Copy folder path of ${name}`} onClick={() => void copy(run.workingDirectory)}>Copy folder path</button>,
      );
    }
    return buttons;
  }

  const send = handlers.onRunControl;
  const runId = held.runId;
  if (held.stopRequested !== null) {
    buttons.push(
      <button key="stop-now" type="button" data-testid={`pipeline-stop-now-${name}`} aria-label={`Stop ${name} now`} onClick={() => send({ changeName: name, runId, kind: "cancel" })}>Stop now</button>,
    );
    return buttons;
  }
  if (run.waiting?.kind === "checkpoint") {
    const next = run.waiting.nextStage;
    buttons.push(
      <button key="continue" type="button" data-testid={`pipeline-continue-${name}`} aria-label={`Continue ${name} to ${next}`} onClick={() => send({ changeName: name, runId, kind: "confirmCheckpoint" })}>{`Continue to ${next}`}</button>,
    );
  }
  if (run.waiting?.kind === "permission" && held.permissionRequestId !== null) {
    const requestId = held.permissionRequestId;
    buttons.push(
      <button key="allow" type="button" data-testid={`pipeline-allow-${name}`} aria-label={`Allow ${name}: ${run.waiting.description}`} onClick={() => send({ changeName: name, runId, kind: "resolvePermission", permissionRequestId: requestId, permissionOutcome: "allow" })}>Allow</button>,
      <button key="deny" type="button" data-testid={`pipeline-deny-${name}`} aria-label={`Deny ${name}: ${run.waiting.description}`} onClick={() => send({ changeName: name, runId, kind: "resolvePermission", permissionRequestId: requestId, permissionOutcome: "deny" })}>Deny</button>,
    );
  }
  buttons.push(
    <button key="stop" type="button" data-testid={`pipeline-stop-${name}`} aria-label={`Stop ${name}`} onClick={() => handlers.onAskStop({ changeName: name, runId })}>Stop</button>,
  );
  return buttons;
}

/** Asks a held run to stop, with the reason a person gives. A reason is
 * required: a stop is recorded with it (a-change-is-run-from-its-card). */
function StopReasonForm({ changeName, onAsk, onCancel }: {
  changeName: string;
  onAsk: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [refused, setRefused] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
  }, []);
  return (
    <form
      role="dialog"
      aria-label={`Ask ${changeName} to stop`}
      className="openspec-pipeline-stop-form"
      data-testid="pipeline-stop-form"
      onSubmit={(event) => {
        event.preventDefault();
        const given = reason.trim();
        if (given.length === 0) {
          setRefused(true);
          return;
        }
        onAsk(given);
      }}
    >
      <label>
        {`Why should ${changeName} stop?`}
        <input
          ref={field}
          type="text"
          // Refused by the form's own check, not the browser's: a native
          // `required` stops the submit before it, so its message never
          // shows, and it lets a reason of only spaces through.
          aria-required="true"
          value={reason}
          data-testid="pipeline-stop-reason"
          aria-invalid={refused}
          onChange={(event) => {
            setReason(event.target.value);
            setRefused(false);
          }}
        />
      </label>
      {refused ? <p className="openspec-shell-error" role="alert">A stop needs a reason.</p> : null}
      <div className="openspec-ai-panel-controls">
        <button type="submit" className="button alert" data-testid="pipeline-ask-to-stop">Ask to stop</button>
        <button className="button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** A card's detail lines (the-pipeline-shows-what-it-has-read). As many
 * as the card holds whole are drawn, each on one line; the rest stay in
 * the DOM and in the card's accessible name, visually hidden — a fixed
 * card must not be able to remove a fact the change is required to state
 * — and the last drawn line counts them. The card's title has every
 * line. */
function CardDetails({ lines, budget }: { lines: string[]; budget: number }) {
  const { drawn, beyond } = fitPipelineCardDetails(lines.length, budget);
  const count = <span className="openspec-pipeline-node-more" aria-hidden="true">{`+${beyond}`}</span>;
  return (
    <>
      {drawn === 0 && beyond > 0 ? count : null}
      {lines.map((line, index) => (
        <span
          key={index}
          className={index < drawn ? "openspec-pipeline-node-detail" : "openspec-pipeline-node-detail openspec-pipeline-node-detail--beyond"}
        >
          <span className="openspec-pipeline-node-detail-text">{line}</span>
          {beyond > 0 && index === drawn - 1 ? count : null}
        </span>
      ))}
    </>
  );
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
    // Only a lease records an author; a run known only by its status
    // record claims nobody (a-change-is-running-when-its-run-says-so).
    if (change.run.holder?.author) lines.push(`git author ${change.run.holder.author}`);
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
function OtherDirectories({ survey, labels, now, onCards, openCards }: {
  survey: WorktreeSurvey;
  labels: Map<string, string>;
  now: Date;
  onCards: ReadonlySet<string>;
  openCards: OpenCards;
}) {
  const others = survey.directories.filter((directory) => !directory.isThis);
  if (others.length === 0 && survey.runsElsewhere.length === 0) return null;
  return (
    <div className="openspec-pipeline-others" data-testid="pipeline-others">
      <h3 className="openspec-pipeline-others-heading">Other working directories</h3>
      <p className="openspec-shell-note">
        Read here and never acted on: nothing below can be opened, run or changed from this checkout.
      </p>
      {others.map((directory, index) => (
        <OtherDirectory key={directory.path} directory={directory} index={index} labels={labels} now={now} onCards={onCards} openCards={openCards} />
      ))}
      {survey.runsElsewhere.length > 0 ? (
        <div data-testid="pipeline-runs-elsewhere">
          <p className="openspec-shell-note">
            Runs reporting from a directory that is no longer a working directory of this repository:
          </p>
          <ul className="openspec-shell-note">
            {survey.runsElsewhere.map((run) => <li key={run.instanceId}>{`${run.workingDirectory} — ${describeRun(run, now)}`}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function OtherDirectory({ directory, index, labels, now, onCards, openCards }: {
  directory: SurveyedDirectory;
  index: number;
  labels: Map<string, string>;
  now: Date;
  onCards: ReadonlySet<string>;
  openCards: OpenCards;
}) {
  const testId = `pipeline-directory-${index}`;
  return (
    <section className="openspec-pipeline-directory" data-testid={testId} aria-label={`Working directory ${directory.label}`}>
      <h4 className="openspec-pipeline-directory-label">{directory.label}</h4>
      <p className="openspec-shell-note" data-testid={`${testId}-where`}>{`${branchPhrase(directory)} — ${directory.path}`}</p>
      {directory.belongsTo ? (
        // A change is one card, wherever it is worked (ADR 0029): this
        // directory's copy of it is the card above, not a second card here.
        <p className="openspec-shell-note" data-testid={`${testId}-belongs-to`}>
          {`The worktree of ${directory.belongsTo}, which is drawn above.`}
        </p>
      ) : null}
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
        {describeDirectoryRuns(directory, now, onCards).map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
      </ul>
      {directory.readable ? <ForeignChanges directory={directory} testId={testId} labels={labels} openCards={openCards} /> : null}
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

function ForeignChanges({ directory, testId, labels, openCards }: {
  directory: Extract<SurveyedDirectory, { readable: true }>;
  testId: string;
  labels: Map<string, string>;
  openCards: OpenCards;
}) {
  // The change this directory is the worktree of is already a card above.
  const changes = directory.changes.filter((change) => change.changeName !== directory.belongsTo);
  if (changes.length === 0) {
    return (
      <p className="openspec-shell-note" data-testid={`${testId}-empty`}>
        {`No ${directory.belongsTo ? "other " : ""}active changes on ${branchPhrase(directory)}.`}
      </p>
    );
  }
  const byName = new Map(changes.map((change) => [change.changeName, change]));
  const heights = openHeights(
    changes.map((change) => change.changeName),
    (name) => byName.get(name)?.tasks,
    (name) => openCards.isOpen(directory.path, name),
  );
  const layout = layoutChanges({ changes: changes.map(asLayoutInput) }, { heights });
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
            open={openCards.isOpen(directory.path, node.change.changeName)}
            onToggle={() => openCards.toggle(directory.path, node.change.changeName)}
          />
        )}
      />
    </>
  );
}

/** A card with no action on its change. Not a button, and no handler that
 * reaches a change: a change is the pair (directory, name), and nothing
 * here may reach the change of the same name in this checkout (ADR 0026).
 * Its one control shows or hides the tasks this reading already holds. */
function ForeignNode({ node, change, labels, testId, open, onToggle }: {
  node: ChangeLayoutNode;
  change: SurveyedChange | undefined;
  labels: Map<string, string>;
  testId: string;
  open: boolean;
  onToggle: () => void;
}) {
  // No run in hand is paired with another directory's rows: a row's word
  // there is what its list says.
  const rows = change?.tasks !== undefined ? describeTaskRows(change.tasks, undefined) : [];
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
      data-open={open && rows.length > 0 ? "true" : "false"}
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      title={`${name} — ${lines.join(" ")}`}
    >
      <div className="openspec-pipeline-node-head">
        <span className="openspec-pipeline-node-name">{name}</span>
        {rows.length > 0
          ? <TasksToggle name={name} open={open} listId={`${testId}-tasks`} testId={`${testId}-tasks-toggle`} onToggle={onToggle} />
          : null}
      </div>
      <CardDetails lines={lines} budget={pipelineCardDetailLines(NODE_HEIGHT, { hasState: false })} />
      {rows.length > 0 ? <TaskList id={`${testId}-tasks`} rows={rows} open={open} testId={`${testId}-tasks`} /> : null}
    </div>
  );
}
