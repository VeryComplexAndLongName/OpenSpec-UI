import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChangeReadiness,
  ChangeReadinessReport,
  LiveRun,
  SurveyedDirectory,
  SurveyedRun,
  WorktreeSurvey,
} from "@openspec-ui/core/browser";
import { NODE_HEIGHT, pipelineOpenCardHeight } from "@openspec-ui/core/browser";
import {
  PIPELINE_BACKSTOP_INTERVAL_MS,
  PIPELINE_CLOCK_INTERVAL_MS,
  PIPELINE_POLL_INTERVAL_MS,
  PipelineView,
  SURVEY_POLL_INTERVAL_MS,
  type PipelineReading,
  type PipelineViewMemory,
} from "./PipelineView.js";

afterEach(() => {
  vi.useRealTimers();
});

function change(changeName: string, overrides: Partial<ChangeReadiness> = {}): ChangeReadiness {
  return {
    changeName,
    blockers: [],
    run: { state: "ready" },
    capabilities: [],
    canJoin: [],
    blockedFrom: [],
    ...overrides,
  };
}

function report(...changes: ChangeReadiness[]): ChangeReadinessReport {
  return { changes };
}

function holder(author?: string) {
  return {
    hostKind: "cli" as const,
    hostname: "a-machine",
    pid: 777,
    heartbeatAgeMs: 3_000,
    ...(author !== undefined ? { author } : {}),
  };
}

// what-the-others-are-doing: every other working directory beneath this
// one's picture, and what every directory's runs say.
function run(overrides: Partial<SurveyedRun> = {}): SurveyedRun {
  // The record's timestamps agree with the intervals it was read with,
  // unless a test says otherwise: the view counts from the timestamps.
  const activitySinceMs = overrides.activitySinceMs ?? 12_000;
  const heartbeatAgeMs = overrides.heartbeatAgeMs ?? 2_000;
  return {
    instanceId: "run-1",
    changeName: "their-change",
    stage: "apply",
    activity: "Bash: npm test",
    activitySinceMs,
    heartbeatAgeMs,
    activityAt: new Date(Date.now() - activitySinceMs).toISOString(),
    heartbeatAt: new Date(Date.now() - heartbeatAgeMs).toISOString(),
    gone: false,
    workingDirectory: "/wt/repo/theirs",
    runId: null,
    waiting: null,
    signature: "unverified",
    ...overrides,
  };
}

function directory(overrides: Partial<Extract<SurveyedDirectory, { readable: true }>> = {}): SurveyedDirectory {
  return {
    path: "/repo",
    label: "repo",
    labelDeclared: false,
    isMain: true,
    isThis: true,
    branch: "main",
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...overrides,
  };
}

function survey(...directories: SurveyedDirectory[]): WorktreeSurvey {
  return { directories, runsElsewhere: [] };
}

const theirs = (overrides: Partial<Extract<SurveyedDirectory, { readable: true }>> = {}) => directory({
  path: "/wt/repo/theirs",
  label: "theirs",
  isMain: false,
  isThis: false,
  branch: "their-branch",
  changes: [{ changeName: "their-change", tasksDone: 2, tasksTotal: 5, blockers: [], alsoIn: [] }],
  ...overrides,
});

