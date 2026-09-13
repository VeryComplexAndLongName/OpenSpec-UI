import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ChangeReadiness,
  ChangeReadinessReport,
  SurveyedDirectory,
  SurveyedRun,
  WorktreeSurvey,
} from "@openspec-ui/core/browser";
import { PIPELINE_POLL_INTERVAL_MS, PipelineView, SURVEY_POLL_INTERVAL_MS } from "./PipelineView.js";

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
  return {
    instanceId: "run-1",
    changeName: "their-change",
    stage: "apply",
    activity: "Bash: npm test",
    activitySinceMs: 12_000,
    heartbeatAgeMs: 2_000,
    gone: false,
    workingDirectory: "/wt/repo/theirs",
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
