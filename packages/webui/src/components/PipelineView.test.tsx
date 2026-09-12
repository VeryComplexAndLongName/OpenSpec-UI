import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeReadiness, ChangeReadinessReport } from "@openspec-ui/core/browser";
import { PIPELINE_POLL_INTERVAL_MS, PipelineView } from "./PipelineView.js";

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
});
