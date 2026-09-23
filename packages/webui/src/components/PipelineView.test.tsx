import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChangeReadiness,
  ChangeReadinessReport,
  ChangeStageSummary,
  ChangeStandings,
  LiveRun,
  MainDrift,
  SurveyedDirectory,
  SurveyedRun,
  WorktreeSurvey,
} from "@openspec-ui/core/browser";
import { PIPELINE_CARD_REM, STOP_REQUEST_READ_WITHIN_MS } from "@openspec-ui/core/browser";
import {
  PIPELINE_BACKSTOP_INTERVAL_MS,
  PIPELINE_CLOCK_INTERVAL_MS,
  PIPELINE_POLL_INTERVAL_MS,
  PipelineView,
  RUN_CONTROL_REREAD_MS,
  SURVEY_POLL_INTERVAL_MS,
  type PipelineReading,
  type PipelineViewMemory,
} from "./PipelineView.js";

afterEach(() => {
  vi.useRealTimers();
});

// the-web-ui-screens-wear-metro 4.3: a card's controls gained an icon before
// the word. Each carries its own aria-label, so the name a test, a screen
// reader or a voice command uses is exactly what it was.

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

  it("lists an open card's rows under their sections, each tagged, and moves the card below by exactly the rows' height", async () => {
    render(<PipelineView isActive load={load} survey={surveyed} />);

    const toggle = await screen.findByRole("button", { name: "Show tasks of alpha" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("pipeline-node-alpha-tasks")).not.toBeVisible();
    const before = yOf("beta");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Hide tasks of alpha");
    const list = screen.getByTestId("pipeline-node-alpha-tasks");
    expect(list).toBeVisible();
    const listed = within(list).getAllByRole("listitem");
    expect(listed.map((row) => row.getAttribute("data-word"))).toEqual(["done", "open", "only a person can close it"]);
    expect(list).toHaveTextContent("Reading");
    expect(list).toHaveTextContent("Looking");
    // the-pipeline-cards-wear-metro 2.3: a short tag is drawn, and the whole
    // word stays on the row; the marker the word already says is not said
    // twice.
    expect(listed.map((row) => row.querySelector("[aria-hidden='true']")?.textContent)).toEqual(["Done", "Open", "A person"]);
    expect(listed[2]).toHaveTextContent("look at it");
    expect(listed[2]).toHaveTextContent("only a person can close it");
    expect(listed[2]?.textContent).not.toContain("Human-only");
    // No thin line between rows, and so nothing for a legend to explain.
    expect(list.querySelector(".openspec-pipeline-task-rail")).toBeNull();
    expect(screen.queryByTestId("pipeline-legend")).toBeNull();
    const r = PIPELINE_CARD_REM;
    expect(yOf("beta")).toBe(before + r.tasksGap + 2 * r.tasksBorder + 3 * r.taskRow + 2 * r.sectionRow);
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
    // The arrangement is kept with them, and stays the declared order
    // until somebody chooses the board (the-board-shows-the-stages).
    expect(memory).toEqual({ zoom: 0.9, open: [{ directory: "/repo", changeName: "alpha" }], arrangement: "steps" });
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

// a-run-elsewhere-can-be-asked-to-stop 3.6: Stop on a run held elsewhere is
// offered only for the person's own verified run, and says it is waiting.
describe("PipelineView — asking a run elsewhere to stop", () => {
  function renderElsewhere(options: { signature: "verified" | "unverified"; label?: string; myLabel?: string }) {
    const onAskToStop = vi.fn();
    const person = options.label !== undefined ? { keyId: "key-1", label: options.label } : undefined;
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(directory({
          changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] }],
          runs: [run({ changeName: "alpha", instanceId: "run-b", runId: "chain-b", workingDirectory: "/wt/repo/b", signature: options.signature, ...(person !== undefined ? { person } : {}) })],
        }))}
        liveRuns={async () => ({ runs: [], ...(options.myLabel !== undefined ? { myLabel: options.myLabel } : {}) })}
        onAskToStop={onAskToStop}
        copyText={async () => undefined}
      />,
    );
    return { onAskToStop };
  }

  it("offers Stop on my own verified run elsewhere, asks with the instance id and reason, and then says it is waiting", async () => {
    const { onAskToStop } = renderElsewhere({ signature: "verified", label: "Ada", myLabel: "Ada" });

    fireEvent.click(await screen.findByRole("button", { name: "Stop alpha" }));
    const form = screen.getByRole("dialog", { name: "Ask alpha to stop" });
    fireEvent.change(within(form).getByTestId("pipeline-stop-reason"), { target: { value: "live check" } });
    fireEvent.click(within(form).getByTestId("pipeline-ask-to-stop"));

    expect(onAskToStop).toHaveBeenCalledWith({ changeName: "alpha", instanceId: "run-b", reason: "live check" });
    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("waiting for the run to read it"));
    // Not offered again while the request waits to be read.
    expect(screen.queryByTestId("pipeline-ask-stop-alpha")).toBeNull();
  });

  it("reads the runs again until the window to read the request is past, so the card never judges from a stale reading", async () => {
    const read = vi.fn(async () => survey(directory({
      changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] }],
      runs: [run({ changeName: "alpha", instanceId: "run-b", runId: "chain-b", workingDirectory: "/wt/repo/b", signature: "verified", person: { keyId: "key-1", label: "Ada" } })],
    })));
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={read}
        liveRuns={async () => ({ runs: [], myLabel: "Ada" })}
        onAskToStop={vi.fn()}
      />,
    );
    // Loaded on real timers; the time after the press is the test's own.
    fireEvent.click(await screen.findByRole("button", { name: "Stop alpha" }));
    vi.useFakeTimers();
    const form = screen.getByRole("dialog", { name: "Ask alpha to stop" });
    fireEvent.change(within(form).getByTestId("pipeline-stop-reason"), { target: { value: "live check" } });
    fireEvent.click(within(form).getByTestId("pipeline-ask-to-stop"));
    const before = read.mock.calls.length;

    // Soon after asking, then at each clock tick until a reading falls
    // after the window, and no more until the survey's own interval.
    await vi.advanceTimersByTimeAsync(RUN_CONTROL_REREAD_MS);
    expect(read).toHaveBeenCalledTimes(before + 1);
    let elapsed = RUN_CONTROL_REREAD_MS;
    while (elapsed <= STOP_REQUEST_READ_WITHIN_MS) {
      await vi.advanceTimersByTimeAsync(PIPELINE_CLOCK_INTERVAL_MS);
      elapsed += PIPELINE_CLOCK_INTERVAL_MS;
    }
    const afterWindow = read.mock.calls.length;
    expect(afterWindow).toBeGreaterThan(before + 1);
    await vi.advanceTimersByTimeAsync(PIPELINE_CLOCK_INTERVAL_MS);
    expect(elapsed + PIPELINE_CLOCK_INTERVAL_MS).toBeLessThan(SURVEY_POLL_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(afterWindow);
  });

  it("offers no Stop on somebody else's run, and says whose it is", async () => {
    renderElsewhere({ signature: "verified", label: "Bob", myLabel: "Ada" });
    expect(await screen.findByText(/Bob's run, verified/u)).toBeInTheDocument();
    expect(screen.queryByTestId("pipeline-ask-stop-alpha")).toBeNull();
  });

  it("offers no Stop on an unverified run, even to a host with a label", async () => {
    renderElsewhere({ signature: "unverified", myLabel: "Ada" });
    expect(await screen.findByText(/not verified/u)).toBeInTheDocument();
    expect(screen.queryByTestId("pipeline-ask-stop-alpha")).toBeNull();
  });

  // the-pipeline-answers-while-a-run-works 3.4: the embedded page (VS
  // Code's local server, or a plain standalone tab — PipelineView draws
  // the same picture either way) posts Stop straight to the server's own
  // /api/runs/ask-to-stop; the embedding panel is never asked to forward
  // one of its own.
  it("posts Stop to /api/runs/ask-to-stop, and to nothing else", async () => {
    const { askRunToStop } = await import("../live-runs-client.js");
    const request = vi.fn(async (_pathname: string, _init: RequestInit) => new Response(JSON.stringify({ messageId: "message-1" }), { status: 200 }));
    const onAskToStop = vi.fn((ask: { instanceId: string; reason: string }) => {
      void askRunToStop(request, "/repo", ask.instanceId, ask.reason);
    });
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(directory({
          changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] }],
          runs: [run({ changeName: "alpha", instanceId: "run-b", runId: "chain-b", workingDirectory: "/wt/repo/b", signature: "verified", person: { keyId: "key-1", label: "Ada" } })],
        }))}
        liveRuns={async () => ({ runs: [], myLabel: "Ada" })}
        onAskToStop={onAskToStop}
        copyText={async () => undefined}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Stop alpha" }));
    const form = screen.getByRole("dialog", { name: "Ask alpha to stop" });
    fireEvent.change(within(form).getByTestId("pipeline-stop-reason"), { target: { value: "live check" } });
    fireEvent.click(within(form).getByTestId("pipeline-ask-to-stop"));

    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request.mock.calls[0]?.[0]).toBe("/api/runs/ask-to-stop");
    expect(request.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      body: JSON.stringify({ cwd: "/repo", instanceId: "run-b", reason: "live check" }),
    }));
  });
});