describe("PipelineView — a card opens to its tasks (a-card-opens-to-its-tasks 4.3)", () => {
  const rows = [
    { number: "1.1", text: "Read the list", section: "Reading", done: true, closedBy: "agent" as const },
    { number: "1.2", text: "Write the rows", section: "Reading", done: false, closedBy: "agent" as const },
    { number: "2.1", text: "**Human-only**: look at it", section: "Looking", done: false, closedBy: "person" as const },
  ];
  const load = async () => report(change("alpha"), change("beta"));
  const surveyed = async () => survey(directory({
    changes: [
      { changeName: "alpha", tasksDone: 1, tasksTotal: 3, blockers: [], alsoIn: [], tasks: rows },
      { changeName: "beta", tasksDone: 0, tasksTotal: 0, blockers: [], alsoIn: [] },
    ],
  }));
  const yOf = (name: string) => Number(screen.getByTestId(`pipeline-node-${name}`).style.getPropertyValue("--y"));

  it("lists an open card's rows under their sections, moves the card below by its extra height, and explains the rail", async () => {
    render(<PipelineView isActive load={load} survey={surveyed} />);

    const toggle = await screen.findByRole("button", { name: "Show tasks of alpha" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("pipeline-node-alpha-tasks")).not.toBeVisible();
    expect(screen.queryByTestId("pipeline-legend")).toBeNull();
    const before = yOf("beta");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide tasks of alpha");
    const list = screen.getByTestId("pipeline-node-alpha-tasks");
    expect(list).toBeVisible();
    expect(within(list).getAllByRole("listitem").map((row) => row.getAttribute("data-word"))).toEqual(["done", "open", "only a person can close it"]);
    expect(list).toHaveTextContent("Reading");
    expect(list).toHaveTextContent("Looking");
    // The marker the word already says is not said twice.
    expect(within(list).getAllByRole("listitem")[2]).toHaveTextContent("only a person can close itlook at it");
    expect(yOf("beta")).toBe(before + pipelineOpenCardHeight(3, 2) - NODE_HEIGHT);
    expect(screen.getByTestId("pipeline-legend")).toHaveTextContent("A thin line inside a card means listed next in tasks.md.");
  });

  it("zooms by one factor on the picture, and moves no layout unit", async () => {
    render(<PipelineView isActive load={load} survey={surveyed} />);
    await screen.findByRole("button", { name: "Show tasks of alpha" });
    const before = yOf("beta");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByTestId("pipeline").style.getPropertyValue("--pipeline-zoom")).toBe("1.25");
    expect(screen.getByTestId("pipeline-zoom-level")).toHaveTextContent("Zoom 125%");
    expect(yOf("beta")).toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByTestId("pipeline-zoom-level")).toHaveTextContent("Zoom 100%");
  });

  it("opens every card with tasks at Open all, and closes them at Close all", async () => {
    render(<PipelineView isActive load={load} survey={surveyed} />);
    await screen.findByRole("button", { name: "Show tasks of alpha" });

    fireEvent.click(screen.getByRole("button", { name: "Open all" }));
    expect(screen.getByRole("button", { name: "Hide tasks of alpha" })).toHaveAttribute("aria-expanded", "true");
    // A card with no tasks has nothing to open.
    expect(screen.queryByRole("button", { name: /tasks of beta/u })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close all" }));
    expect(screen.getByRole("button", { name: "Show tasks of alpha" })).toHaveAttribute("aria-expanded", "false");
  });

  it("opens a card remembered as open after a remount, at the remembered zoom", async () => {
    let memory: PipelineViewMemory | undefined;
    const viewState = { read: () => memory, write: (next: PipelineViewMemory) => { memory = next; } };
    const first = render(<PipelineView isActive load={load} survey={surveyed} viewState={viewState} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show tasks of alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    first.unmount();

    render(<PipelineView isActive load={load} survey={surveyed} viewState={viewState} />);

    expect(await screen.findByRole("button", { name: "Hide tasks of alpha" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("pipeline-zoom-level")).toHaveTextContent("Zoom 90%");
    expect(memory).toEqual({ zoom: 0.9, open: [{ directory: "/repo", changeName: "alpha" }] });
  });

  it("keeps working with a viewState that throws, at the default zoom and with every card closed", async () => {
    const viewState = {
      read: (): PipelineViewMemory | undefined => { throw new Error("storage refused"); },
      write: () => { throw new Error("storage refused"); },
    };
    render(<PipelineView isActive load={load} survey={surveyed} viewState={viewState} />);

    const toggle = await screen.findByRole("button", { name: "Show tasks of alpha" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("pipeline-zoom-level")).toHaveTextContent("Zoom 100%");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("pipeline-zoom-level")).toHaveTextContent("Zoom 125%");
  });
});

describe("PipelineView — other working directories", () => {
  // 5.1
  it("names the branch this picture was read from, even with nothing in the queue", async () => {
    render(<PipelineView isActive load={async () => report()} survey={async () => survey(directory({ branch: "stale-branch" }))} />);

    expect(await screen.findByTestId("pipeline-reading-branch")).toHaveTextContent("Read from branch stale-branch in repo.");
    expect(await screen.findByTestId("pipeline-empty")).toHaveTextContent("No active changes on branch stale-branch.");
  });

  // 6.7
  it("offers no action on another directory's change", async () => {
    render(<PipelineView isActive load={async () => report(change("alpha"))} survey={async () => survey(directory(), theirs())} />);

    const section = await screen.findByTestId("pipeline-directory-0");
    expect(within(section).queryAllByRole("button")).toHaveLength(0);
    const card = within(section).getByTestId("pipeline-directory-0-node-their-change");
    expect(card.tagName).toBe("DIV");
    expect(card).toHaveTextContent("2 of 5 tasks done");
  });

  // 6.7
  it("says in words that a directory is held by a different git author", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(directory(), theirs({ holder: holder("someone@else.invalid"), authorDiffers: true }))}
      />,
    );

    const holderLine = await screen.findByTestId("pipeline-directory-0-holder");
    expect(holderLine).toHaveTextContent("git author someone@else.invalid, a different git author from this checkout's");
  });

  // 6.8
  it("draws a relation inside another directory's picture and none across directories", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta", { blockers: ["alpha"], run: { state: "blocked", blockedBy: ["alpha"] } }))}
        survey={async () => survey(directory(), theirs({
          changes: [
            { changeName: "first", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: [] },
            { changeName: "second", tasksDone: 0, tasksTotal: 1, blockers: ["first"], alsoIn: [] },
          ],
        }))}
      />,
    );

    expect(await screen.findByTestId("pipeline-directory-0-edge-first-to-second")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-edge-alpha-to-beta")).toBeInTheDocument();
    // Every edge on the page names two changes of one directory.
    const edges = [...document.querySelectorAll("path[data-testid]")].map((path) => path.getAttribute("data-testid"));
    expect(edges.sort()).toEqual(["pipeline-directory-0-edge-first-to-second", "pipeline-edge-alpha-to-beta"]);
  });

  // 6.13, 5.8
  it("shows what another directory's run says and how long ago, and a gone run as gone", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(
          directory(),
          theirs({ runs: [run()] }),
          theirs({ path: "/wt/repo/lapsed", label: "lapsed", runs: [run({ instanceId: "run-2", gone: true, heartbeatAgeMs: 90_000, workingDirectory: "/wt/repo/lapsed" })] }),
        )}
      />,
    );

    expect(await screen.findByTestId("pipeline-directory-0-runs")).toHaveTextContent("their-change (apply): Bash: npm test — said 12s ago");
    expect(screen.getByTestId("pipeline-directory-1-runs")).toHaveTextContent("gone — last heard from 90s ago");
    // This directory's own runs, where none report, are not called idle.
    expect(screen.getByTestId("pipeline-reading-runs")).toHaveTextContent("no run reports here");
  });

  // a-run-says-which-task-it-is-on 5.7
  it("names the task a directory's run is on, and says a waiting run is waiting", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(
          directory(),
          theirs({ runs: [run({ task: { number: "1.2", text: "Pair it with the list", source: "agent" } })] }),
          theirs({
            path: "/wt/repo/paused",
            label: "paused",
            runs: [run({ instanceId: "run-2", workingDirectory: "/wt/repo/paused", waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } })],
          }),
        )}
      />,
    );

    expect(await screen.findByTestId("pipeline-directory-0-runs"))
      .toHaveTextContent("on task 1.2: Pair it with the list, by its own account");
    expect(screen.getByTestId("pipeline-directory-1-runs")).toHaveTextContent("their-change: waiting to continue to verify");
  });

  // 5.6
  it("calls out a change that another directory holds too, on this directory's own card", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("shared"))}
        survey={async () => survey(
          directory({ changes: [{ changeName: "shared", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: ["/wt/repo/theirs"] }] }),
          theirs({ changes: [{ changeName: "shared", tasksDone: 1, tasksTotal: 1, blockers: [], alsoIn: ["/repo"] }] }),
        )}
      />,
    );

    expect(await screen.findByTestId("pipeline-node-shared")).toHaveTextContent("also in theirs");
    expect(await screen.findByTestId("pipeline-directory-0-node-shared")).toHaveTextContent("also in repo");
  });

  // a-change-is-running-when-its-run-says-so 4.6
  it("draws a change once: its own worktree says whose it is, and still draws its other changes", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(
          directory({ changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: ["/wt/repo/alpha"] }] }),
          theirs({
            path: "/wt/repo/alpha",
            label: "alpha",
            branch: "alpha",
            belongsTo: "alpha",
            changes: [
              { changeName: "alpha", tasksDone: 1, tasksTotal: 1, blockers: [], alsoIn: ["/repo"] },
              { changeName: "passenger", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] },
            ],
          }),
        )}
      />,
    );

    const section = await screen.findByTestId("pipeline-directory-0");
    expect(within(section).getByTestId("pipeline-directory-0-belongs-to")).toHaveTextContent("The worktree of alpha, which is drawn above.");
    expect(within(section).queryByTestId("pipeline-directory-0-node-alpha")).toBeNull();
    expect(within(section).getByTestId("pipeline-directory-0-node-passenger")).toBeInTheDocument();
    expect(screen.getAllByTestId(/-node-alpha$/u)).toHaveLength(1);
  });

  it("says a worktree holds no other change where its own is all it holds", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(
          directory(),
          theirs({
            path: "/wt/repo/alpha",
            branch: "alpha",
            belongsTo: "alpha",
            changes: [{ changeName: "alpha", tasksDone: 1, tasksTotal: 1, blockers: [], alsoIn: [] }],
          }),
        )}
      />,
    );

    expect(await screen.findByTestId("pipeline-directory-0-empty")).toHaveTextContent("No other active changes on branch alpha.");
  });

  it("keeps this directory's picture when the other directories cannot be read", async () => {
    render(<PipelineView isActive load={async () => report(change("alpha"))} survey={async () => { throw new Error("git is gone"); }} />);

    expect(await screen.findByTestId("pipeline-survey-error")).toHaveTextContent("git is gone");
    expect(screen.getByTestId("pipeline-node-alpha")).toBeInTheDocument();
  });

  // 5.7
  it("reads the other directories less often than this one, and not while the tab is hidden", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => report(change("alpha")));
    const read = vi.fn(async () => survey(directory()));
    const { rerender } = render(<PipelineView isActive={false} load={load} survey={read} />);
    expect(read).not.toHaveBeenCalled();

    rerender(<PipelineView isActive load={load} survey={read} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(read).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(PIPELINE_POLL_INTERVAL_MS);
    expect(load.mock.calls.length).toBeGreaterThan(1);
    expect(read).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SURVEY_POLL_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(2);
  });
});

