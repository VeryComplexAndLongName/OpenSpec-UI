// The pipeline picture — ADR 0025 — and every other working directory of
// the repository beneath it — ADR 0026.
//
// This file draws; it decides nothing. Where each node goes, where each
// edge turns, how tall each card is and how wide the whole thing is were all
// worked out in core: `layoutChanges` from the report the host read, and
// `pipelineCardHeight` from what each card holds. Nothing is measured: one
// unit is one `rem` for both the cards and the SVG, so the two line up
// without either being asked where the other ended up.
//
// A card is the site's card (the-pipeline-cards-wear-metro): its name as a
// heading, its state in a coloured badge that still carries the word, a bar
// for its tasks, its facts marked by kind, and its controls in a footer.
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

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  COLUMN_GAP,
  LANE_HEADING,
  NODE_WIDTH,
  describeChangeCard,
  describeChangeCards,
  describeCollision,
  describeDirectoryRuns,
  describeLane,
  describeOlderArchive,
  describeStageLine,
  describeRun,
  describeTaskRows,
  fitPipelineCardDetails,
  describeChangeState,
  CHANGE_ORDERS,
  describeChangeOrder,
  layoutChanges,
  layoutChangesByStage,
  orderFactsOf,
  rankChanges,
  type BoardColumn,
  type BoardColumnsReading,
  type ChangeOrder,
  type ChangeOrderFacts,
  settleOnDefaultBranch,
  stagesByName,
  matchesFilter,
  pipelineCardHeight,
  runsShownOnCards,
  STOP_REQUEST_READ_WITHIN_MS,
  type CardDetail,
  type ChangeCard,
  type ChangeLayout,
  type ChangeLayoutEdge,
  type ChangeLayoutNode,
  type ChangeReadiness,
  type ChangeReadinessReport,
  driftWords,
  type ArchiveReading,
  type ArchivedChange,
  type ChangeStageSummary,
  type ChangeStandings,
  type CatchUpResult,
  type MainDrift,
  type DescribedChangeCard,
  type LastRunsReport,
  type LiveRun,
  type SurveyedChange,
  type SurveyedDirectory,
  type SurveyedTask,
  type TaskRow,
  type WorktreeSurvey,
  type ChangeAction,
  type ChangeActionFacts,
  type ChangeActionState,
} from "@openspec-ui/core/browser";
import { CardActions, ConfirmActionForm, cardActionRows, cardActionStates, type ChangeActionsHost } from "./CardActions.js";
import { HintList } from "./HintList.js";
import { ModalLayer } from "./ModalLayer.js";
import { Icon } from "./Icon.js";
import {
  TaskCardContext,
  TaskPanel,
  wholeTaskText,
  type TaskActions,
  type TaskCardContextValue,
  type TaskSelection,
} from "./TaskPanel.js";
import {
  ChevronIcon,
  CheckIcon,
  CopyIcon,
  CrossIcon,
  DetailIcon,
  ForwardIcon,
  MinusIcon,
  PlusIcon,
  RefreshIcon,
} from "./pipeline-icons.js";

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
  /** Reads where each change is on the board, and who holds it
   * (the-board-shows-the-stages). Absent, the arrangement by stage is not
   * offered and a card says nothing about its stage. */
  stages?: () => Promise<ChangeStageSummary[]>;
  /** Reads what this repository archived, as the server's default branch
   * has it (the-board-remembers-what-was-archived). Absent, the board's
   * Archived column stands empty - a change leaves `openspec/changes`
   * when it is archived, so nothing else ever puts one there. */
  archived?: () => Promise<ArchiveReading>;
  /** Reads a team's own columns, from `openspec/board.json`
   * (a-team-names-its-columns). Absent, or where the file is absent, a
   * column per stage; where the file is refused, a column per stage and a
   * line saying why. */
  columns?: () => Promise<BoardColumnsReading>;
  /** Reads the runs this host started and holds. A card offers to answer,
   * stop or stop now only a run among these (a-change-is-run-from-its-card).
   * Absent, no card offers any of them. `myLabel` is the roster label of the
   * host's own key, where it is enrolled: a card offers Stop on a run held
   * elsewhere only when that run is this person's, by its verified record
   * (a-run-elsewhere-can-be-asked-to-stop). */
  liveRuns?: () => Promise<{ runs: LiveRun[]; myLabel?: string }>;
  /** Sends a control for a held run: the host adds where it runs. */
  onRunControl?: (control: RunControl) => void;
  /** Answers a question a run's agent put to the operator, wherever the run
   * is: the host writes it to the change's decisions.md in the run's working
   * directory (the-agent-asks-the-operator, ADR 0042). Absent, no Answer. */
  onAnswerQuestion?: (answer: QuestionAnswer) => void;
  /** Starts a change: the host opens its run dialog. Absent, no Start.
   * `directory` is the change's own worktree, for a card of one: the run
   * runs there (a-change-is-committed-where-it-is-made). */
  onStart?: (changeName: string, directory?: string) => void;
  /** Updates a change's plan its last review asked to change: the host opens
   * the AI panel on `update` for it (ADR 0041). Absent, no Update the plan. */
  onUpdatePlan?: (changeName: string) => void;
  /** Shows a change's run logs (a-change-shows-its-run-logs). Absent, no
   * Logs button. */
  onViewLogs?: (changeName: string) => void;
  /** Copies text — a run's folder, a hint's command — for a host that
   * allows it. */
  copyText?: (text: string) => Promise<void>;
  /** Keeps the zoom and the open cards for this viewer, where the host can.
   * A reader or writer that throws leaves the default zoom and every card
   * closed (a-card-opens-to-its-tasks). */
  viewState?: { read(): PipelineViewMemory | undefined; write(memory: PipelineViewMemory): void };
  /** Asks a run held elsewhere to stop, through the signed channel, with the
   * host's own key. Absent, no card offers it. */
  onAskToStop?: (request: AskToStop) => void;
  /** Reads how far this checkout is behind what has landed, and what of
   * it is already archived on the default branch. Absent, the Pipeline
   * says nothing about it (main-catches-up-with-what-landed). */
  drift?: () => Promise<MainDrift | undefined>;
  /** Brings the default branch up to its remote by fast-forward. Absent,
   * the line is still said and offers no press. */
  onCatchUp?: () => Promise<CatchUpResult>;
  /** Archives the changes whose work has landed, from the folded row.
   * Absent, the row still folds and offers nothing to press
   * (what-is-finished-is-tidied-away). */
  onArchive?: (changeNames: string[]) => void;
  /** `PIPELINE_FIRST_READING` until the first report returns, then `null`
   * for good: the shell draws a spinner on the tab while it is anything
   * else (a-screen-says-what-it-is-doing). A later poll does not report,
   * or the tab would blink every ten seconds. */
  onReadingChange?: (reading: string | null) => void;
  /** What a card may do in its change's own worktree: tick, untick, commit
   * and push, run a delegated task, open the change's files
   * (a-card-works-its-own-tasks). Absent, every card is read-only, as
   * before, and a task opens read-only. */
  taskActions?: TaskActions;
  /** What the host does with a change's actions: the icons under its name
   * (ADR 0044, a-change-is-acted-on-from-its-card). Absent, a card draws
   * none. */
  changeActions?: ChangeActionsHost;
  /** A change the host asks to be shown: its card is scrolled to, marked
   * for a moment and given the focus (the-side-panel-is-the-workspace).
   * `at` tells two requests for one change apart. */
  focus?: { changeName: string; at: number };
}

/** How long a shown card stays marked, and how long the view waits for
 * the card to be drawn before it gives up: a panel just opened draws its
 * cards once its first reading returns. */
export const PIPELINE_FOCUS_MARK_MS = 2_500;
const PIPELINE_FOCUS_WAIT_MS = 15_000;
const PIPELINE_FOCUS_RETRY_MS = 200;

/** What the Pipeline says while its first report has not returned. */
export const PIPELINE_FIRST_READING = "Reading what is running…";

/** What a card calls the main checkout where the same change is also
 * worked. Its own label is the name of the folder somebody cloned into,
 * which says nothing about the place and, on this repository, reads as
 * the product's own name (the-board-is-of-every-change). */
export const MAIN_DIRECTORY_LABEL = "the main working directory";

/** The zoom steps the picture offers, as factors of its unit. */
export const PIPELINE_ZOOM_STEPS: readonly number[] = [0.75, 0.9, 1, 1.25, 1.5];
const DEFAULT_ZOOM = 1;

/** What a viewer left the picture as: its zoom, and the open cards, each by
 * the directory it is drawn for and its change's name. */
export interface PipelineViewMemory {
  zoom: number;
  open: Array<{ directory: string; changeName: string }>;
  /** Which arrangement the picture was left in: by declared order, or the
   * board by stage (the-board-shows-the-stages). */
  arrangement?: PipelineArrangement;
  /** The order each column's cards stand in (the-board-sorts-its-cards). */
  order?: ChangeOrder;
  /** The cards whose done tasks are hidden, kept as the open ones are
   * (a-card-works-its-own-tasks). */
  hideDone?: Array<{ directory: string; changeName: string }>;
}

/** How the picture is arranged: `steps` by what each change waits for,
 * `stages` as a board of the stages a change goes through. */
export type PipelineArrangement = "steps" | "stages";

/** Which cards are open, by the directory a card is drawn for and its
 * change's name: a change is the pair, never the name alone (ADR 0026). */
interface OpenCards {
  isOpen(directory: string, changeName: string): boolean;
  toggle(directory: string, changeName: string): void;
}

function openKey(directory: string, changeName: string): string {
  return JSON.stringify([directory, changeName]);
}

/** Remembered cards, as the keys `openKey` makes; anything malformed is
 * dropped. */
function rememberedKeys(value: unknown): string[] {
  const entries: unknown[] = Array.isArray(value) ? value : [];
  return entries.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { directory, changeName } = entry as { directory?: unknown; changeName?: unknown };
    return typeof directory === "string" && typeof changeName === "string" ? [openKey(directory, changeName)] : [];
  });
}

function keysAsCards(keys: ReadonlySet<string>): Array<{ directory: string; changeName: string }> {
  return [...keys].map((key) => {
    const [directory, changeName] = JSON.parse(key) as [string, string];
    return { directory, changeName };
  });
}

function readViewMemory(viewState: PipelineViewProps["viewState"]): { zoom: number; open: string[]; arrangement: PipelineArrangement; order: ChangeOrder; hideDone: string[] } {
  try {
    const memory = viewState?.read() as Partial<PipelineViewMemory> | undefined;
    if (typeof memory !== "object" || memory === null) return { zoom: DEFAULT_ZOOM, open: [], arrangement: "steps", order: "name", hideDone: [] };
    const zoom = typeof memory.zoom === "number" && PIPELINE_ZOOM_STEPS.includes(memory.zoom) ? memory.zoom : DEFAULT_ZOOM;
    const arrangement: PipelineArrangement = memory.arrangement === "stages" ? "stages" : "steps";
    const order: ChangeOrder = CHANGE_ORDERS.find((one) => one === memory.order) ?? "name";
    return { zoom, open: rememberedKeys(memory.open), arrangement, order, hideDone: rememberedKeys(memory.hideDone) };
  } catch {
    return { zoom: DEFAULT_ZOOM, open: [], arrangement: "steps", order: "name", hideDone: [] };
  }
}