describe("PipelineView — other working directories", () => {
  // 5.1
  it("names the branch this picture was read from, even with nothing in the queue", async () => {
    render(<PipelineView isActive load={async () => report()} survey={async () => survey(directory({ branch: "stale-branch" }))} />);

    expect(await screen.findByTestId("pipeline-reading-branch")).toHaveTextContent("Read from branch stale-branch in repo");
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
    // the-board-is-of-every-change: the main checkout is named for what it
    // is. Its label is the name of the folder somebody cloned into, which
    // says nothing about the place - on this repository it reads as the
    // product's own name. The directory's own heading keeps its label.
    expect(await screen.findByTestId("pipeline-directory-0-node-shared"))
      .toHaveTextContent("also in the main working directory");
    expect(screen.getByTestId("pipeline-directory-0").textContent).toContain("theirs");
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
    // the-pipeline-cards-wear-metro 2.2: the count is the bar's, in words for
    // everyone and as "1 / 3 tasks" for the eye; what a person must close is
    // a fact of its own.
    expect(node).toHaveTextContent("1 of 3 tasks done");
    expect(node.querySelector(".openspec-pipeline-node-count")).toHaveTextContent("1 / 3 tasks");
    expect(node.querySelector(".openspec-pipeline-node-bar > span")).toHaveStyle({ width: "33%" });
    expect(node).toHaveTextContent("1 only a person can close");
    expect(node).toHaveTextContent("last run failed at verify 2 hours ago, $0.84");
    expect(node.querySelector(".openspec-pipeline-node-state")).toHaveAttribute("data-state", "failed");
    expect(node.querySelector("[data-kind='last-run'] svg[aria-hidden='true']")).not.toBeNull();
  });

  // 6.3
  it("keeps every line on a card with more lines than it draws", async () => {
    const collisions = [{ kind: "overlapping-files" as const, files: ["a.ts"] }];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha", {
          worktreePath: "/w/alpha",
          blockedFrom: ["beta", "gamma", "delta", "epsilon"].map((changeName) => ({ changeName, collisions })),
        }))}
        survey={async () => survey(alphaHere())}
        lastRuns={async () => ({
          byChange: { alpha: { runId: "c1", outcome: "completed", stage: "apply", endedAt: new Date(Date.now() - 5 * 60_000).toISOString() } },
        })}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toHaveTextContent("last run completed at apply"));
    const node = screen.getByTestId("pipeline-node-alpha");
    const lines = ["1 only a person can close", "last run completed at apply 5 minutes ago", "not with beta", "not with gamma", "not with delta", "not with epsilon"];
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

    // A change archived on main is folded away now
    // (what-is-finished-is-tidied-away), so the word is read where the
    // reader would read it: after showing what landed.
    await waitFor(() => expect(screen.getByTestId("pipeline-landed")).toHaveTextContent("1 change has landed"));
    fireEvent.click(screen.getByTestId("pipeline-show-landed"));

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

  it("offers Logs on every card whose host can show them, running or not (a-change-shows-its-run-logs)", async () => {
    const onViewLogs = vi.fn();
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(directory({ changes: [{ changeName: "alpha", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [] }], runs: [] }))}
        onViewLogs={onViewLogs}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Logs of alpha" }));
    expect(onViewLogs).toHaveBeenCalledWith("alpha");
  });

  it("offers no Logs where the host cannot show them", async () => {
    renderCard({ record: null });

    await screen.findByRole("button", { name: "Start alpha" });
    expect(screen.queryByTestId("pipeline-logs-alpha")).toBeNull();
  });

  it("offers Start on a change that is ready, for its host to open the run dialog", async () => {
    const { onStart } = renderCard({ record: null });

    fireEvent.click(await screen.findByRole("button", { name: "Start alpha" }));
    expect(onStart).toHaveBeenCalledWith("alpha");
  });

  // the-web-ui-screens-wear-metro 4.3, the-pipeline-cards-wear-metro 2.4.
  it("keeps every control's accessible name after the icons arrived, and draws Start as the forward control", async () => {
    renderCard({ record: null });

    const start = await screen.findByRole("button", { name: "Start alpha" });
    expect(start.textContent).toBe("Start");
    expect(start.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(start).toHaveClass("openspec-pipeline-button--forward");

    // The card's own open control is its heading, and names the change.
    const open = screen.getByTestId("pipeline-node-alpha-open");
    expect(open).toHaveAccessibleName("alpha");
  });

  it("keeps Stop named as it was, with an icon that is not part of the name", async () => {
    renderCard({ held: [heldRun()] });

    const stop = await screen.findByRole("button", { name: "Stop alpha" });
    expect(stop.textContent).toBe("Stop");
    expect(stop.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(stop).toHaveClass("openspec-pipeline-button--stop");
    // A run this host started says so in its footer.
    expect(screen.getByTestId("pipeline-node-alpha-controls")).toHaveTextContent("started here");
  });

  // the-pipeline-cards-wear-metro 2.1: a waiting run's question is a callout,
  // and the card is taller by exactly that.
  it("says what a held run waits on in a callout above the facts, and draws Continue as the forward control", async () => {
    renderCard({
      record: { waiting: { kind: "checkpoint", stage: "apply", nextStage: "verify" } },
      held: [heldRun({ waiting: true })],
    });

    const continueButton = await screen.findByRole("button", { name: "Continue alpha to verify" });
    expect(continueButton).toHaveClass("openspec-pipeline-button--forward");
    const node = screen.getByTestId("pipeline-node-alpha");
    await waitFor(() => expect(node.querySelector(".openspec-pipeline-node-callout")).toHaveTextContent("waiting to continue to verify, in repo"));
    expect(node.querySelector(".openspec-pipeline-node-details [data-kind='waiting']")).toBeNull();
    expect(node.querySelector(".openspec-pipeline-node-note")).toHaveTextContent("apply");
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

  // the-pipeline-shows-what-it-has-read 2.4, 3.3; the-pipeline-cards-wear-metro 1.1
  it("draws only the facts a card draws, keeps the rest on the card, and counts them on the last drawn line", async () => {
    const collisions = [{ kind: "overlapping-files" as const, files: ["a.ts"] }];
    const others = ["beta", "gamma", "delta", "epsilon", "zeta", "eta"];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha", {
          worktreePath: "/w/alpha",
          blockedFrom: others.map((changeName) => ({ changeName, collisions })),
        }))}
      />,
    );

    const node = await screen.findByTestId("pipeline-node-alpha");
    const details = Array.from(node.querySelectorAll(".openspec-pipeline-node-detail"));
    const drawn = details.filter((detail) => !detail.classList.contains("openspec-pipeline-node-detail--beyond"));
    const beyond = details.filter((detail) => detail.classList.contains("openspec-pipeline-node-detail--beyond"));

    expect(drawn).toHaveLength(4);
    expect(beyond).toHaveLength(2);
    expect(drawn[3]?.querySelector(".openspec-pipeline-node-more")).toHaveTextContent("+2");
    // The card's height holds exactly the four it draws.
    const r = PIPELINE_CARD_REM;
    const quiet = 2 * r.borderBlock + r.headTop + r.nameLine + r.stateGap + r.stateLine + r.bottom;
    expect(Number(node.style.getPropertyValue("--h"))).toBe(quiet + r.detailsGap + 4 * r.detailLine);
    // Every line is still on the card, and in its title.
    for (const other of others) {
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

// a-screen-says-what-it-is-doing 3.14
describe("PipelineView — says it is reading, once", () => {
  it("reports its first reading and then null, and not again when it reads again", async () => {
    const load = vi.fn(async () => report(change("alpha")));
    const onReadingChange = vi.fn();
    render(<PipelineView isActive load={load} refresh={async () => "refs read"} onReadingChange={onReadingChange} />);

    expect(onReadingChange).toHaveBeenCalledWith("Reading what is running…");
    await screen.findByTestId("pipeline-node-alpha");
    await waitFor(() => expect(onReadingChange).toHaveBeenLastCalledWith(null));
    const callsAfterFirst = onReadingChange.mock.calls.length;

    fireEvent.click(screen.getByTestId("pipeline-refresh"));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await screen.findByTestId("pipeline-refs");

    expect(onReadingChange.mock.calls.length).toBe(callsAfterFirst);
  });
});

// what-is-finished-is-tidied-away 4.4: the fold, the press and the filter.
describe("PipelineView - what has landed, folded away", () => {
  const alphaHere = () => directory({
    changes: [{ changeName: "alpha", tasksDone: 1, tasksTotal: 3, blockers: [], alsoIn: [], tasksForPerson: 1, tasksDelegated: 0 }],
  } as Partial<Extract<SurveyedDirectory, { readable: true }>>);

  const landedStandings = (names: string[], rest: string[] = []) => async (): Promise<ChangeStandings> => ({
    readAt: new Date().toISOString(),
    standings: [
      ...names.map((changeName) => ({
        changeName,
        elsewhere: [],
        main: { kind: "archived" as const, archiveName: `2026-09-19-${changeName}` },
      })),
      ...rest.map((changeName) => ({ changeName, elsewhere: [] })),
    ],
    sources: { fetch: { attempted: false }, pullRequests: { read: true } },
  });

  it("folds the landed changes into one row, and opens them when asked", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        survey={async () => survey(alphaHere())}
        standings={landedStandings(["alpha"], ["beta"])}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-landed")).toHaveTextContent("1 change has landed"));
    expect(screen.queryByTestId("pipeline-node-alpha")).toBeNull();
    expect(screen.getByTestId("pipeline-node-beta")).toBeTruthy();

    fireEvent.click(screen.getByTestId("pipeline-show-landed"));

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toBeTruthy());
  });

  it("archives exactly the folded changes when the row is pressed", async () => {
    const archived: string[][] = [];
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        survey={async () => survey(alphaHere())}
        standings={landedStandings(["alpha"], ["beta"])}
        onArchive={(names) => archived.push(names)}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-archive-landed")).toBeTruthy());
    fireEvent.click(screen.getByTestId("pipeline-archive-landed"));

    expect(archived).toEqual([["alpha"]]);
  });

  it("offers no press where the host gave none", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        survey={async () => survey(alphaHere())}
        standings={landedStandings(["alpha"], ["beta"])}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-landed")).toBeTruthy());
    expect(screen.queryByTestId("pipeline-archive-landed")).toBeNull();
  });

  it("narrows the picture, and says what it is filtered by", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        survey={async () => survey(alphaHere())}
        standings={landedStandings([], ["alpha", "beta"])}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toBeTruthy());
    fireEvent.change(screen.getByTestId("pipeline-filter"), { target: { value: "beta" } });

    await waitFor(() => expect(screen.getByTestId("pipeline-filtered")).toHaveTextContent('Filtered by "beta" - showing 1 of 2'));
    expect(screen.queryByTestId("pipeline-node-alpha")).toBeNull();
    expect(screen.getByTestId("pipeline-node-beta")).toBeTruthy();
  });

  it("opens the folded group for a filter that matches inside it", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        survey={async () => survey(alphaHere())}
        standings={landedStandings(["alpha"], ["beta"])}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-landed")).toBeTruthy());
    fireEvent.change(screen.getByTestId("pipeline-filter"), { target: { value: "alpha" } });

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toBeTruthy());
    expect(screen.queryByTestId("pipeline-landed")).toBeNull();
  });
});