describe("PipelineView — told when to read (the-pipeline-opens-in-vs-code)", () => {
  /** A host that can say a reading is out of date, as the editor's panel
   * does when a file it watches changes. */
  function host() {
    const listeners = new Set<(reading: PipelineReading) => void>();
    return {
      subscribe: (listener: (reading: PipelineReading) => void) => {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
      },
      say: (reading: PipelineReading) => act(() => { for (const listener of listeners) listener(reading); }),
      listening: () => listeners.size,
    };
  }

  // 3.3
  it("reads the survey alone when the host says the survey is out of date", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => report(change("alpha")));
    const read = vi.fn(async () => survey(directory()));
    const signals = host();
    render(<PipelineView isActive load={load} survey={read} subscribe={signals.subscribe} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(load).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);

    signals.say("survey");
    await vi.advanceTimersByTimeAsync(0);

    expect(read).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("reads nothing between signals until the backstop, however long the polling intervals are past", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => report(change("alpha")));
    const read = vi.fn(async () => survey(directory()));
    render(<PipelineView isActive load={load} survey={read} subscribe={host().subscribe} />);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(PIPELINE_BACKSTOP_INTERVAL_MS - 1);
    expect(load).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(load).toHaveBeenCalledTimes(2);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stops listening when it is no longer looked at", async () => {
    vi.useFakeTimers();
    const signals = host();
    const load = vi.fn(async () => report(change("alpha")));
    const { rerender } = render(<PipelineView isActive load={load} subscribe={signals.subscribe} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(signals.listening()).toBe(1);

    rerender(<PipelineView isActive={false} load={load} subscribe={signals.subscribe} />);

    expect(signals.listening()).toBe(0);
  });

  it("keeps counting a stated age between readings, reading nothing to do it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:12.000Z"));
    const read = vi.fn(async () => survey(
      directory(),
      theirs({ runs: [run({ activityAt: "2026-09-13T12:00:00.000Z", activitySinceMs: 12_000 })] }),
    ));
    render(<PipelineView isActive load={async () => report(change("alpha"))} survey={read} subscribe={host().subscribe} />);
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByTestId("pipeline-directory-0-runs")).toHaveTextContent("said 12s ago");

    await vi.advanceTimersByTimeAsync(PIPELINE_CLOCK_INTERVAL_MS * 2);

    expect(screen.getByTestId("pipeline-directory-0-runs")).toHaveTextContent("said 22s ago");
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("PipelineView — a card says what its change is doing", () => {
  const alphaHere = (overrides: Partial<SurveyedDirectory> = {}) => directory({
    changes: [{ changeName: "alpha", tasksDone: 1, tasksTotal: 3, blockers: [], alsoIn: [], tasksForPerson: 1, tasksDelegated: 0 }],
    ...overrides,
  } as Partial<Extract<SurveyedDirectory, { readable: true }>>);

  // 6.3
  it("shows the state word and the lines core gives the card", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(alphaHere())}
        lastRuns={async () => ({
          byChange: { alpha: { runId: "c1", outcome: "failed", stage: "verify", endedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), costUsd: 0.84 } },
        })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("Failed at verify"));
    const node = screen.getByTestId("pipeline-node-alpha");
    expect(node).toHaveAttribute("data-state", "failed");
    expect(node).toHaveTextContent("1 of 3 tasks done; 1 only a person can close");
    expect(node).toHaveTextContent("last run failed at verify 2 hours ago, $0.84");
  });

  // 6.3
  it("keeps every line on a card with more lines than it draws", async () => {
    const collisions = [{ kind: "overlapping-files" as const, files: ["a.ts"] }];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha", {
          worktreePath: "/w/alpha",
          blockedFrom: ["beta", "gamma"].map((changeName) => ({ changeName, collisions })),
        }))}
        survey={async () => survey(alphaHere())}
        lastRuns={async () => ({
          byChange: { alpha: { runId: "c1", outcome: "completed", stage: "apply", endedAt: new Date(Date.now() - 5 * 60_000).toISOString() } },
        })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("last run completed at apply"));
    const node = screen.getByTestId("pipeline-node-alpha");
    const lines = ["1 of 3 tasks done; 1 only a person can close", "last run completed at apply 5 minutes ago", "not with beta", "not with gamma"];
    expect(node.querySelectorAll(".openspec-pipeline-node-detail--beyond").length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(node).toHaveTextContent(line);
      expect(node).toHaveAttribute("title", expect.stringContaining(line));
    }
  });

  // 5.5: the word the Changes list gives, from the same standings.
  it("says the word the standings give, as the Changes list does", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(alphaHere())}
        standings={async () => ({
          readAt: new Date().toISOString(),
          standings: [{
            changeName: "alpha",
            here: { label: "repo", path: "/repo", counts: { done: 1, total: 3 }, runs: [] },
            elsewhere: [],
            main: { kind: "archived", archiveName: "2026-09-14-alpha" },
          }],
          sources: { fetch: { attempted: false }, pullRequests: { read: true } },
        })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("Archived on main"));
  });

  // 6.3, 5.8
  it("does not repeat a run a card shows in the run lines above the picture", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(alphaHere({ runs: [run({ changeName: "alpha", workingDirectory: "/repo", activity: "Bash: npm run verify" })] }))}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("Bash: npm run verify — said"));
    expect(screen.getByTestId("pipeline-node-alpha")).toHaveAttribute("data-state", "running");
    const above = screen.getByTestId("pipeline-reading-runs");
    expect(above).toHaveTextContent("every run here is on its change's card");
    expect(above.textContent).not.toContain("npm run verify");
  });
});