function writeViewMemory(
  viewState: PipelineViewProps["viewState"],
  zoom: number,
  open: ReadonlySet<string>,
  arrangement: PipelineArrangement,
  order: ChangeOrder,
  hideDone: ReadonlySet<string>,
): void {
  if (viewState === undefined) return;
  try {
    viewState.write({
      zoom,
      arrangement,
      order,
      open: keysAsCards(open),
      ...(hideDone.size > 0 ? { hideDone: keysAsCards(hideDone) } : {}),
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

/** The rows a card lists: every one, or the open ones where its done tasks
 * are hidden (a-card-works-its-own-tasks). */
function shownRows<T extends SurveyedTask>(rows: readonly T[], hideDone: boolean): T[] {
  return hideDone ? rows.filter((row) => !row.done) : [...rows];
}

/** What an open card lists, for its height: its rows and its headings. */
function openParts(rows: readonly SurveyedTask[], open: boolean, hideDone = false): { rows: number; sections: number } | undefined {
  const listed = shownRows(rows, hideDone);
  if (!open || listed.length === 0) return undefined;
  return { rows: listed.length, sections: taskGroups(listed).filter((group) => group.section !== undefined).length };
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

/** An answer a card gives to a run's question. */
export interface QuestionAnswer {
  changeName: string;
  /** The run's id, where the host holds it: the answer then reaches it at
   * once rather than at its next reading of decisions.md. */
  runId?: string;
  /** The working directory the run works in, whose change holds the
   * question. */
  workingDirectory: string;
  questionId: string;
  answer: string;
}

/** The run whose questions the answer form is open for. */
interface AnswerTarget {
  changeName: string;
  runId?: string;
  workingDirectory: string;
  questions: Array<{ questionId: string; text: string }>;
}

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
  stages,
  archived,
  columns,
  drift,
  onCatchUp,
  onArchive,
  liveRuns,
  onRunControl,
  onAnswerQuestion,
  onStart,
  onUpdatePlan,
  onViewLogs,
  copyText,
  viewState,
  onAskToStop,
  onReadingChange,
  taskActions,
  changeActions,
  focus,
}: PipelineViewProps) {
  const root = useRef<HTMLDivElement>(null);
  // The card of a change the host asked to show: found once it is drawn,
  // scrolled to the middle, marked and focused (the-side-panel-is-the-workspace).
  useEffect(() => {
    if (focus === undefined) return;
    const selector = `[data-testid="pipeline-node-${focus.changeName.replace(/["\\]/gu, "\\$&")}"]`;
    const started = Date.now();
    let unmark: ReturnType<typeof setTimeout> | undefined;
    const find = setInterval(() => {
      const card = root.current?.querySelector<HTMLElement>(selector) ?? null;
      if (card === null) {
        if (Date.now() - started >= PIPELINE_FOCUS_WAIT_MS) clearInterval(find);
        return;
      }
      clearInterval(find);
      if (typeof card.scrollIntoView === "function") card.scrollIntoView({ block: "center", inline: "center" });
      card.dataset.focused = "true";
      card.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
      unmark = setTimeout(() => { delete card.dataset.focused; }, PIPELINE_FOCUS_MARK_MS);
    }, PIPELINE_FOCUS_RETRY_MS);
    return () => {
      clearInterval(find);
      if (unmark !== undefined) clearTimeout(unmark);
    };
  }, [focus]);
  const local = usePolledReading(load, isActive, PIPELINE_POLL_INTERVAL_MS, { name: "readiness", subscribe });
  const others = usePolledReading(survey, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const ended = usePolledReading(lastRuns, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const stands = usePolledReading(standings, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const behind = usePolledReading(drift, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  // Where each change is on the board, read with the survey: a stage moves
  // when a run, a commit or a pull request moves (the-board-shows-the-stages).
  const staged = usePolledReading(stages, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  // What the repository archived, read with the survey: the archive moves
  // when a change is archived (the-board-remembers-what-was-archived).
  const filed = usePolledReading(archived, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  // A team's columns, read with the survey: the file changes as a commit
  // does (a-team-names-its-columns).
  const named = usePolledReading(columns, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const teamColumns = named.value?.kind === "columns" ? named.value.columns : undefined;
  const [caughtUp, setCaughtUp] = useState<string | null>(null);
  // The runs this host holds, read with the survey: a card offers controls
  // only for these (a-change-is-run-from-its-card).
  const held = usePolledReading(liveRuns, isActive, SURVEY_POLL_INTERVAL_MS, { name: "survey", subscribe });
  const [stopFor, setStopFor] = useState<StopTarget | undefined>(undefined);
  const [answerFor, setAnswerFor] = useState<AnswerTarget | undefined>(undefined);
  // A Danger action waiting for its confirmation (a-change-is-acted-on-from-its-card).
  const [confirmFor, setConfirmFor] = useState<{ action: ChangeAction; changeName: string } | undefined>(undefined);
  // The landed changes Archive Landed Changes... names, waiting for its
  // confirmation: a Danger action asks first (ADR 0045).
  const [archiveLanded, setArchiveLanded] = useState<string[] | undefined>(undefined);
  /** When this view asked each run elsewhere to stop, by instance id, so its
   * card can say it is waiting for the run to read the request. */
  const [stopsAsked, setStopsAsked] = useState<ReadonlyMap<string, string>>(() => new Map());
  // What the viewer left: read once, and kept as it changes. A host that
  // cannot give or keep it leaves the default zoom and every card closed
  // (a-card-opens-to-its-tasks).
  const [remembered] = useState(() => readViewMemory(viewState));
  const [zoom, setZoom] = useState(remembered.zoom);
  const [arrangement, setArrangement] = useState<PipelineArrangement>(remembered.arrangement);
  const [order, setOrder] = useState<ChangeOrder>(remembered.order);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(remembered.open));
  // The cards whose done tasks are hidden, and the task or list chosen on a
  // card (a-card-works-its-own-tasks).
  const [hideDone, setHideDone] = useState<ReadonlySet<string>>(() => new Set(remembered.hideDone));
  const [chosen, setChosen] = useState<TaskSelection | undefined>(undefined);
  useEffect(() => writeViewMemory(viewState, zoom, open, arrangement, order, hideDone), [viewState, zoom, open, arrangement, order, hideDone]);
  const taskCards = useMemo<TaskCardContextValue>(() => ({
    hidesDone: (directory, changeName) => hideDone.has(openKey(directory, changeName)),
    toggleHideDone: (directory, changeName) => setHideDone((current) => {
      const next = new Set(current);
      const key = openKey(directory, changeName);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    }),
    select: setChosen,
    ...(onOpenChange !== undefined ? { openOwn: onOpenChange } : {}),
  }), [hideDone, onOpenChange]);
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
      await Promise.all([local.read(), others.read(), ended.read(), stands.read(), held.read(), behind.read(), staged.read()]);
    } catch (cause) {
      setRefreshError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }

  const report = local.value;
  // What the picture is narrowed by, and whether the changes that have
  // landed are drawn (what-is-finished-is-tidied-away).
  const [filter, setFilter] = useState("");
  const [showLanded, setShowLanded] = useState(false);
  // Only the first reading: once a report has arrived it stays on screen
  // through every later poll, so there is nothing to wait for.
  const firstReading = report === undefined && local.error === undefined ? PIPELINE_FIRST_READING : null;
  useEffect(() => { onReadingChange?.(firstReading); }, [firstReading, onReadingChange]);
  const here = others.value?.directories.find((directory) => directory.isThis);
  // What a card calls another directory holding the same change. The main
  // checkout is named for what it is rather than for the folder it sits
  // in: that folder's name is whatever somebody cloned into, and on this
  // repository it reads as the product's own - "also in OpenSpec-UI" says
  // nothing about a place (the-board-is-of-every-change). A directory's
  // own heading still carries its own label, which is what it is for.
  const labels = new Map((others.value?.directories ?? []).map((directory) =>
    [directory.path, directory.isMain ? MAIN_DIRECTORY_LABEL : directory.label]));
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
  // The open form follows its card: a question asked after it opened is
  // added, and one answered anywhere leaves it (live, 2026-10-08: the form
  // kept the questions it opened with). A card this view does not draw keeps
  // the questions the form opened with.
  const answerCard = answerFor !== undefined ? cards.get(answerFor.changeName) : undefined;
  const answerTarget: AnswerTarget | undefined = answerFor === undefined
    ? undefined
    : answerCard === undefined
      ? answerFor
      : { ...answerFor, questions: answerCard.openQuestions ?? (answerCard.run?.waiting?.kind === "question" ? answerCard.run.waiting.questions : []) };
  const nothingLeftToAnswer = answerTarget !== undefined && answerTarget.questions.length === 0;
  useEffect(() => {
    if (nothingLeftToAnswer) setAnswerFor(undefined);
  }, [nothingLeftToAnswer]);
  // What has landed, from the standings rather than from the words on a
  // card: a merged pull request, the change archived on the default
  // branch, or deleted from it after being there
  // (what-is-finished-is-tidied-away).
  // What the default branch already carries archived, for a foreign card
   // to say so (main-catches-up-with-what-landed).
  const archivedOnDefault = new Set((stands.value?.standings ?? [])
    .filter((standing) => standing.main?.kind === "archived")
    .map((standing) => standing.changeName));
  const landed = new Set((stands.value?.standings ?? [])
    .filter((standing) => standing.pullRequest?.state === "MERGED"
      || standing.main?.kind === "archived"
      || standing.main?.kind === "deleted")
    .map((standing) => standing.changeName));
  const wordsOf = (changeName: string) => {
    const card = cards.get(changeName);
    // The same word the card draws, asked of core rather than read off the
    // rendered element.
    const described = card === undefined ? undefined : describeChangeState(card.stateFacts);
    return [changeName, card?.state, described?.word, ...(described?.lines ?? []).map((line) => line.text)]
      .filter((word): word is string => typeof word === "string");
  };
  const matches = (changeName: string) => matchesFilter(filter, wordsOf(changeName));
  const landedHere = (report?.changes ?? []).filter((change) => landed.has(change.changeName));
  // The board only where the stages were read: an arrangement by stage
  // with no stage read would put every change in one column and say
  // nothing (the-board-shows-the-stages).
  // A change the default branch already carries archived is Archived,
  // whatever a checkout behind it still holds (a-landed-change-leaves-the-board).
  const stageSummaries = new Map(settleOnDefaultBranch(staged.value ?? [], archivedOnDefault).map((summary) => [summary.changeName, summary]));
  const onBoard = arrangement === "stages" && staged.value !== undefined;
  // A filter reaching into the folded group opens it, as the Change
  // Graph's fold does.
  //
  // The board never folds. Landed is a column of it, so hiding what
  // landed empties that column by construction and leaves a board that
  // cannot show the one thing it exists to show - where each change is
  // (the-board-is-of-every-change).
  const foldLanded = !onBoard && !showLanded && !landedHere.some((change) => filter.trim().length > 0 && matches(change.changeName));
  const shownChanges = (report?.changes ?? [])
    .filter((change) => matches(change.changeName))
    .filter((change) => !foldLanded || !landed.has(change.changeName));
  const shownReport = report === undefined ? undefined : { ...report, changes: shownChanges };
  const foldedCount = foldLanded ? landedHere.length : 0;
  // The board is of the work, not of one folder: every change of every
  // working directory of this repository stands on it, one card per change
  // (ADR 0029, a-change-is-one-card-wherever-it-is). The arrangement by
  // declared order keeps to this checkout - an order is what this
  // repository declares here, and another directory's is its own.
  const namesHere = new Set((report?.changes ?? []).map((change) => change.changeName));
  const elsewhere = new Map<string, { directory: Extract<SurveyedDirectory, { readable: true }>; change: SurveyedChange }>();
  if (onBoard) {
    for (const one of others.value?.directories ?? []) {
      if (!one.readable || one.isThis) continue;
      for (const change of one.changes) {
        if (namesHere.has(change.changeName) || elsewhere.has(change.changeName)) continue;
        // A copy left in a worktree after its change was archived on the
        // default branch is not work: the archive's own card stands for it
        // (a-landed-change-leaves-the-board).
        if (archivedOnDefault.has(change.changeName)) continue;
        if (!matches(change.changeName)) continue;
        elsewhere.set(change.changeName, { directory: one, change });
      }
    }
  }
  // What was archived lately, in the column it ends in. A change leaves
  // `openspec/changes` when it is archived, so without this reading the
  // last column of the board is empty by construction - and a column that
  // can never hold anything says nothing about the way through
  // (the-board-remembers-what-was-archived).
  const filedRecently = onBoard
    ? (filed.value?.recent ?? []).filter((one) => !namesHere.has(one.changeName) && !elsewhere.has(one.changeName) && matches(one.changeName))
    : [];
  const boardReport = shownReport === undefined
    ? undefined
    : {
      ...shownReport,
      changes: [
        ...shownReport.changes,
        ...[...elsewhere.values()].map((one) => asLayoutInput(one.change)),
        ...filedRecently.map((one) => asArchivedLayoutInput(one.changeName)),
      ],
    };
  const nothingToDraw = boardReport === undefined || boardReport.changes.length === 0;
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
    ...(onUpdatePlan !== undefined ? { onUpdatePlan } : {}),
    ...(onViewLogs !== undefined ? { onViewLogs } : {}),
    ...(copyText !== undefined ? { copyText } : {}),
    onAskStop: setStopFor,
    canAskToStop: onAskToStop !== undefined,
    ...(onAnswerQuestion !== undefined ? { onAnswer: setAnswerFor } : {}),
    ...(changeActions !== undefined
      ? {
        actions: changeActions,
        chooseAction: (action: ChangeAction, changeName: string) => {
          if (action.confirm) setConfirmFor({ action, changeName });
          else changeActions.perform(action.id, changeName, { confirmed: false });
        },
      }
      : {}),
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
  // One legend for the tab, above the picture, where any picture draws a
  // line between cards. Said once: the first capture put the same lines
  // above every directory.
  const showLegend = (report !== undefined && drawsAnEdge(report.changes))
    || (others.value?.directories ?? []).some((directory) => !directory.isThis
      && directory.readable
      && drawsAnEdge(directory.changes.filter((change) => change.changeName !== directory.belongsTo)));

  // The chosen task as the latest reading has it, by its directory, its
  // change and its line: a tick or a note changes the row, and the panel
  // shows what is now true rather than what was pressed. A line does not
  // move when a note is written under it (a-card-works-its-own-tasks).
  const currentSelection = (selection: TaskSelection): TaskSelection => {
    const line = selection.row?.lineNumber;
    if (line === undefined) return selection;
    const card = cards.get(selection.changeName);
    const fromCard = card !== undefined && (card.where.path === selection.directory || (card.where.path === "" && selection.directory === localDirectory))
      ? card.tasks
      : undefined;
    const directory = others.value?.directories.find((one) => one.path === selection.directory);
    const surveyed = directory?.readable ? directory.changes.find((change) => change.changeName === selection.changeName)?.tasks : undefined;
    const rows = fromCard ?? (surveyed !== undefined ? describeTaskRows(surveyed, undefined) : undefined);
    const row = rows?.find((candidate) => candidate.lineNumber === line);
    return row === undefined ? selection : { ...selection, row };
  };

  // Each reading is shown when it arrives (the-pipeline-shows-what-it-has-read).
  // This directory's part says it is still being read, or why it could not
  // be, in its own place; the other working directories are drawn whatever
  // became of it. A reading that failed after one that arrived keeps the
  // picture it had, under the error, and the read-at line says how old it is.
  return (
    // The zoom is one factor on everything the picture draws, cards, text
    // and lines alike; no layout unit changes with it.
    <TaskCardContext.Provider value={taskCards}>
    <div ref={root} data-testid="pipeline" className="openspec-pipeline" style={{ "--pipeline-zoom": zoom } as Record<string, number>}>
      <div className="openspec-pipeline-toolbar" data-testid="pipeline-view-controls">
        <div className="openspec-pipeline-toolbar-text">
          {here ? (
            <p className="openspec-pipeline-toolbar-reading" data-testid="pipeline-reading-branch">
              Read from <strong>{branchPhrase(here)}</strong> in {here.label}
            </p>
          ) : null}
          <p className="openspec-pipeline-toolbar-note" data-testid="pipeline-read-at">
            {/* A reading, not a subscription: between two of them a run can
                start and finish, so this never presents itself as live. */}
            Last read {local.readAt ? local.readAt.toLocaleTimeString() : "not yet"}
            {survey ? `; other working directories ${others.readAt ? others.readAt.toLocaleTimeString() : "not yet"}` : ""}.
          </p>
          {here ? (
            <ul className="openspec-pipeline-toolbar-runs" data-testid="pipeline-reading-runs">
              {describeDirectoryRuns(here, now, onCards).map((line, index) => <li key={index}>{line}</li>)}
            </ul>
          ) : null}
        </div>
        <div className="openspec-pipeline-toolbar-actions">
          <button className="openspec-pipeline-button" type="button" data-testid="pipeline-open-all" onClick={() => setOpen(new Set(openableKeys()))}>
            <ChevronIcon up={false} />Show Tasks
          </button>
          <button className="openspec-pipeline-button" type="button" data-testid="pipeline-close-all" disabled={open.size === 0} onClick={() => setOpen(new Set())}>
            <ChevronIcon up />Hide Tasks
          </button>
          <div className="openspec-pipeline-zoom" role="group" aria-label="Zoom">
            <button type="button" aria-label="Zoom out" data-testid="pipeline-zoom-out" disabled={zoomIndex <= 0} onClick={() => setZoom(PIPELINE_ZOOM_STEPS[zoomIndex - 1] ?? zoom)}>
              <MinusIcon />
            </button>
            {/* The level is the control that resets it. */}
            <button type="button" aria-label="Reset zoom" data-testid="pipeline-zoom-reset" disabled={zoom === DEFAULT_ZOOM} onClick={() => setZoom(DEFAULT_ZOOM)}>
              <span data-testid="pipeline-zoom-level"><span className="openspec-visually-hidden">Zoom </span>{`${Math.round(zoom * 100)}%`}</span>
            </button>
            <button type="button" aria-label="Zoom in" data-testid="pipeline-zoom-in" disabled={zoomIndex >= PIPELINE_ZOOM_STEPS.length - 1} onClick={() => setZoom(PIPELINE_ZOOM_STEPS[zoomIndex + 1] ?? zoom)}>
              <PlusIcon />
            </button>
          </div>
          {/* Two arrangements of the same cards: by what each change waits
              for, or as a board of the stages it goes through
              (the-board-shows-the-stages). Offered only where a host reads
              the stages. */}
          {stages ? (
            <div className="openspec-pipeline-arrangement" role="group" aria-label="Arrangement" data-testid="pipeline-arrangement">
              <button
                type="button"
                data-testid="pipeline-arrangement-steps"
                aria-pressed={arrangement === "steps"}
                onClick={() => setArrangement("steps")}
              >
                By step
              </button>
              <button
                type="button"
                data-testid="pipeline-arrangement-stages"
                aria-pressed={arrangement === "stages"}
                onClick={() => setArrangement("stages")}
              >
                By stage
              </button>
            </div>
          ) : null}
          {/* The order within each column (the-board-sorts-its-cards). Names
              are read as a person reads numbers, so a numbered change stands
              in its place. */}
          <label className="openspec-pipeline-order">
            <span>Sort</span>
            <select value={order} data-testid="pipeline-order" onChange={(event) => setOrder(event.target.value as ChangeOrder)}>
              {CHANGE_ORDERS.map((one) => <option key={one} value={one}>{describeChangeOrder(one)}</option>)}
            </select>
          </label>
          {refresh ? (
            <button className="openspec-pipeline-button" type="button" data-testid="pipeline-refresh" disabled={refreshing} onClick={() => void refreshNow()}>
              <RefreshIcon />{refreshing ? "Refreshing…" : "Refresh Pipeline"}
            </button>
          ) : null}
          {/* The same narrowing the editor's views take, over a change's
              name and the word beside it (what-is-finished-is-tidied-away). */}
          <label className="openspec-pipeline-filter">
            <span className="openspec-visually-hidden">Filter changes</span>
            <input
              type="search"
              value={filter}
              placeholder="Filter changes"
              data-testid="pipeline-filter"
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
        </div>
      </div>
      <WaitingBanner
        cards={[...cards.values()]}
        heldRuns={heldRuns}
        {...(onAnswerQuestion !== undefined ? { onAnswer: setAnswerFor } : {})}
        {...(sendRunControl !== undefined ? { onRunControl: sendRunControl } : {})}
      />
      {refs ? <p className="openspec-shell-note" data-testid="pipeline-refs">{refs}</p> : null}
      {refreshError !== undefined
        ? <p className="openspec-shell-error" role="alert" data-testid="pipeline-refresh-error">{`Refresh failed: ${refreshError}`}</p>
        : null}

      {/* The board is of the work, so it is named for the work; the
          arrangement by declared order draws this checkout's own changes
          and says so (a-change-is-one-card-wherever-it-is). */}
      <section className="openspec-panel openspec-pipeline-panel" aria-label={onBoard ? "Changes" : "Changes in this checkout"}>
        <div className="openspec-panel-head">
          <h2>{onBoard ? "Changes" : "Changes in this checkout"}</h2>
          <span className="openspec-panel-head-note">
            {onBoard ? "a column is where a change is now, wherever it is worked" : "a column starts after the ones before it"}
          </span>
        </div>
        <div className="openspec-pipeline-panel-body">
          {filter.trim().length > 0 && report !== undefined ? (
            <p className="openspec-shell-note" data-testid="pipeline-filtered">
              {shownChanges.length === 0
                ? `Nothing matches "${filter.trim()}"`
                : `Filtered by "${filter.trim()}" - showing ${shownChanges.length} of ${report.changes.length}`}
            </p>
          ) : null}
          {/* How far this checkout is behind what has landed. Said only
              where it is behind: a line that is always there is a line
              nobody reads (main-catches-up-with-what-landed). */}
          {behind.value !== undefined && behind.value.behind > 0 ? (
            <p className="openspec-pipeline-landed" data-testid="pipeline-drift">
              <span>{driftWords(behind.value)}</span>
              {onCatchUp ? (
                <button
                  type="button"
                  className="openspec-pipeline-button"
                  data-testid="pipeline-catch-up"
                  onClick={() => void (async () => {
                    const result = await onCatchUp();
                    setCaughtUp(result.ok
                      ? `Moved ${behind.value?.defaultBranch ?? "main"} on by ${result.moved} ${result.moved === 1 ? "commit" : "commits"}.`
                      : `Not caught up: ${result.why}.`);
                    await behind.read();
                  })()}
                >
                  Update Main
                </button>
              ) : null}
              {caughtUp !== null ? <span data-testid="pipeline-catch-up-said">{caughtUp}</span> : null}
            </p>
          ) : null}
          {foldedCount > 0 ? (
            <p className="openspec-pipeline-landed" data-testid="pipeline-landed">
              <span>{`${foldedCount} ${foldedCount === 1 ? "change has" : "changes have"} landed`}</span>
              <button type="button" className="openspec-pipeline-button" data-testid="pipeline-show-landed" onClick={() => setShowLanded(true)}>
                Show Landed Changes
              </button>
              {onArchive ? (
                <button
                  type="button"
                  className="openspec-pipeline-button"
                  data-testid="pipeline-archive-landed"
                  onClick={() => setArchiveLanded(landedHere.map((change) => change.changeName))}
                >
                  Archive Landed Changes...
                </button>
              ) : null}
            </p>
          ) : null}
          {showLanded && landedHere.length > 0 ? (
            <p className="openspec-shell-note" data-testid="pipeline-landed-shown">
              <span>{`${landedHere.length} of these have landed.`}</span>
              <button type="button" className="openspec-pipeline-button" data-testid="pipeline-hide-landed" onClick={() => setShowLanded(false)}>
                Hide Landed Changes
              </button>
            </p>
          ) : null}
          {showLegend ? <Legend testId="pipeline-legend" /> : null}
          {local.error !== undefined
            ? <p className="openspec-shell-error" role="alert" data-testid="pipeline-error">{local.error}</p>
            : null}
          {report === undefined
            ? (local.error === undefined
              ? <p className="openspec-shell-note" data-testid="pipeline-loading">{PIPELINE_FIRST_READING}</p>
              : null)
            : nothingToDraw && !onBoard
              // Names the branch it read where the survey says which: an
              // empty queue and a reading taken on a stale checkout
              // otherwise look identical.
              ? (report.changes.length === 0
                ? <p className="openspec-shell-note" data-testid="pipeline-empty">No active changes{here ? ` on ${branchPhrase(here)}` : ""}.</p>
                : <p className="openspec-shell-note" data-testid="pipeline-none-shown">Nothing to draw here.</p>)
              : (
                <>
                  {/* Drawn even with nothing on it. A board whose columns
                      appeared only once something stood in them would say
                      nothing about the way through, and a person pressing
                      "By stage" on an empty queue would see no board at
                      all (the-board-is-of-every-change). */}
                  <LocalPicture report={boardReport ?? { ...report, changes: [] }} cards={cards} now={now} onOpenChange={onOpenChange} alsoIn={alsoInHere(here, labels)} controls={controls} directory={localDirectory} openCards={openCards} stages={stageSummaries} onBoard={onBoard} elsewhere={elsewhere} labels={labels} archivedOnMain={archivedOnDefault} filed={filedRecently} order={order} surveyedHere={here !== undefined && here.readable ? here.changes : []} {...(teamColumns !== undefined ? { teamColumns } : {})} />
                  {/* A file that breaks a rule is refused whole, and said:
                      silence would leave a person believing the board is
                      theirs (a-team-names-its-columns). */}
                  {onBoard && named.value?.kind === "refused" ? (
                    <p className="openspec-shell-note" data-testid="pipeline-columns-refused">{`openspec/board.json is not used: ${named.value.reason}`}</p>
                  ) : null}
                  {/* The archive holds more than a board should draw: the
                      rest is counted, never listed. */}
                  {onBoard && describeOlderArchive(filed.value) !== undefined ? (
                    <p className="openspec-shell-note" data-testid="pipeline-archive-more">{describeOlderArchive(filed.value)}</p>
                  ) : null}
                  {nothingToDraw ? (
                    <p className="openspec-shell-note" data-testid="pipeline-board-empty">
                      {report.changes.length === 0
                        ? `No active changes${here ? ` on ${branchPhrase(here)}` : ""}: every column is empty.`
                        : "Every column is empty: nothing here matches the filter."}
                    </p>
                  ) : null}
                </>
              )}
        </div>
      </section>

      {/* From the report this already read: no second fetch, and no
          suggestion computed here — `buildHints` derived them in core
          before the payload was sent. */}
      {report !== undefined ? <HintList hints={report.hints} {...(copyText !== undefined ? { copyText } : {})} /> : null}
      {others.value ? <OtherDirectories survey={others.value} labels={labels} now={now} onCards={onCards} openCards={openCards} archivedOnMain={archivedOnDefault} drawsChanges={!onBoard} order={order} controls={controls} /> : null}
      {others.error !== undefined
        ? <p className="openspec-shell-note" data-testid="pipeline-survey-error">The other working directories could not be read: {others.error}</p>
        : null}
      {answerTarget !== undefined && !nothingLeftToAnswer && onAnswerQuestion !== undefined ? (
        <ModalLayer onCancel={() => setAnswerFor(undefined)}>
        <AnswerQuestionsForm
          target={answerTarget}
          onAnswer={(questionId, answer) => {
            onAnswerQuestion({
              changeName: answerTarget.changeName,
              ...(answerTarget.runId !== undefined ? { runId: answerTarget.runId } : {}),
              workingDirectory: answerTarget.workingDirectory,
              questionId,
              answer,
            });
            setTimeout(() => void Promise.all([others.read(), held.read()]), RUN_CONTROL_REREAD_MS);
          }}
          onClose={() => setAnswerFor(undefined)}
        />
        </ModalLayer>
      ) : null}
      {archiveLanded !== undefined && onArchive !== undefined ? (
        <ModalLayer onCancel={() => setArchiveLanded(undefined)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Archive Landed Changes"
            className="openspec-pipeline-stop-form"
            data-testid="pipeline-confirm-archive-landed"
            onSubmit={(event) => {
              event.preventDefault();
              onArchive(archiveLanded);
              setArchiveLanded(undefined);
            }}
          >
            <p><strong>{`Archive ${archiveLanded.length === 1 ? archiveLanded[0] : `${archiveLanded.length} landed changes`}?`}</strong></p>
            <p>Their specs are merged into openspec/specs, and the changes move to the archive.</p>
            <div className="openspec-pipeline-stop-form-actions">
              <button type="submit" className="openspec-pipeline-button openspec-pipeline-button--stop" data-testid="pipeline-confirm-archive-landed-yes">Archive</button>
              <button type="button" className="openspec-pipeline-button" onClick={() => setArchiveLanded(undefined)}>Cancel</button>
            </div>
          </form>
        </ModalLayer>
      ) : null}
      {confirmFor !== undefined && changeActions !== undefined ? (
        <ModalLayer onCancel={() => setConfirmFor(undefined)}>
        <ConfirmActionForm
          action={confirmFor.action}
          changeName={confirmFor.changeName}
          onConfirm={() => {
            changeActions.perform(confirmFor.action.id, confirmFor.changeName, { confirmed: true });
            setConfirmFor(undefined);
          }}
          onCancel={() => setConfirmFor(undefined)}
        />
        </ModalLayer>
      ) : null}
      {stopFor !== undefined && ("runId" in stopFor ? sendRunControl !== undefined : onAskToStop !== undefined) ? (
        <ModalLayer onCancel={() => setStopFor(undefined)}>
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
        </ModalLayer>
      ) : null}
      {chosen !== undefined ? (
        <ModalLayer onCancel={() => setChosen(undefined)}>
        <TaskPanel
          selection={currentSelection(chosen)}
          {...(taskActions !== undefined ? { actions: taskActions } : {})}
          {...(copyText !== undefined ? { copyText } : {})}
          onClose={() => setChosen(undefined)}
          // What a press changed is read again at once, and the panel shows
          // the task as it now reads.
          onChanged={() => void Promise.all([local.read(), others.read(), ended.read()])}
        />
        </ModalLayer>
      ) : null}
    </div>
    </TaskCardContext.Provider>
  );
}

function branchPhrase(directory: SurveyedDirectory): string {
  if (directory.branch) return `branch ${directory.branch}`;
  if (directory.head) return `a detached head at ${directory.head.slice(0, 7)}`;
  return "no branch";
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

/** Everything a card of this checkout draws, worked out before the picture
 * is laid out, so its height can be derived from it. */
interface LocalCardModel {
  change: ChangeReadiness;
  card: ChangeCard;
  described: DescribedChangeCard;
  /** A waiting run's question, drawn above the facts. */
  callout?: string;
  details: CardDetail[];
  buttons: ReactNode[];
  /** The change's actions, each with whether it can run now. */
  actions: ChangeActionState[];
  /** The run this card shows was started by this host. */
  startedHere: boolean;
  rows: TaskRow[];
  title: string;
}

function localCardModel(change: ChangeReadiness, card: ChangeCard, now: Date, alsoIn: string[] | undefined, controls: CardControlHandlers, stage?: ChangeStageSummary): LocalCardModel {
  const described = describeChangeCard(card, now);
  const waiting = described.details.find((detail) => detail.kind === "waiting");
  // The card's own facts first — what the change is doing — then what
  // readiness says about starting it beside the others.
  const readiness = describeChange(change);
  const also: CardDetail[] = alsoIn && alsoIn.length > 0 ? [{ kind: "where", text: `also in ${alsoIn.join(", ")}` }] : [];
  // Where the change is and who holds it, in core's words, on every card
  // in either arrangement (the-board-shows-the-stages).
  const onStage: CardDetail[] = stage === undefined ? [] : [{ kind: "where", text: describeStageLine(stage, now) }];
  return {
    change,
    card,
    described,
    ...(waiting !== undefined ? { callout: waiting.text } : {}),
    details: [...described.details.filter((detail) => detail !== waiting), ...onStage, ...readiness, ...also],
    buttons: cardControls(card, controls),
    actions: cardActionStates(localActionFacts(card), controls.actions),
    startedHere: card.run?.ownedHere === true,
    rows: card.tasks ?? [],
    // The whole of the text, for a reader whose card cut a line.
    title: `${change.changeName} — ${[described.stateWords, ...described.lines, ...onStage.map((detail) => detail.text), ...readiness.map((detail) => detail.text), ...also.map((detail) => detail.text)].join(" ")}`,
  };
}

/** What decides a card's actions: where its facts were read, whether a run
 * of it is going, and its open tasks. */
function localActionFacts(card: ChangeCard): ChangeActionFacts {
  const where = !card.where.ownWorktree ? "checkout" : card.run?.signature === "does-not-check-out" ? "unverified" : "worktree";
  return {
    where,
    running: card.run !== undefined,
    ...(card.progress !== undefined ? { openTasks: card.progress.total - card.progress.done } : {}),
  };
}

/** The same for a change read from its own worktree, beside this
 * checkout's; `undefined` for one its directory is not the worktree of,
 * which stays read-only (ADR 0026, amended 2026-10-05). */
function elsewhereActionFacts(change: SurveyedChange, directory: Extract<SurveyedDirectory, { readable: true }>): ChangeActionFacts | undefined {
  if (directory.ownChange !== change.changeName) return undefined;
  const runs = directory.runs.filter((run) => run.changeName === change.changeName && !run.gone);
  return {
    where: runs.some((run) => run.signature === "does-not-check-out") ? "unverified" : "worktree",
    running: runs.length > 0,
    ...(!change.tasksUnreadable ? { openTasks: change.tasksTotal - change.tasksDone } : {}),
    ...(directory.notOnServer !== undefined ? { notOnServer: true } : {}),
  };
}

/** Whether a run of the change reports from its own worktree now. */
function runningHere(directory: Extract<SurveyedDirectory, { readable: true }>, changeName: string): boolean {
  return directory.runs.some((run) => run.changeName === changeName && !run.gone);
}

/** What a card of a change's own worktree says where the server does not
 * have the change's branch as it is there (a-change-is-committed-where-it-is-made). */
function notOnServerDetails(change: SurveyedChange | undefined, directory: Extract<SurveyedDirectory, { readable: true }>): CardDetail[] {
  if (change === undefined || directory.ownChange !== change.changeName || directory.notOnServer === undefined) return [];
  return [{
    kind: "where",
    text: directory.notOnServer === "never-pushed" ? "not on the server: its branch was never pushed" : "not on the server as it is here",
  }];
}

function hasProgress(card: ChangeCard): boolean {
  return card.progress !== undefined && card.progress.total > 0;
}

function LocalPicture({ report, cards, now, onOpenChange, alsoIn, controls, directory, openCards, stages, onBoard, elsewhere, filed, labels, archivedOnMain, order, surveyedHere, teamColumns }: {
  /** A team's own columns, where `openspec/board.json` names good ones. */
  teamColumns?: readonly BoardColumn[];
  report: ChangeReadinessReport;
  /** The order each column's cards stand in (the-board-sorts-its-cards). */
  order: ChangeOrder;
  /** This checkout's own changes as the survey read them: when each task
   * list last changed, for the order by what was worked on last. */
  surveyedHere: readonly SurveyedChange[];
  cards: Map<string, ChangeCard>;
  now: Date;
  onOpenChange?: (name: string) => void;
  alsoIn: Map<string, string[]>;
  controls: CardControlHandlers;
  /** The path this picture is drawn for, which its open cards are kept by. */
  directory: string;
  openCards: OpenCards;
  /** Where each change is and who holds it, where the host read it. */
  stages: Map<string, ChangeStageSummary>;
  /** Whether the cards are arranged as a board of the stages. */
  onBoard: boolean;
  /** The changes of this repository's other working directories, by name,
   * each with the directory that holds it. They stand on the board beside
   * this checkout's own, read-only, because a board is of the work and not
   * of one folder (a-change-is-one-card-wherever-it-is). Empty in the
   * arrangement by declared order, which draws this checkout alone. */
  elsewhere: Map<string, { directory: Extract<SurveyedDirectory, { readable: true }>; change: SurveyedChange }>;
  /** What was archived lately, for the column it ends in. Empty in the
   * arrangement by declared order, which draws what can still be run
   * (the-board-remembers-what-was-archived). */
  filed: readonly ArchivedChange[];
  labels: Map<string, string>;
  archivedOnMain: ReadonlySet<string>;
}) {
  // Every card's height is derived from what it holds, and a column stacks
  // by those heights: only the cards below a card that grows move, and
  // nothing is measured (the-pipeline-cards-wear-metro).
  const models = new Map<string, LocalCardModel>();
  const heights = new Map<string, number>();
  // A card whose done tasks are hidden lists fewer rows, and is as tall as
  // what it lists (a-card-works-its-own-tasks).
  const taskCards = useContext(TaskCardContext);
  const elsewhereActions = new Map<string, ChangeActionState[]>();
  for (const [name, { directory: where, change }] of elsewhere) {
    const openRows = openParts(change.tasks ?? [], openCards.isOpen(where.path, name), taskCards.hidesDone(where.path, name));
    const facts = elsewhereActionFacts(change, where);
    const actions = facts === undefined ? [] : cardActionStates(facts, controls.actions);
    elsewhereActions.set(name, actions);
    heights.set(name, pipelineCardHeight({
      hasState: false,
      hasProgress: !change.tasksUnreadable && change.tasksTotal > 0,
      hasCallout: false,
      detailLines: elsewhereDetails(change, where, labels, archivedOnMain, stages.get(name), now).length,
      hasControls: facts !== undefined && controls.onStart !== undefined,
      actionRows: cardActionRows(actions).length,
      ...(openRows !== undefined ? { open: openRows } : {}),
    }));
  }
  for (const change of report.changes) {
    const card = cards.get(change.changeName);
    if (card === undefined) continue;
    const model = localCardModel(change, card, now, alsoIn.get(change.changeName), controls, stages.get(change.changeName));
    models.set(change.changeName, model);
    const openRows = openParts(model.rows, openCards.isOpen(directory, change.changeName), taskCards.hidesDone(directory, change.changeName));
    heights.set(change.changeName, pipelineCardHeight({
      hasState: true,
      hasProgress: hasProgress(card),
      hasCallout: model.callout !== undefined,
      detailLines: model.details.length,
      hasControls: model.buttons.length > 0,
      actionRows: cardActionRows(model.actions).length,
      ...(openRows !== undefined ? { open: openRows } : {}),
    }));
  }
  const filedByName = new Map(filed.map((one) => [one.changeName, one]));
  for (const one of filed) {
    heights.set(one.changeName, pipelineCardHeight({ hasState: false, hasProgress: false, hasCallout: false, detailLines: 1, hasControls: false }));
  }
  // An archived change is in the Archived column by what it is, not by a
  // fact anybody reads for it: it is in the archive.
  const stageOf = stagesByName([...stages.values()]);
  for (const one of filed) stageOf.set(one.changeName, "archived");
  // Every card's place in its column, from what each card knows; the
  // facts are core's, as the comparison is (the-board-sorts-its-cards).
  const surveyedByName = new Map(surveyedHere.map((change) => [change.changeName, change]));
  const orderFacts = new Map<string, ChangeOrderFacts>();
  for (const change of report.changes) {
    const card = cards.get(change.changeName);
    const surveyed = surveyedByName.get(change.changeName);
    orderFacts.set(change.changeName, orderFactsOf({ ...(card !== undefined ? { card } : {}), ...(surveyed !== undefined ? { surveyed } : {}) }));
  }
  for (const [name, { change }] of elsewhere) orderFacts.set(name, orderFactsOf({ surveyed: change }));
  for (const one of filed) orderFacts.set(one.changeName, orderFactsOf({ archivedOn: one.archivedOn }));
  const rank = rankChanges([...orderFacts.keys()], order, orderFacts);
  const layout = onBoard
    ? layoutChangesByStage(report, { heights, stages: stageOf, rank, ...(teamColumns !== undefined ? { columns: teamColumns } : {}) })
    : layoutChanges(report, { heights, rank });
  return (
    <>
      {layout.cycles.length > 0 ? <Cycles cycles={layout.cycles} /> : null}
      <Picture
        layout={layout}
        testIdPrefix="pipeline-"
        laneHeading="h3"
        renderNode={(node) => {
          const name = node.change.changeName;
          // A change that is done: its card says when it was filed away
          // and offers nothing at all
          // (the-board-remembers-what-was-archived).
          const wasFiled = filedByName.get(name);
          if (wasFiled !== undefined) {
            return (
              <div
                key={name}
                className="openspec-pipeline-node openspec-pipeline-node--foreign"
                data-testid={`pipeline-node-${name}`}
                data-state="archived"
                style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
                title={`${name} — archived on ${wasFiled.archivedOn}`}
              >
                <div className="openspec-pipeline-node-head">
                  <span className="openspec-pipeline-node-name">{name}</span>
                </div>
                <CardDetails details={[{ kind: "where", text: `archived on ${wasFiled.archivedOn}` }]} />
              </div>
            );
          }
          // A change of another working directory: read here and never
          // acted on from here, so its card offers nothing but its tasks
          // (ADR 0026).
          const foreign = elsewhere.get(name);
          if (foreign !== undefined) {
            return (
              <ElsewhereNode
                key={name}
                node={node}
                change={foreign.change}
                where={foreign.directory}
                labels={labels}
                archivedOnMain={archivedOnMain}
                stage={stages.get(name)}
                now={now}
                testId={`pipeline-node-${name}`}
                open={openCards.isOpen(foreign.directory.path, name)}
                onToggle={() => openCards.toggle(foreign.directory.path, name)}
                actions={elsewhereActions.get(name) ?? []}
                {...(controls.chooseAction !== undefined ? { onChooseAction: controls.chooseAction } : {})}
                {...(controls.onStart !== undefined ? { onStart: controls.onStart } : {})}
              />
            );
          }
          // Every change of the report has a card: they are derived from it.
          const model = models.get(name);
          return model === undefined ? null : (
            <Node
              key={name}
              node={node}
              model={model}
              onOpenChange={onOpenChange}
              directory={directory}
              open={openCards.isOpen(directory, name)}
              onToggle={() => openCards.toggle(directory, name)}
              {...(controls.chooseAction !== undefined ? { onChooseAction: controls.chooseAction } : {})}
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
    <ul className="openspec-pipeline-legend" data-testid={testId}>
      <li><span className="openspec-pipeline-legend-edge" aria-hidden="true" />A line from one card to another means the second waits for the first.</li>
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
      <ChevronIcon up={open} />
    </button>
  );
}

/** A marker a row's word already says: `**Human-only**:` or
 * `**Delegated to claude-cli**:` at the start of its text. */
const MARKER_LEAD_RE = /^\*\*[^*]+\*\*:?\s*/u;

/** The tag a row draws for its word: the word itself where it fits a tag,
 * shortened where it does not. The whole word stays on the row. */
function taskTag(row: TaskRow): { text: string; tone: "done" | "hand" | "next" | "open" | "person" | "agent" } {
  if (row.word === "done") return { text: "Done", tone: "done" };
  if (row.word === "in hand") return { text: "In hand", tone: "hand" };
  if (row.word === "probably next") return { text: "Probably next", tone: "next" };
  if (row.word === "only a person can close it") return { text: "A person", tone: "person" };
  if (row.word.startsWith("delegated to ")) return { text: row.word.slice("delegated to ".length), tone: "agent" };
  return { text: "Open", tone: "open" };
}

/** An open card's tasks, in the task list's order, under their headings,
 * as rows of a bordered list. Kept in the page while the card is closed,
 * and hidden, so the control that shows it always names an element. */
function TaskList({ id, rows, open, testId, onSelect }: {
  id: string;
  rows: readonly TaskRow[];
  open: boolean;
  testId: string;
  /** Opens a row whole, beside the board (a-card-works-its-own-tasks).
   * Absent, a row is text, as before. */
  onSelect?: (row: TaskRow) => void;
}) {
  const groups = taskGroups(rows);
  const list = useRef<HTMLDivElement>(null);
  // The task in hand is where a person looks first: an opened card brings
  // it into view.
  useEffect(() => {
    if (!open) return;
    const inHand = list.current?.querySelector<HTMLElement>("[data-word='in hand'], [data-word='probably next']");
    if (inHand !== null && inHand !== undefined && typeof inHand.scrollIntoView === "function") inHand.scrollIntoView({ block: "nearest" });
  }, [open]);
  return (
    <div id={id} ref={list} className="openspec-pipeline-node-tasks" data-testid={testId} hidden={!open}>
      {groups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {group.section !== undefined ? <p className="openspec-pipeline-task-section" title={group.section}>{group.section}</p> : null}
          <ol className="openspec-pipeline-tasks">
            {group.rows.map((row, index) => {
              const text = row.closedBy === "agent" ? row.text : row.text.replace(MARKER_LEAD_RE, "");
              const inHand = row.word === "in hand" || row.word === "probably next";
              const tag = taskTag(row);
              const classes = ["openspec-pipeline-task", inHand ? "openspec-pipeline-task--in-hand" : "", row.done ? "openspec-pipeline-task--done" : ""].filter(Boolean).join(" ");
              const words = (
                <>
                  <span className="openspec-pipeline-task-number">{row.number ?? ""}</span>
                  <span className="openspec-pipeline-task-text">{text}</span>
                </>
              );
              return (
                // The whole of the task in its hint: its number, its words and
                // what is written under it (a-card-works-its-own-tasks).
                <li key={index} className={classes} data-word={row.word} title={wholeTaskText(row)}>
                  {onSelect !== undefined ? (
                    <button
                      type="button"
                      className="openspec-pipeline-task-open"
                      data-testid={`${testId}-row-${row.number ?? index}`}
                      aria-label={`Open task ${row.number ?? ""} whole`}
                      onClick={() => onSelect(row)}
                    >
                      {words}
                    </button>
                  ) : words}
                  <span className={`openspec-pipeline-task-tag openspec-pipeline-task-tag--${tag.tone}`}>
                    <span aria-hidden="true">{tag.text}</span>
                    <span className="openspec-visually-hidden">{row.word}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** A card's own controls over its list, beside its name: hide the done
 * tasks, and open the list's actions beside the board
 * (a-card-works-its-own-tasks). */
function CardTaskTools({ changeName, directory, listedFrom, where, own, rows, open, testId }: {
  changeName: string;
  /** The directory the card is drawn for, which its hidden state is kept by. */
  directory: string;
  /** The directory its rows were read from, where it differs. */
  listedFrom?: string;
  where: string;
  own: boolean;
  rows: readonly TaskRow[];
  open: boolean;
  testId: string;
}) {
  const taskCards = useContext(TaskCardContext);
  const hiding = taskCards.hidesDone(directory, changeName);
  return (
    <>
      {open && rows.some((row) => row.done) ? (
        <button
          type="button"
          className="openspec-pipeline-node-tool"
          data-testid={`${testId}-hide-done`}
          aria-pressed={hiding}
          title={hiding ? "Show the done tasks" : "Hide the done tasks"}
          onClick={() => taskCards.toggleHideDone(directory, changeName)}
        >
          {hiding ? "Show Done Tasks" : "Hide Done Tasks"}
        </button>
      ) : null}
      {own && taskCards.select !== undefined ? (
        <button
          type="button"
          className="openspec-pipeline-node-tool"
          data-testid={`${testId}-task-list`}
          aria-label={`What can be done with ${changeName}'s task list`}
          title="Commit and push the task list, open the change's files"
          onClick={() => taskCards.select?.({ changeName, directory: listedFrom ?? directory, where, own })}
        >
          …
        </button>
      ) : null}
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
        {byColumn.map((nodes, column) => {
          // The board dresses its columns: a stage's picture and its own
          // colour beside its word, and how many stand in it
          // (the-board-wears-its-stages). Absent in the arrangement by
          // declared order, whose columns are a sequence rather than six
          // named places.
          const look = layout.laneLooks?.[column];
          const x = column * (NODE_WIDTH + COLUMN_GAP);
          return (
            <div className={`openspec-pipeline-lane${look ? " openspec-pipeline-stage-lane" : ""}`} key={column}>
              {/* A rule between stages, never before the first. */}
              {look && column > 0 ? (
                <div
                  className="openspec-pipeline-stage-rule"
                  aria-hidden="true"
                  style={{ "--x": x - COLUMN_GAP / 2 } as Record<string, number>}
                />
              ) : null}
              {/* Numbered where the arrangement is the declared order: the
                  repository states an order there, and each card says what
                  it waits on. The board heads its columns with the stages
                  core names (the-board-shows-the-stages). Placed by the same
                  units as the cards, in the strip core leaves above them. */}
              <Heading
                className={`openspec-pipeline-lane-heading${look ? " openspec-pipeline-stage-heading" : ""}`}
                style={{
                  "--x": x,
                  "--w": NODE_WIDTH,
                  "--h": LANE_HEADING,
                  ...(look
                    ? { "--stage-colour": `var(--${look.token})`, "--stage-ink": `var(--${look.token}-ink)` }
                    : {}),
                } as Record<string, number | string>}
              >
                {look ? <span className="openspec-pipeline-stage-mark"><Icon meaning={look.icon} /></span> : null}
                <span className={look ? "openspec-pipeline-stage-word" : undefined}>
                  {layout.lanes?.[column] ?? describeLane(column)}
                </span>
                {/* Said in words for a reader who hears the heading, and
                    shown as a figure for one who scans it. */}
                {look ? (
                  <span className="openspec-pipeline-stage-count" data-testid={`${testIdPrefix}stage-count-${column}`}>
                    <span className="openspec-visually-hidden">{`, ${nodes.length} ${nodes.length === 1 ? "change" : "changes"}`}</span>
                    <span aria-hidden="true">{nodes.length}</span>
                  </span>
                ) : null}
              </Heading>
              {nodes.map(renderNode)}
            </div>
          );
        })}
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

/** A card's bar for its tasks, with the count beside it. The bar is drawn
 * for the eye; the words say the same for everyone. */
function Progress({ done, total }: { done: number; total: number }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="openspec-pipeline-node-progress" data-complete={total > 0 && done === total ? "true" : "false"}>
      <span className="openspec-pipeline-node-bar" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </span>
      <span className="openspec-pipeline-node-count" aria-hidden="true">{`${done} / ${total} tasks`}</span>
      <span className="openspec-visually-hidden">{`${done} of ${total} tasks done`}</span>
    </div>
  );
}

function Node({ node, model, onOpenChange, directory, open, onToggle, onChooseAction }: {
  node: ChangeLayoutNode;
  model: LocalCardModel;
  onOpenChange?: (name: string) => void;
  onChooseAction?: (action: ChangeAction, changeName: string) => void;
  /** The directory this picture is drawn for, which the card's open and
   * hidden states are kept by. */
  directory: string;
  open: boolean;
  onToggle: () => void;
}) {
  const { change } = node;
  const { card, described } = model;
  const testId = `pipeline-node-${change.changeName}`;
  const taskCards = useContext(TaskCardContext);
  // The card's facts were read from the change's own worktree, where a
  // person may act; from anywhere else it is read-only (ADR 0026, amended
  // 2026-10-05).
  const own = card.where.ownWorktree;
  const listedFrom = card.where.path.length > 0 ? card.where.path : directory;
  const rows = shownRows(model.rows, taskCards.hidesDone(directory, change.changeName));
  const select = taskCards.select;
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
      // `rem`. In the narrow view the stylesheet ignores them.
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      title={model.title}
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
        <CardTaskTools changeName={change.changeName} directory={directory} listedFrom={listedFrom} where={card.where.label} own={own} rows={model.rows} open={open} testId={testId} />
        {model.rows.length > 0
          ? <TasksToggle name={change.changeName} open={open} listId={`${testId}-tasks`} testId={`${testId}-tasks-toggle`} onToggle={onToggle} />
          : null}
      </div>
      {onChooseAction !== undefined
        ? <CardActions changeName={change.changeName} states={model.actions} onChoose={(action) => onChooseAction(action, change.changeName)} testId={testId} />
        : null}
      {/* The state as a word, not only as a colour — two hues a reader
          cannot tell apart must still be two states. */}
      <div className="openspec-pipeline-node-state-row">
        <span className="openspec-pipeline-node-state" data-state={card.state}>{described.stateWords}</span>
        {described.note !== undefined ? <span className="openspec-pipeline-node-note">{described.note}</span> : null}
      </div>
      {card.progress !== undefined && hasProgress(card) ? <Progress done={card.progress.done} total={card.progress.total} /> : null}
      {model.callout !== undefined ? <p className="openspec-pipeline-node-callout">{model.callout}</p> : null}
      {/* The facts a closed card holds, open or not: opening a card adds its
          rows and changes nothing it says. */}
      <CardDetails details={model.details} />
      {rows.length > 0 ? (
        <TaskList
          id={`${testId}-tasks`}
          rows={rows}
          open={open}
          testId={`${testId}-tasks`}
          {...(select !== undefined
            ? { onSelect: (row: TaskRow) => select({ changeName: change.changeName, directory: listedFrom, where: card.where.label, own, row }) }
            : {})}
        />
      ) : null}
      {model.buttons.length > 0 ? (
        <div className="openspec-pipeline-node-controls" data-testid={`${testId}-controls`}>
          {model.buttons}
          {model.startedHere ? <span className="openspec-pipeline-node-started">started here</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** What a card's controls need from the view: the runs this host holds,
 * and where each control goes. */
interface CardControlHandlers {
  heldRuns: Map<string, LiveRun>;
  onRunControl?: (control: RunControl) => void;
  onStart?: (changeName: string, directory?: string) => void;
  onUpdatePlan?: (changeName: string) => void;
  onViewLogs?: (changeName: string) => void;
  copyText?: (text: string) => Promise<void>;
  onAskStop: (target: StopTarget) => void;
  /** The host can ask a run held elsewhere to stop. */
  canAskToStop: boolean;
  /** Opens the answer form for a run waiting on the operator (ADR 0042). */
  onAnswer?: (target: AnswerTarget) => void;
  /** What the host does with a change's actions, and what the view does when
   * one is chosen: asks first for a Danger one (a-change-is-acted-on-from-its-card). */
  actions?: ChangeActionsHost;
  chooseAction?: (action: ChangeAction, changeName: string) => void;
}

/** The buttons a card offers, from its facts alone. Answer, Stop and Stop
 * now only for a run this host holds; for a run held elsewhere, only its
 * folder to copy (a-change-is-run-from-its-card 5.2–5.8). Every button's
 * accessible name includes the change's name. The button that moves the
 * change forward is drawn as the primary one, a stop as a stopping one
 * (the-pipeline-cards-wear-metro). */
function cardControls(card: ChangeCard, handlers: CardControlHandlers): ReactNode[] {
  const buttons = runControls(card, handlers);
  // Last, and on every card: what a change's runs said is worth reading
  // whatever the change is doing now (a-change-shows-its-run-logs).
  if (handlers.onViewLogs !== undefined) {
    const view = handlers.onViewLogs;
    const name = card.changeName;
    buttons.push(
      <button key="logs" type="button" className="openspec-pipeline-button" data-testid={`pipeline-logs-${name}`} aria-label={`Show Logs ${name}`} onClick={() => view(name)}><Icon meaning="log" />Show Logs</button>,
    );
  }
  return buttons;
}

/** What a card's Answer opens: the change's open questions as its
 * decisions.md has them, or, before the survey has read them, those its
 * waiting run names (the-agent-asks-the-operator, ADR 0042). `undefined`
 * where nothing is asked. */
function answerTargetOf(card: ChangeCard): AnswerTarget | undefined {
  const run = card.run;
  const questions = card.openQuestions
    ?? (run?.waiting?.kind === "question" ? run.waiting.questions : undefined);
  if (questions === undefined || questions.length === 0) return undefined;
  return {
    changeName: card.changeName,
    ...(run !== undefined && run.ownedHere && run.runId !== null ? { runId: run.runId } : {}),
    workingDirectory: card.where.path || run?.workingDirectory || "",
    questions,
  };
}

/** The oldest permission request still open on a run this host holds, and
 * how many are: an agent running tool calls side by side asks for several
 * at once (live, 2026-10-08). A host that does not list them names the one
 * it holds. */
function permissionAskedOf(card: ChangeCard, heldRuns: Map<string, LiveRun>): { runId: string; requestId: string; description: string; count: number } | undefined {
  const run = card.run;
  const held = run !== undefined && run.ownedHere && run.runId !== null ? heldRuns.get(run.runId) : undefined;
  if (run === undefined || held === undefined) return undefined;
  const pendingHere = held.pendingPermissions ?? [];
  const oldest = pendingHere[0]
    ?? (run.waiting?.kind === "permission" && held.permissionRequestId !== null
      ? { requestId: held.permissionRequestId, description: run.waiting.description }
      : undefined);
  return oldest === undefined ? undefined : { runId: held.runId, ...oldest, count: Math.max(1, pendingHere.length) };
}

function runControls(card: ChangeCard, handlers: CardControlHandlers): ReactNode[] {
  const name = card.changeName;
  const buttons: ReactNode[] = [];
  const run = card.run;
  const forward = "openspec-pipeline-button openspec-pipeline-button--forward";
  // A run waiting on the operator's answer is answered from its card,
  // wherever it runs: the answer is written to its change's decisions.md
  // (the-agent-asks-the-operator, ADR 0042).
  const target = answerTargetOf(card);
  if (target !== undefined && handlers.onAnswer !== undefined) {
    const open = handlers.onAnswer;
    const questions = target.questions;
    buttons.push(
      <button key="answer" type="button" className={forward} data-testid={`pipeline-answer-${name}`} aria-label={`Answer Questions ${name}: ${questions.map((question) => question.text).join("; ")}`} onClick={() => open(target)}><Icon meaning="run" />Answer Questions...</button>,
    );
  }
  const stopping = "openspec-pipeline-button openspec-pipeline-button--stop";
  const plain = "openspec-pipeline-button";

  if (run === undefined) {
    // A change whose every task is done continues at verify, so it can start.
    if (handlers.onStart !== undefined && (card.state === "ready" || card.state === "failed" || card.state === "stopped" || card.state === "done")) {
      const start = handlers.onStart;
      buttons.push(
        // Every control here carries its own `aria-label`, so an icon before
        // the word cannot move the name a test or a voice command uses
        // (the-web-ui-screens-wear-metro 4.2).
        <button key="start" type="button" className={forward} data-testid={`pipeline-start-${name}`} aria-label={`Run Change ${name}`} onClick={() => start(name)}><Icon meaning="run" />Run Change...</button>,
      );
    }
    // A review that asked for changes: the plan is updated before anything
    // is applied (ADR 0041).
    if (handlers.onUpdatePlan !== undefined && card.lastRun?.reviewVerdict === "changes-needed") {
      const update = handlers.onUpdatePlan;
      buttons.push(
        <button key="update-plan" type="button" className={forward} data-testid={`pipeline-update-plan-${name}`} aria-label={`Update Plan ${name}`} onClick={() => update(name)}><Icon meaning="run" />Update Plan</button>,
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
        <button key="ask-stop" type="button" className={stopping} data-testid={`pipeline-ask-stop-${name}`} aria-label={`Stop Run ${name}`} onClick={() => handlers.onAskStop({ changeName: name, instanceId })}><Icon meaning="stop" />Stop Run...</button>,
      );
    }
    // Answered where it was started: the card names the folder, and offers
    // to copy it, never to open it.
    if (!run.ownedHere && handlers.copyText !== undefined && run.workingDirectory !== "") {
      const copy = handlers.copyText;
      buttons.push(
        <button key="copy" type="button" className={plain} data-testid={`pipeline-copy-path-${name}`} aria-label={`Copy Path ${name}`} onClick={() => void copy(run.workingDirectory)}><CopyIcon />Copy Path</button>,
      );
    }
    return buttons;
  }

  const send = handlers.onRunControl;
  const runId = held.runId;
  if (held.stopRequested !== null) {
    buttons.push(
      <button key="stop-now" type="button" className={stopping} data-testid={`pipeline-stop-now-${name}`} aria-label={`Stop Process ${name}`} onClick={() => send({ changeName: name, runId, kind: "cancel" })}><Icon meaning="stop" />Stop Process</button>,
    );
    return buttons;
  }
  if (run.waiting?.kind === "checkpoint") {
    const next = run.waiting.nextStage;
    buttons.push(
      <button key="continue" type="button" className={forward} data-testid={`pipeline-continue-${name}`} aria-label={`Continue Run ${name} to ${next}`} title={`Continue to ${next}`} onClick={() => send({ changeName: name, runId, kind: "confirmCheckpoint" })}><ForwardIcon />Continue Run</button>,
    );
  }
  // The oldest permission request still open, and how many are: an agent
  // running tool calls side by side asks for several at once, and a card that
  // knew only the latest offered nothing once it was answered (live,
  // 2026-10-08). A host that does not list them names the one it holds.
  const pendingHere = held.pendingPermissions ?? [];
  const oldest = pendingHere[0]
    ?? (run.waiting?.kind === "permission" && held.permissionRequestId !== null
      ? { requestId: held.permissionRequestId, description: run.waiting.description }
      : undefined);
  if (oldest !== undefined) {
    const { requestId, description } = oldest;
    const more = pendingHere.length > 1 ? ` (1 of ${pendingHere.length})` : "";
    buttons.push(
      <button key="allow" type="button" className={forward} data-testid={`pipeline-allow-${name}`} aria-label={`Allow Permission ${name}: ${description}${more}`} onClick={() => send({ changeName: name, runId, kind: "resolvePermission", permissionRequestId: requestId, permissionOutcome: "allow" })}><CheckIcon />{`Allow Permission${more}`}</button>,
      <button key="deny" type="button" className={stopping} data-testid={`pipeline-deny-${name}`} aria-label={`Deny Permission ${name}: ${description}${more}`} onClick={() => send({ changeName: name, runId, kind: "resolvePermission", permissionRequestId: requestId, permissionOutcome: "deny" })}><CrossIcon />Deny Permission</button>,
    );
  }
  buttons.push(
    <button key="stop" type="button" className={stopping} data-testid={`pipeline-stop-${name}`} aria-label={`Stop Run ${name}`} onClick={() => handlers.onAskStop({ changeName: name, runId })}><Icon meaning="stop" />Stop Run...</button>,
  );
  return buttons;
}

/** What waits for a person, said at the top of the Pipeline whatever the
 * number of changes, so nothing that blocks a run is found by scrolling
 * (ADR 0047). An agent's question is announced here and not opened by
 * itself: it would take the keyboard from whatever the person was typing.
 * Answer opens the same dialog the card's Answer does; a permission is
 * allowed or denied here as on the card. */
function WaitingBanner({ cards, heldRuns, onAnswer, onRunControl }: {
  cards: readonly ChangeCard[];
  heldRuns: Map<string, LiveRun>;
  onAnswer?: (target: AnswerTarget) => void;
  onRunControl?: (control: RunControl) => void;
}) {
  const rows: ReactNode[] = [];
  for (const card of cards) {
    const name = card.changeName;
    const target = answerTargetOf(card);
    if (target !== undefined && onAnswer !== undefined) {
      const count = target.questions.length;
      rows.push(
        <li key={`${name} questions`} data-testid={`pipeline-waiting-${name}`}>
          <span><strong>{name}</strong>{` asks ${count === 1 ? "a question" : `${count} questions`}`}</span>
          <button type="button" className="openspec-pipeline-button openspec-pipeline-button--forward" data-testid={`pipeline-waiting-answer-${name}`} aria-label={`Answer Questions for ${name}`} onClick={() => onAnswer(target)}>Answer Questions...</button>
        </li>,
      );
    }
    const asked = permissionAskedOf(card, heldRuns);
    if (asked !== undefined && onRunControl !== undefined) {
      const more = asked.count > 1 ? ` (1 of ${asked.count})` : "";
      const send = (outcome: "allow" | "deny") => onRunControl({ changeName: name, runId: asked.runId, kind: "resolvePermission", permissionRequestId: asked.requestId, permissionOutcome: outcome });
      rows.push(
        <li key={`${name} permission`} data-testid={`pipeline-waiting-permission-${name}`}>
          <span><strong>{name}</strong>{` asks permission${more}: ${asked.description}`}</span>
          <button type="button" className="openspec-pipeline-button openspec-pipeline-button--forward" aria-label={`Allow Permission for ${name}: ${asked.description}`} onClick={() => send("allow")}>Allow Permission</button>
          <button type="button" className="openspec-pipeline-button openspec-pipeline-button--stop" aria-label={`Deny Permission for ${name}: ${asked.description}`} onClick={() => send("deny")}>Deny Permission</button>
        </li>,
      );
    }
  }
  if (rows.length === 0) return null;
  return (
    <section className="openspec-waiting-banner" role="status" aria-label="Waiting for you" data-testid="pipeline-waiting">
      <h2>Waiting for you</h2>
      <ul>{rows}</ul>
    </section>
  );
}
/** The questions a run waits on, each with its answer (ADR 0042). An answer
 * is sent as it is given; the form closes once every question has one. */
function AnswerQuestionsForm({ target, onAnswer, onClose }: {
  target: AnswerTarget;
  onAnswer: (questionId: string, answer: string) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<ReadonlySet<string>>(new Set());
  return (
    <form
      role="dialog"
      aria-modal="true"
      aria-label={`Answer ${target.changeName}`}
      className="openspec-pipeline-stop-form"
      data-testid="pipeline-answer-form"
      onSubmit={(event) => {
        event.preventDefault();
        const given = target.questions.filter((question) => !sent.has(question.questionId) && (drafts[question.questionId] ?? "").trim().length > 0);
        for (const question of given) onAnswer(question.questionId, (drafts[question.questionId] ?? "").trim());
        const now = new Set([...sent, ...given.map((question) => question.questionId)]);
        setSent(now);
        if (target.questions.every((question) => now.has(question.questionId))) onClose();
      }}
    >
      <h3>{`Answer ${target.changeName}: ${target.questions.length === 1 ? "a question" : `${target.questions.length} questions`}`}</h3>
      {target.questions.map((question) => (
        <label key={question.questionId}>
          {`${question.questionId}: ${question.text}`}
          <input
            type="text"
            value={drafts[question.questionId] ?? ""}
            disabled={sent.has(question.questionId)}
            data-testid={`pipeline-answer-${question.questionId}`}
            onChange={(event) => {
              const value = event.target.value;
              setDrafts((current) => ({ ...current, [question.questionId]: value }));
            }}
          />
        </label>
      ))}
      <div className="openspec-pipeline-stop-form-actions">
        <button type="submit" className="openspec-pipeline-button openspec-pipeline-button--forward" data-testid="pipeline-send-answer">Answer</button>
        <button className="openspec-pipeline-button" type="button" onClick={onClose}>Close</button>
      </div>
    </form>
  );
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
      aria-modal="true"
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
      <div className="openspec-pipeline-stop-form-actions">
        <button type="submit" className="openspec-pipeline-button openspec-pipeline-button--stop" data-testid="pipeline-ask-to-stop">Stop Run</button>
        <button className="openspec-pipeline-button" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

/** A card's facts (the-pipeline-shows-what-it-has-read), each marked by its
 * kind (the-pipeline-cards-wear-metro). As many as a card draws are drawn,
 * each on one line; the rest stay in the DOM and in the card's accessible
 * name, visually hidden — a card must not be able to remove a fact the
 * change is required to state — and the last drawn line counts them. The
 * card's title has every line. */
function CardDetails({ details }: { details: readonly CardDetail[] }) {
  if (details.length === 0) return null;
  const { drawn, beyond } = fitPipelineCardDetails(details.length);
  return (
    <ul className="openspec-pipeline-node-details">
      {details.map((detail, index) => (
        <li
          key={index}
          className={index < drawn ? "openspec-pipeline-node-detail" : "openspec-pipeline-node-detail openspec-pipeline-node-detail--beyond"}
          data-kind={detail.kind}
        >
          <DetailIcon kind={detail.kind} />
          <span className="openspec-pipeline-node-detail-text">{detail.text}</span>
          {beyond > 0 && index === drawn - 1 ? <span className="openspec-pipeline-node-more" aria-hidden="true">{`+${beyond}`}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** What this change has to say for itself, in the order a reader wants
 * it. Sentences rather than fields: the terminal's `ready` says the same
 * things the same way, and two surfaces wording one fact differently is
 * two facts as far as a reader is concerned. */
function describeChange(change: ChangeReadiness): CardDetail[] {
  const details: CardDetail[] = [];

  if (change.run.state === "running") {
    details.push({ kind: "where", text: `in ${change.run.worktreePath}` });
    // "git author", never "user": self-declared, and nothing is gated on
    // it (a-lease-says-who). A run that recorded none claims nothing.
    // Only a lease records an author; a run known only by its status
    // record claims nobody (a-change-is-running-when-its-run-says-so).
    if (change.run.holder?.author) details.push({ kind: "whose", text: `git author ${change.run.holder.author}` });
  }

  if (change.run.state === "blocked") details.push({ kind: "waiting-on", text: `waiting on ${change.run.blockedBy.join(", ")}` });

  if (change.run.state === "ready") {
    if (change.needsWorktree) details.push({ kind: "worktree", text: `no working directory of its own — ${change.needsWorktree}` });
    else if (change.canJoin.length > 0) details.push({ kind: "alongside", text: `can start alongside ${change.canJoin.join(", ")}` });
    else if (change.blockedFrom.length === 0) details.push({ kind: "alongside", text: "nothing else can start alongside it" });
    for (const other of change.blockedFrom) {
      details.push({ kind: "collision", text: `not with ${other.changeName} — ${other.collisions.map(describeCollision).join("; ")}` });
    }
  }

  return details;
}

/** Every working directory other than this one, each in its own
 * recessed section with its own picture. */
function OtherDirectories({ survey, labels, now, onCards, openCards, archivedOnMain, drawsChanges, order, controls }: {
  survey: WorktreeSurvey;
  /** A change's actions, for the card of its own worktree drawn here, as
   * on the board (a-change-is-committed-where-it-is-made). */
  controls?: Pick<CardControlHandlers, "actions" | "chooseAction" | "onStart">;
  order: ChangeOrder;
  labels: Map<string, string>;
  now: Date;
  onCards: ReadonlySet<string>;
  openCards: OpenCards;
  archivedOnMain: ReadonlySet<string>;
  /** Whether this section draws its directories' change cards. On the
   * board they stand in the columns above, and a change is one card
   * wherever it is worked (a-change-is-one-card-wherever-it-is). */
  drawsChanges: boolean;
}) {
  const others = survey.directories.filter((directory) => !directory.isThis);
  if (others.length === 0 && survey.runsElsewhere.length === 0) return null;
  return (
    <section className="openspec-panel openspec-pipeline-others" data-testid="pipeline-others" aria-label="Other working directories">
      <div className="openspec-panel-head">
        <h2 className="openspec-pipeline-others-heading">Other working directories</h2>
        <span className="openspec-panel-head-note">read here, and acted on only in a change's own worktree</span>
      </div>
      <div className="openspec-pipeline-panel-body">
        <p className="openspec-shell-note">
          Nothing below can be opened, run or changed from this checkout, except a change in the worktree made for it,
          whose tasks its card works.
        </p>
        {others.map((directory, index) => (
          <OtherDirectory key={directory.path} directory={directory} index={index} labels={labels} now={now} onCards={onCards} openCards={openCards} archivedOnMain={archivedOnMain} drawsChanges={drawsChanges} order={order} {...(controls !== undefined ? { controls } : {})} />
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
    </section>
  );
}

function OtherDirectory({ directory, index, labels, now, onCards, openCards, archivedOnMain, drawsChanges, order, controls }: {
  directory: SurveyedDirectory;
  controls?: Pick<CardControlHandlers, "actions" | "chooseAction" | "onStart">;
  order: ChangeOrder;
  index: number;
  labels: Map<string, string>;
  now: Date;
  onCards: ReadonlySet<string>;
  openCards: OpenCards;
  archivedOnMain: ReadonlySet<string>;
  /** Whether this directory's change cards are drawn here. On the board
   * they stand in the columns above (a-change-is-one-card-wherever-it-is). */
  drawsChanges: boolean;
}) {
  const testId = `pipeline-directory-${index}`;
  return (
    <section className="openspec-pipeline-directory" data-testid={testId} aria-label={`Working directory ${directory.label}`}>
      <div className="openspec-pipeline-directory-title">
        <h3 className="openspec-pipeline-directory-label">{directory.label}</h3>
        <span className="openspec-pipeline-directory-where" data-testid={`${testId}-where`}>{`${branchPhrase(directory)} · ${directory.path}`}</span>
      </div>
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
      <ul className="openspec-shell-note openspec-pipeline-directory-runs" data-testid={`${testId}-runs`}>
        {describeDirectoryRuns(directory, now, onCards).map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}
      </ul>
      {directory.readable && drawsChanges ? <ForeignChanges directory={directory} testId={testId} labels={labels} openCards={openCards} archivedOnMain={archivedOnMain} order={order} {...(controls !== undefined ? { controls } : {})} /> : null}
    </section>
  );
}

/** A surveyed change as the layout's input. Only its own blockers are
 * relations; nothing is known about collisions in another directory, and
 * nothing is computed. */
/** An archived change, as the layout needs it. It waits for nothing and
 * blocks nothing: it is done (the-board-remembers-what-was-archived). */
function asArchivedLayoutInput(changeName: string): ChangeReadiness {
  return { changeName, blockers: [], run: { state: "ready" }, capabilities: [], canJoin: [], blockedFrom: [] };
}

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

/** The facts a card of another working directory states. */
function foreignDetails(
  change: SurveyedChange | undefined,
  blockers: readonly string[],
  labels: Map<string, string>,
  archivedOnMain: ReadonlySet<string> = new Set(),
): CardDetail[] {
  return [
    ...(change?.tasksUnreadable ? [{ kind: "tasks" as const, text: `tasks could not be read: ${change.tasksUnreadable}` }] : []),
    // The case the owner met: a change worked in another directory,
    // landed and archived, still drawn as if it were alive
    // (main-catches-up-with-what-landed).
    ...(change && archivedOnMain.has(change.changeName) ? [{ kind: "where" as const, text: "archived on main" }] : []),
    ...(blockers.length > 0 ? [{ kind: "waiting-on" as const, text: `waiting on ${blockers.join(", ")}` }] : []),
    ...(change && change.alsoIn.length > 0 ? [{ kind: "where" as const, text: `also in ${change.alsoIn.map((other) => labels.get(other) ?? other).join(", ")}` }] : []),
  ];
}

function ForeignChanges({ directory, testId, labels, openCards, archivedOnMain, order, controls }: {
  directory: Extract<SurveyedDirectory, { readable: true }>;
  controls?: Pick<CardControlHandlers, "actions" | "chooseAction" | "onStart">;
  order: ChangeOrder;
  testId: string;
  labels: Map<string, string>;
  openCards: OpenCards;
  archivedOnMain: ReadonlySet<string>;
}) {
  // The change this directory is the worktree of is already a card above.
  const taskCards = useContext(TaskCardContext);
  const changes = directory.changes.filter((change) => change.changeName !== directory.belongsTo);
  if (changes.length === 0) {
    return (
      <p className="openspec-shell-note" data-testid={`${testId}-empty`}>
        {`No ${directory.belongsTo ? "other " : ""}active changes on ${branchPhrase(directory)}.`}
      </p>
    );
  }
  const byName = new Map(changes.map((change) => [change.changeName, change]));
  const heights = new Map<string, number>();
  // The change this directory is the worktree of offers its actions here as
  // on the board: arranged by step, it was drawn with none, and every
  // change made in its own worktree read as somebody else's
  // (a-change-is-committed-where-it-is-made).
  const actionsOf = new Map<string, ChangeActionState[]>();
  for (const change of changes) {
    const facts = elsewhereActionFacts(change, directory);
    if (facts !== undefined) actionsOf.set(change.changeName, cardActionStates(facts, controls?.actions));
    const openRows = openParts(change.tasks ?? [], openCards.isOpen(directory.path, change.changeName), taskCards.hidesDone(directory.path, change.changeName));
    heights.set(change.changeName, pipelineCardHeight({
      hasState: false,
      hasProgress: !change.tasksUnreadable && change.tasksTotal > 0,
      hasCallout: false,
      detailLines: foreignDetails(change, change.blockers, labels, archivedOnMain).length + notOnServerDetails(change, directory).length,
      hasControls: facts !== undefined && controls?.onStart !== undefined,
      actionRows: cardActionRows(actionsOf.get(change.changeName) ?? []).length,
      ...(openRows !== undefined ? { open: openRows } : {}),
    }));
  }
  const rank = rankChanges(changes.map((change) => change.changeName), order, new Map(changes.map((change) => [change.changeName, orderFactsOf({ surveyed: change })])));
  const layout = layoutChanges({ changes: changes.map(asLayoutInput) }, { heights, rank });
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
            directory={directory}
            labels={labels}
            archivedOnMain={archivedOnMain}
            testId={`${testId}-node-${node.change.changeName}`}
            open={openCards.isOpen(directory.path, node.change.changeName)}
            onToggle={() => openCards.toggle(directory.path, node.change.changeName)}
            actions={actionsOf.get(node.change.changeName) ?? []}
            {...(controls?.chooseAction !== undefined ? { onChooseAction: controls.chooseAction } : {})}
            {...(controls?.onStart !== undefined ? { onStart: controls.onStart } : {})}
          />
        )}
      />
    </>
  );
}

/** What a card of another working directory says on the board: where it is
 * worked, where it stands, and that nothing here acts on it
 * (a-change-is-one-card-wherever-it-is). */
function elsewhereDetails(
  change: SurveyedChange,
  where: Extract<SurveyedDirectory, { readable: true }>,
  labels: Map<string, string>,
  archivedOnMain: ReadonlySet<string>,
  stage: ChangeStageSummary | undefined,
  now: Date,
): CardDetail[] {
  return [
    { kind: "where", text: `worked in ${where.label}` },
    ...(stage !== undefined ? [{ kind: "where" as const, text: describeStageLine(stage, now) }] : []),
    ...foreignDetails(change, change.blockers, labels, archivedOnMain),
    ...notOnServerDetails(change, where),
  ];
}

/** A card read from another working directory. Read here and never acted on
 * from here — a change is the pair (directory, name), and nothing on it may
 * reach the change of that name in this checkout (ADR 0026) — except where
 * that directory is the change's own worktree, which its card works
 * (ADR 0026 amended 2026-10-05, a-card-works-its-own-tasks). Then its name
 * opens the change there, and its rows and list carry their actions. */
function DirectoryCard({ node, change, directory, details, testId, open, onToggle, actions, onChooseAction, onStart }: {
  node: ChangeLayoutNode;
  change: SurveyedChange | undefined;
  directory: Extract<SurveyedDirectory, { readable: true }>;
  details: CardDetail[];
  testId: string;
  open: boolean;
  onToggle: () => void;
  /** Its change's actions, on a card of the change's own worktree, on the
   * board and arranged by step alike; none elsewhere. */
  actions?: readonly ChangeActionState[];
  onChooseAction?: (action: ChangeAction, changeName: string) => void;
  /** Starts the change, on a card of its own worktree: the run runs there
   * (a-change-is-committed-where-it-is-made). */
  onStart?: (changeName: string, directory?: string) => void;
}) {
  const taskCards = useContext(TaskCardContext);
  const name = node.change.changeName;
  // No run in hand is paired with another directory's rows: a row's word
  // there is what its list says.
  const allRows = change?.tasks !== undefined ? describeTaskRows(change.tasks, undefined) : [];
  const rows = shownRows(allRows, taskCards.hidesDone(directory.path, name));
  const own = directory.ownChange === name;
  const counted = change !== undefined && !change.tasksUnreadable && change.tasksTotal > 0;
  const select = taskCards.select;
  const openOwn = own ? taskCards.openOwn : undefined;
  return (
    <div
      className={`openspec-pipeline-node openspec-pipeline-node--foreign${own ? " openspec-pipeline-node--own" : ""}`}
      data-testid={testId}
      data-state="foreign"
      data-own={own ? "true" : "false"}
      data-open={open && rows.length > 0 ? "true" : "false"}
      style={{ "--x": node.x, "--y": node.y, "--w": node.width, "--h": node.height } as Record<string, number>}
      title={`${name} — ${[...(counted ? [`${change.tasksDone} of ${change.tasksTotal} tasks done`] : []), ...details.map((detail) => detail.text)].join(" ")}`}
    >
      <div className="openspec-pipeline-node-head">
        {openOwn !== undefined ? (
          <button type="button" className="openspec-pipeline-node-open" data-testid={`${testId}-open`} onClick={() => openOwn(name)}>
            <span className="openspec-pipeline-node-name">{name}</span>
          </button>
        ) : <span className="openspec-pipeline-node-name">{name}</span>}
        <CardTaskTools changeName={name} directory={directory.path} where={directory.label} own={own} rows={allRows} open={open} testId={testId} />
        {allRows.length > 0
          ? <TasksToggle name={name} open={open} listId={`${testId}-tasks`} testId={`${testId}-tasks-toggle`} onToggle={onToggle} />
          : null}
      </div>
      {onChooseAction !== undefined && actions !== undefined
        ? <CardActions changeName={name} states={actions} onChoose={(action) => onChooseAction(action, name)} testId={testId} />
        : null}
      {own && onStart !== undefined ? (
        // Its own worktree's card starts it as this checkout's card does,
        // and the run runs there (a-change-is-committed-where-it-is-made).
        <div className="openspec-pipeline-node-controls" data-testid={`${testId}-controls`}>
          {runningHere(directory, name)
            ? <span className="openspec-pipeline-node-started">running</span>
            : <button type="button" className="openspec-pipeline-button openspec-pipeline-button--forward" data-testid={`${testId}-start`} aria-label={`Run Change ${name}`} title={`Run ${name} in ${directory.label}`} onClick={() => onStart(name, directory.path)}><Icon meaning="run" />Run Change...</button>}
        </div>
      ) : null}
      {counted ? <Progress done={change.tasksDone} total={change.tasksTotal} /> : null}
      <CardDetails details={details} />
      {rows.length > 0 ? (
        <TaskList
          id={`${testId}-tasks`}
          rows={rows}
          open={open}
          testId={`${testId}-tasks`}
          {...(select !== undefined
            ? { onSelect: (row: TaskRow) => select({ changeName: name, directory: directory.path, where: directory.label, own, row }) }
            : {})}
        />
      ) : null}
    </div>
  );
}

/** A change of another working directory, drawn on this board. */
function ElsewhereNode({ node, change, where, labels, archivedOnMain, stage, now, testId, open, onToggle, actions, onChooseAction, onStart }: {
  onStart?: (changeName: string, directory?: string) => void;
  node: ChangeLayoutNode;
  change: SurveyedChange;
  where: Extract<SurveyedDirectory, { readable: true }>;
  labels: Map<string, string>;
  archivedOnMain: ReadonlySet<string>;
  stage: ChangeStageSummary | undefined;
  now: Date;
  testId: string;
  open: boolean;
  onToggle: () => void;
  actions: readonly ChangeActionState[];
  onChooseAction?: (action: ChangeAction, changeName: string) => void;
}) {
  const details = elsewhereDetails(change, where, labels, archivedOnMain, stage, now);
  return <DirectoryCard node={node} change={change} directory={where} details={details} testId={testId} open={open} onToggle={onToggle} actions={actions} {...(onChooseAction !== undefined ? { onChooseAction } : {})} {...(onStart !== undefined ? { onStart } : {})} />;
}

/** A change of another working directory, drawn in that directory's own
 * picture. */
function ForeignNode({ node, change, directory, labels, testId, open, onToggle, archivedOnMain, actions, onChooseAction, onStart }: {
  onStart?: (changeName: string, directory?: string) => void;
  node: ChangeLayoutNode;
  actions?: readonly ChangeActionState[];
  onChooseAction?: (action: ChangeAction, changeName: string) => void;
  change: SurveyedChange | undefined;
  directory: Extract<SurveyedDirectory, { readable: true }>;
  labels: Map<string, string>;
  testId: string;
  open: boolean;
  onToggle: () => void;
  archivedOnMain: ReadonlySet<string>;
}) {
  const details = [...foreignDetails(change, node.change.blockers, labels, archivedOnMain), ...notOnServerDetails(change, directory)];
  return <DirectoryCard node={node} change={change} directory={directory} details={details} testId={testId} open={open} onToggle={onToggle} actions={actions ?? []} {...(onChooseAction !== undefined ? { onChooseAction } : {})} {...(onStart !== undefined ? { onStart } : {})} />;
}