// main-catches-up-with-what-landed 2.6: the drift line, the press and the
// word on a foreign card.
describe("PipelineView - how far behind this checkout is", () => {
  const drifted = (over: Partial<MainDrift> = {}) => async (): Promise<MainDrift> => ({
    branch: "main",
    defaultBranch: "main",
    remote: "origin",
    ahead: 0,
    behind: 5,
    archivedOnDefault: ["alpha", "beta"],
    clean: true,
    ...over,
  });

  it("says how far behind it is and how many of the changes drawn are archived there", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        drift={drifted()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("pipeline-drift"))
      .toHaveTextContent("main is 5 commits behind origin/main; 2 of these changes are archived on main"));
  });

  it("says nothing where the checkout is level with its remote", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        drift={drifted({ behind: 0, archivedOnDefault: [] })}
      />,
    );

    await screen.findByTestId("pipeline-picture");
    expect(screen.queryByTestId("pipeline-drift")).toBeNull();
  });

  it("offers no press where the host passes no way to catch up", async () => {
    render(<PipelineView isActive load={async () => report(change("alpha"))} drift={drifted()} />);

    await screen.findByTestId("pipeline-drift");
    expect(screen.queryByTestId("pipeline-catch-up")).toBeNull();
  });

  it("catches up on the press, and says how far it moved", async () => {
    const onCatchUp = vi.fn(async () => ({ ok: true as const, branch: "main", moved: 5 }));
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        drift={drifted()}
        onCatchUp={onCatchUp}
      />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-catch-up"));

    await waitFor(() => expect(onCatchUp).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId("pipeline-catch-up-said"))
      .toHaveTextContent("Moved main on by 5 commits."));
  });

  it("shows a refusal beside the press rather than swallowing it", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        drift={drifted()}
        onCatchUp={async () => ({ ok: false, why: "the working tree is not clean" })}
      />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-catch-up"));

    await waitFor(() => expect(screen.getByTestId("pipeline-catch-up-said"))
      .toHaveTextContent("Not caught up: the working tree is not clean."));
  });

  it("says a change worked in another directory is archived on main", async () => {
    const elsewhere = directory({
      isThis: false,
      label: "other",
      path: "/wt/other",
      changes: [{ changeName: "gamma", tasksDone: 0, tasksTotal: 2, blockers: [], alsoIn: [], tasksForPerson: 0, tasksDelegated: 0 }],
    } as Partial<Extract<SurveyedDirectory, { readable: true }>>);
    const standings = async (): Promise<ChangeStandings> => ({
      readAt: new Date().toISOString(),
      standings: [{ changeName: "gamma", elsewhere: [], main: { kind: "archived", archiveName: "2026-09-19-gamma" } }],
      sources: { fetch: { attempted: false }, pullRequests: { read: true } },
    });

    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        survey={async () => survey(elsewhere)}
        standings={standings}
      />,
    );

    const card = await screen.findByTestId("pipeline-directory-0-node-gamma");
    expect(card).toHaveTextContent("archived on main");
  });
});