describe("PipelineView — a card's controls (a-change-is-run-from-its-card 5.9)", () => {
  const heldRun = (overrides: Partial<LiveRun> = {}): LiveRun => ({
    runId: "r1",
    cwd: "/repo",
    changeName: "alpha",
    kind: "chain",
    startedAt: new Date().toISOString(),
    waiting: false,
    permissionRequestId: null,
    stopRequested: null,
    ...overrides,
  });

  function renderCard(options: { record?: Partial<SurveyedRun> | null; held?: LiveRun[]; liveRuns?: () => Promise<{ runs: LiveRun[] }> } = {}) {
    const onRunControl = vi.fn();
    const onStart = vi.fn();
    const copyText = vi.fn(async () => undefined);
    const runs = options.record === null
      ? []
      : [run({ changeName: "alpha", runId: "r1", workingDirectory: "/wt/repo/alpha", ...(options.record ?? {}) })];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(directory({
          changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] }],
          runs,
        }))}
        liveRuns={options.liveRuns ?? (async () => ({ runs: options.held ?? [] }))}
        onRunControl={onRunControl}
        onStart={onStart}
        copyText={copyText}
      />,
    );
    return { onRunControl, onStart, copyText };
  }

  it("offers Continue and Stop at a checkpoint on a run this host holds, and sends each", async () => {
    const { onRunControl } = renderCard({
      record: { waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } },
      held: [heldRun({ waiting: true })],
    });

    const continueButton = await screen.findByRole("button", { name: "Continue alpha to verify" });
    fireEvent.click(continueButton);
    expect(onRunControl).toHaveBeenCalledWith({ changeName: "alpha", runId: "r1", kind: "confirmCheckpoint" });

    fireEvent.click(screen.getByRole("button", { name: "Stop alpha" }));
    const form = screen.getByRole("dialog", { name: "Ask alpha to stop" });
    fireEvent.click(within(form).getByTestId("pipeline-ask-to-stop"));
    expect(within(form).getByRole("alert")).toHaveTextContent("A stop needs a reason.");
    expect(onRunControl).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "stop" }));

    fireEvent.change(within(form).getByTestId("pipeline-stop-reason"), { target: { value: "wrong branch" } });
    fireEvent.click(within(form).getByTestId("pipeline-ask-to-stop"));
    expect(onRunControl).toHaveBeenCalledWith({ changeName: "alpha", runId: "r1", kind: "stop", reason: "wrong branch" });
    expect(screen.queryByRole("dialog", { name: "Ask alpha to stop" })).toBeNull();
  });

  it("offers Allow and Deny on the permission a held run waits on, naming its request", async () => {
    const { onRunControl } = renderCard({
      record: { waiting: { kind: "permission", description: "Write to x" } },
      held: [heldRun({ waiting: true, permissionRequestId: "p1" })],
    });

    fireEvent.click(await screen.findByRole("button", { name: "Allow alpha: Write to x" }));
    fireEvent.click(screen.getByRole("button", { name: "Deny alpha: Write to x" }));

    expect(onRunControl).toHaveBeenCalledWith({ changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1", permissionOutcome: "allow" });
    expect(onRunControl).toHaveBeenCalledWith({ changeName: "alpha", runId: "r1", kind: "resolvePermission", permissionRequestId: "p1", permissionOutcome: "deny" });
  });

  it("offers Stop on a running held run, and Stop now once a stop has been asked", async () => {
    const { onRunControl } = renderCard({ held: [heldRun({ stopRequested: { reason: "wrong branch" } })] });

    fireEvent.click(await screen.findByRole("button", { name: "Stop alpha now" }));
    expect(onRunControl).toHaveBeenCalledWith({ changeName: "alpha", runId: "r1", kind: "cancel" });
    expect(screen.queryByTestId("pipeline-stop-alpha")).toBeNull();
  });

  it("reads its runs again shortly after a control, so the card shows what the press did", async () => {
    const liveRuns = vi.fn(async () => ({ runs: [heldRun({ stopRequested: { reason: "wrong branch" } })] }));
    const { onRunControl } = renderCard({ liveRuns });

    fireEvent.click(await screen.findByRole("button", { name: "Stop alpha now" }));
    expect(onRunControl).toHaveBeenCalledTimes(1);
    const readsBefore = liveRuns.mock.calls.length;
    await waitFor(() => expect(liveRuns.mock.calls.length).toBeGreaterThan(readsBefore), { timeout: 3000 });
  });

  it("offers Stop, not Stop now, while no stop has been asked", async () => {
    renderCard({ held: [heldRun()] });

    expect(await screen.findByRole("button", { name: "Stop alpha" })).toBeInTheDocument();
    expect(screen.queryByTestId("pipeline-stop-now-alpha")).toBeNull();
  });

  it("offers no answer or stop for a run held elsewhere, and copies its folder", async () => {
    const { copyText, onRunControl } = renderCard({
      record: { waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } },
      held: [],
    });

    const copy = await screen.findByRole("button", { name: "Copy folder path of alpha" });
    expect(screen.queryByTestId("pipeline-continue-alpha")).toBeNull();
    expect(screen.queryByTestId("pipeline-stop-alpha")).toBeNull();
    fireEvent.click(copy);
    expect(copyText).toHaveBeenCalledWith("/wt/repo/alpha");
    expect(onRunControl).not.toHaveBeenCalled();
    expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("answered where it was started");
  });

  it("offers Start on a change that is ready, for its host to open the run dialog", async () => {
    const { onStart } = renderCard({ record: null });

    fireEvent.click(await screen.findByRole("button", { name: "Start alpha" }));
    expect(onStart).toHaveBeenCalledWith("alpha");
  });
});

describe("PipelineView", () => {
  it("names the git author of a run that recorded one", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("live", {
          run: { state: "running", worktreePath: "/repo.worktrees/live", holder: holder("ada@example.com") },
        }))}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-live");
    expect(node).toHaveTextContent("Running");
    expect(node).toHaveTextContent("/repo.worktrees/live");
    // "git author", never "user": the value is self-declared and nothing
    // is gated on it (a-lease-says-who).
    expect(node).toHaveTextContent("git author ada@example.com");
    expect(node.textContent).not.toContain("user ada@example.com");
  });

  it("claims nothing about who is running a change whose lease recorded no author", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("live", {
          run: { state: "running", worktreePath: "/repo.worktrees/live", holder: holder() },
        }))}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-live");
    expect(node).toHaveTextContent("Running");
    expect(node.textContent).not.toContain("git author");
  });

  // a-change-is-running-when-its-run-says-so 4.6
  it("claims no author for a change running on its run's record alone", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("live", {
          run: { state: "running", worktreePath: "/repo", reportedBy: { instanceId: "run-1", workingDirectory: "/repo" } },
        }))}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-live");
    expect(node).toHaveTextContent("Running");
    expect(node).toHaveTextContent("in /repo");
    expect(node.textContent).not.toContain("git author");
  });

  it("says what a ready change cannot join and why, and draws no line to it", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(
          change("alpha", {
            worktreePath: "/w/alpha",
            blockedFrom: [{ changeName: "beta", collisions: [{ kind: "shared-capability", capability: "ci-cli" }] }],
          }),
          change("beta", {
            worktreePath: "/w/beta",
            blockedFrom: [{ changeName: "alpha", collisions: [{ kind: "shared-capability", capability: "ci-cli" }] }],
          }),
        )}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-alpha");
    expect(node).toHaveTextContent("not with beta");
    expect(node).toHaveTextContent("ci-cli");
    // A collision is not an order, and a line would assert one (ADR 0025).
    expect(screen.queryByTestId("pipeline-edge-alpha-to-beta")).toBeNull();
    expect(screen.queryByTestId("pipeline-edge-beta-to-alpha")).toBeNull();
    expect(screen.queryByTestId("pipeline-edges")).toBeNull();
  });

  it("draws a line for a declared blocker", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(
          change("first"),
          change("second", { blockers: ["first"], run: { state: "blocked", blockedBy: ["first"] } }),
        )}
      />,
    );

    expect(await screen.findByTestId("pipeline-edge-first-to-second")).toBeInTheDocument();
    expect(screen.getByTestId("pipeline-node-second")).toHaveTextContent("waiting on first");
    // What a line draws is on the card in words, so it is not read twice.
    expect(screen.getByTestId("pipeline-edges")).toHaveAttribute("aria-hidden", "true");
  });

  it("says a cycle rather than placing it", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(
          change("egg", { blockers: ["chicken"] }),
          change("chicken", { blockers: ["egg"] }),
        )}
      />,
    );

    const cycles = await screen.findByTestId("pipeline-cycles");
    expect(cycles).toHaveTextContent("chicken");
    expect(cycles).toHaveTextContent("egg");
    expect(screen.queryByTestId("pipeline-node-egg")).toBeNull();
  });

  it("does not read while the tab is not the one being looked at", async () => {
    const load = vi.fn(async () => report(change("alpha")));

    const { rerender } = render(<PipelineView isActive={false} load={load} />);
    // Nothing to do behind a hidden tab: reading walks the changes
    // directory and lists git worktrees.
    expect(load).not.toHaveBeenCalled();

    rerender(<PipelineView isActive load={load} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it("re-reads while it is being looked at, and stops when it is not", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => report(change("alpha")));

    const { rerender } = render(<PipelineView isActive load={load} />);
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(PIPELINE_POLL_INTERVAL_MS);
    expect(load).toHaveBeenCalledTimes(2);

    rerender(<PipelineView isActive={false} load={load} />);
    await vi.advanceTimersByTimeAsync(PIPELINE_POLL_INTERVAL_MS * 3);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("says when it last read, so the picture is not taken for live", async () => {
    render(<PipelineView isActive load={async () => report(change("alpha"))} />);

    expect(await screen.findByTestId("pipeline-read-at")).toHaveTextContent("Last read");
  });

  it("says so when it could not read at all", async () => {
    render(<PipelineView isActive load={async () => { throw new Error("not a git repository"); }} />);

    expect(await screen.findByTestId("pipeline-error")).toHaveTextContent("not a git repository");
  });

  it("keeps the whole of a long detail on the element the card clips", async () => {
    const files = ["a.ts", "b.ts", "c.ts"];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha", {
          worktreePath: "/w/alpha",
          blockedFrom: [{ changeName: "beta", collisions: [{ kind: "overlapping-files", files }] }],
        }))}
      />,
    );

    // Clipped by a fixed card, present in full in the DOM: a card must
    // not be able to remove a fact the change is required to state.
    const node = await screen.findByTestId("pipeline-node-alpha");
    expect(node).toHaveTextContent("3 of the same files");
    expect(node).toHaveAttribute("title", expect.stringContaining("not with beta"));
  });

  // the-pipeline-shows-what-it-has-read 2.4, 3.3
  it("draws only the lines a card holds, keeps the rest on the card, and counts them on the last drawn line", async () => {
    const collisions = [{ kind: "overlapping-files" as const, files: ["a.ts"] }];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha", {
          worktreePath: "/w/alpha",
          blockedFrom: ["beta", "gamma", "delta", "epsilon"].map((changeName) => ({ changeName, collisions })),
        }))}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-alpha");
    const details = Array.from(node.querySelectorAll(".openspec-pipeline-node-detail"));
    const drawn = details.filter((detail) => !detail.classList.contains("openspec-pipeline-node-detail--beyond"));
    const beyond = details.filter((detail) => detail.classList.contains("openspec-pipeline-node-detail--beyond"));

    expect(drawn).toHaveLength(2);
    expect(beyond).toHaveLength(2);
    expect(drawn[1]?.querySelector(".openspec-pipeline-node-more")).toHaveTextContent("+2");
    // Every line is still on the card, and in its title.
    for (const other of ["beta", "gamma", "delta", "epsilon"]) {
      expect(node).toHaveTextContent(`not with ${other}`);
      expect(node).toHaveAttribute("title", expect.stringContaining(`not with ${other}`));
    }
  });

  it("counts nothing on a card whose lines all fit", async () => {
    render(<PipelineView isActive load={async () => report(change("alpha", { worktreePath: "/w/alpha" }))} />);

    const node = await screen.findByTestId("pipeline-node-alpha");
    expect(node.querySelector(".openspec-pipeline-node-more")).toBeNull();
    expect(node.querySelector(".openspec-pipeline-node-detail--beyond")).toBeNull();
  });

  // the-pipeline-shows-what-it-has-read 1.1, 1.2, 3.2
  it("shows the other working directories while this one is still being read", async () => {
    render(
      <PipelineView
        isActive
        load={() => new Promise(() => undefined)}
        survey={async () => survey(directory(), theirs())}
      />,
    );

    expect(await screen.findByTestId("pipeline-others")).toHaveTextContent("theirs");
    expect(screen.getByTestId("pipeline-loading")).toHaveTextContent("Reading what is running");
    expect(screen.getByTestId("pipeline-read-at")).toHaveTextContent("Last read not yet");
  });

  it("shows the other working directories when this one could not be read", async () => {
    render(
      <PipelineView
        isActive
        load={async () => { throw new Error("not a git repository"); }}
        survey={async () => survey(directory(), theirs())}
      />,
    );

    expect(await screen.findByTestId("pipeline-error")).toHaveTextContent("not a git repository");
    expect(await screen.findByTestId("pipeline-others")).toHaveTextContent("theirs");
    expect(screen.queryByTestId("pipeline-loading")).toBeNull();
  });

  it("shows the suggestions the payload carried, and nothing where it carried none", async () => {
    const withHints = {
      ...report(change("alpha", { worktreePath: "/w/alpha" })),
      hints: [{
        id: "needs-a-worktree:beta",
        kind: "needs-a-worktree" as const,
        subject: "beta is ready and has nowhere to run",
        because: "One workspace permits one mutating run.",
        commands: ["openspec-ui-cli worktree add beta"],
      }],
    };
    const { unmount } = render(<PipelineView isActive load={async () => withHints} />);
    expect(await screen.findByTestId("hint-list")).toBeTruthy();
    expect(screen.getByText("openspec-ui-cli worktree add beta")).toBeTruthy();
    unmount();

    // No `hints` key at all is what a workspace with suggestions turned
    // off sends, and it has to read as "no news" rather than as an empty
    // panel.
    render(<PipelineView isActive load={async () => report(change("alpha", { worktreePath: "/w/alpha" }))} />);
    await screen.findByTestId("pipeline");
    expect(screen.queryByTestId("hint-list")).toBeNull();
  });
});