// the-board-shows-the-stages: the same cards, arranged as a board of the
// stages a change goes through, with who holds it on each card.
describe("the board", () => {
  const summary = (changeName: string, stage: ChangeStageSummary["stage"], overrides: Partial<ChangeStageSummary> = {}): ChangeStageSummary => ({
    changeName,
    stage,
    since: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    roles: {},
    totals: [],
    ...overrides,
  });

  const stages = (...summaries: ChangeStageSummary[]) => async () => summaries;

  it("offers the arrangement only where a host reads the stages", async () => {
    const { unmount } = render(<PipelineView isActive load={async () => report(change("alpha"))} />);
    await screen.findByTestId("pipeline-picture");
    expect(screen.queryByTestId("pipeline-arrangement")).toBeNull();
    unmount();

    render(<PipelineView isActive load={async () => report(change("alpha"))} stages={stages(summary("alpha", "planned"))} />);

    await screen.findByTestId("pipeline-arrangement");
  });

  it("heads its columns with the stages, and drops the lines between cards", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(
          change("alpha"),
          change("beta", { blockers: ["alpha"], run: { state: "blocked", blockedBy: ["alpha"] } }),
        )}
        stages={stages(summary("alpha", "in-review"), summary("beta", "planned"))}
      />,
    );
    await screen.findByTestId("pipeline-picture");
    // By step first: a line from alpha to beta.
    expect(screen.getByTestId("pipeline-edge-alpha-to-beta")).toBeTruthy();

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    await waitFor(() => expect(screen.queryByTestId("pipeline-edge-alpha-to-beta")).toBeNull());
    const headings = [...screen.getByTestId("pipeline-picture").querySelectorAll(".openspec-pipeline-stage-word")]
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Proposed", "Planned", "In progress", "In review", "Landed", "Archived"]);
    expect(screen.getByTestId("pipeline-arrangement-stages").getAttribute("aria-pressed")).toBe("true");
  });

  it("says on each card where the change is and who holds it, in either arrangement", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        stages={stages(summary("alpha", "in-review", { roles: { owner: "ada", implementer: "bob" } }))}
      />,
    );

    const card = await screen.findByTestId("pipeline-node-alpha");
    await waitFor(() => expect(card.textContent).toContain("In review for 2h, ada owns it, bob implements it"));
  });

  it("keeps the arrangement the viewer left", async () => {
    const memory: { value?: PipelineViewMemory } = {};
    const viewState = { read: () => memory.value, write: (next: PipelineViewMemory) => { memory.value = next; } };
    const { unmount } = render(
      <PipelineView isActive load={async () => report(change("alpha"))} stages={stages(summary("alpha", "landed"))} viewState={viewState} />,
    );
    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));
    await waitFor(() => expect(memory.value?.arrangement).toBe("stages"));
    unmount();

    render(<PipelineView isActive load={async () => report(change("alpha"))} stages={stages(summary("alpha", "landed"))} viewState={viewState} />);

    await waitFor(() => expect(screen.getByTestId("pipeline-arrangement-stages").getAttribute("aria-pressed")).toBe("true"));
  });

  // the-board-wears-its-stages. Colour never alone: the word is always
  // there, the picture agrees with it, and the colour agrees with both.
  it("heads each column with the stage's picture, its own colour and how many stand in it", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"), change("beta"))}
        stages={stages(summary("alpha", "in-progress"), summary("beta", "in-progress"))}
      />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    const picture = await screen.findByTestId("pipeline-picture");
    await waitFor(() => expect(picture.querySelectorAll(".openspec-pipeline-stage-heading")).toHaveLength(6));
    const inProgress = [...picture.querySelectorAll(".openspec-pipeline-stage-heading")]
      .find((one) => one.textContent?.startsWith("In progress")) as HTMLElement;
    // The stage's own token, never a colour written here.
    expect(inProgress.style.getPropertyValue("--stage-colour")).toBe("var(--stage-in-progress)");
    expect(inProgress.querySelector(".openspec-pipeline-stage-mark [class^=openspec-icon-]")).not.toBeNull();
    // Counted for the eye, and said for a reader who hears the heading.
    expect(screen.getByTestId("pipeline-stage-count-2").textContent).toBe(", 2 changes2");
    expect(screen.getByTestId("pipeline-stage-count-0").textContent).toBe(", 0 changes0");
  });

  // a-change-is-one-card-wherever-it-is. A board is of the work, not of
  // one folder: one person with several worktrees has one flow of work.
  it("stands another working directory's changes on the board, once each, read-only", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("mine"))}
        survey={async () => survey(
          directory({ changes: [{ changeName: "mine", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: [] }] }),
          theirs({ changes: [{ changeName: "theirs", tasksDone: 1, tasksTotal: 2, blockers: [], alsoIn: [] }] }),
        )}
        stages={stages(summary("mine", "planned"), summary("theirs", "in-review"))}
      />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    const board = await screen.findByTestId("pipeline-picture");
    await waitFor(() => expect(board.querySelector("[data-testid='pipeline-node-theirs']")).not.toBeNull());
    // One in Planned, one in In review.
    expect(screen.getByTestId("pipeline-stage-count-1").textContent).toBe(", 1 change1");
    expect(screen.getByTestId("pipeline-stage-count-3").textContent).toBe(", 1 change1");
    // Read here, never acted on from here: it says where it is worked, and
    // offers no control but its tasks.
    const card = screen.getByTestId("pipeline-node-theirs");
    expect(card.getAttribute("data-state")).toBe("foreign");
    expect(card.textContent).toContain("worked in theirs");
    expect(card.textContent).toContain("In review");
    // And never drawn a second time below.
    expect(screen.queryByTestId("pipeline-directory-0-node-theirs")).toBeNull();
    expect(screen.getByRole("heading", { name: "Changes" })).toBeTruthy();
  });

  it("leaves the other directories' cards where they were in the other arrangement", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("mine"))}
        survey={async () => survey(
          directory({ changes: [{ changeName: "mine", tasksDone: 0, tasksTotal: 1, blockers: [], alsoIn: [] }] }),
          theirs({ changes: [{ changeName: "theirs", tasksDone: 1, tasksTotal: 2, blockers: [], alsoIn: [] }] }),
        )}
        stages={stages(summary("mine", "planned"))}
      />,
    );

    expect(await screen.findByTestId("pipeline-directory-0-node-theirs")).toBeTruthy();
    expect(screen.queryByTestId("pipeline-node-theirs")).toBeNull();
    expect(screen.getByRole("heading", { name: "Changes in this checkout" })).toBeTruthy();
  });

  it("rules one column off from the next, and never before the first", async () => {
    render(
      <PipelineView isActive load={async () => report(change("alpha"))} stages={stages(summary("alpha", "planned"))} />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    const picture = await screen.findByTestId("pipeline-picture");
    await waitFor(() => expect(picture.querySelectorAll(".openspec-pipeline-stage-rule")).toHaveLength(5));

    // The other arrangement's columns are a sequence, not places: no rule.
    fireEvent.click(screen.getByTestId("pipeline-arrangement-steps"));
    await waitFor(() => expect(picture.querySelectorAll(".openspec-pipeline-stage-rule")).toHaveLength(0));
  });

  // the-board-is-of-every-change. A board whose columns appeared only once
  // something stood in them would say nothing about the way through, and a
  // person pressing "By stage" on an empty queue saw no board at all.
  it("draws every column with nothing on it, and says why it is empty", async () => {
    render(<PipelineView isActive load={async () => report()} stages={stages()} />);

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    const picture = await screen.findByTestId("pipeline-picture");
    await waitFor(() => {
      const headings = [...picture.querySelectorAll(".openspec-pipeline-stage-word")].map((one) => one.textContent);
      expect(headings).toEqual(["Proposed", "Planned", "In progress", "In review", "Landed", "Archived"]);
    });
    expect((await screen.findByTestId("pipeline-board-empty")).textContent).toContain("every column is empty");
    // The step arrangement still says what it always said.
    fireEvent.click(screen.getByTestId("pipeline-arrangement-steps"));
    await waitFor(() => expect(screen.queryByTestId("pipeline-picture")).toBeNull());
    expect(screen.getByTestId("pipeline-empty")).toBeTruthy();
  });

  // Landed is a column of the board, so folding what landed empties that
  // column by construction.
  it("puts a change that landed in its column rather than folding it away", async () => {
    render(
      <PipelineView
        isActive
        load={async () => report(change("alpha"))}
        standings={async (): Promise<ChangeStandings> => ({
          readAt: new Date().toISOString(),
          standings: [{ changeName: "alpha", elsewhere: [], main: { kind: "archived", archiveName: "2026-09-19-alpha" } }],
          sources: { fetch: { attempted: false }, pullRequests: { read: true } },
        })}
        stages={stages(summary("alpha", "landed"))}
      />,
    );

    fireEvent.click(await screen.findByTestId("pipeline-arrangement-stages"));

    await waitFor(() => expect(screen.getByTestId("pipeline-node-alpha")).toBeTruthy());
    expect(screen.queryByTestId("pipeline-board-empty")).toBeNull();
  });
});
