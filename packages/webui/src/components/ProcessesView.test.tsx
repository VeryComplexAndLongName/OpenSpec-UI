import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProcessesView, type ProcessesApi } from "./ProcessesView.js";

function createApi(): ProcessesApi {
  return {
    list: vi.fn().mockResolvedValue([{ id: "run-1", operation: "implement", changeName: "demo", state: "interrupted", createdAt: "2026-08-13T00:00:00.000Z" }]),
    details: vi.fn().mockResolvedValue({
      process: { id: "run-1", operation: "implement", state: "interrupted", createdAt: "2026-08-13T00:00:00.000Z" },
      delta: [{ path: "src/app.ts", kind: "modified" }],
      coverage: { excludedDirectories: ["node_modules"], skippedFiles: ["large.bin"] },
      canRollback: true,
    }),
    rollback: vi.fn().mockResolvedValue({ restored: ["src/app.ts"], conflicts: [] }),
    cleanup: vi.fn().mockResolvedValue({ removed: 1, retained: 0 }),
  };
}

describe("ProcessesView", () => {
  it("loads history, reveals recovery details, and rolls back", async () => {
    const api = createApi();
    render(<ProcessesView api={api} />);
    expect(await screen.findByText("interrupted")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    // The changed files are a table of path and kind
    // (the-remaining-tabs-wear-metro 2.3).
    expect(await screen.findByText("src/app.ts")).toBeInTheDocument();
    expect(screen.getByText("modified")).toBeInTheDocument();
    expect(screen.getByText(/large\.bin/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rollback files" }));
    await waitFor(() => expect(api.rollback).toHaveBeenCalledWith("run-1"));
    expect(await screen.findByText("Rollback restored 1 files.")).toBeInTheDocument();
  });

  it("cleans history using the selected retention period", async () => {
    const api = createApi();
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");
    fireEvent.click(screen.getByRole("button", { name: "Clean old history" }));
    await waitFor(() => expect(api.cleanup).toHaveBeenCalledOnce());
  });

  it("shows the process's agentId and a percent-complete derived from changeProgress, not the process itself", async () => {
    const api: ProcessesApi = {
      ...createApi(),
      list: vi.fn().mockResolvedValue([
        { id: "run-1", operation: "implement", changeName: "demo", agentId: "claude-cli", state: "running", createdAt: "2026-08-13T00:00:00.000Z" },
      ]),
    };
    render(<ProcessesView api={api} changeProgress={{ demo: { completedTasks: 3, totalTasks: 4 } }} />);

    expect(await screen.findByText("claude-cli")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("renders a dash for agent and progress when neither is known", async () => {
    const api = createApi();
    render(<ProcessesView api={api} />);

    await screen.findByText("interrupted");
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("shows the recorded cost next to state when the process carries usage (task 6.2)", async () => {
    const api: ProcessesApi = {
      ...createApi(),
      list: vi.fn().mockResolvedValue([
        { id: "run-1", operation: "implement", changeName: "demo", state: "completed", createdAt: "2026-08-13T00:00:00.000Z", usage: { costUsd: 0.26 } },
      ]),
    };
    render(<ProcessesView api={api} />);

    // The state is a badge and what it cost sits beside it
    // (the-remaining-tabs-wear-metro 2.2).
    expect(await screen.findByText("completed")).toHaveClass("badge");
    expect(screen.getByText("$0.26")).toBeInTheDocument();
  });

  it("renders the state cell identically to today when the process carries no usage (task 6.3)", async () => {
    const api = createApi();
    render(<ProcessesView api={api} />);

    expect(await screen.findByText("interrupted")).toBeInTheDocument();
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
  });

  it("shows a suspended process as waiting, with its wait reason, in the list and in details (harness-suspendable-stage task 6.2)", async () => {
    const api: ProcessesApi = {
      ...createApi(),
      list: vi.fn().mockResolvedValue([
        {
          id: "run-1", operation: "implement", changeName: "demo", state: "suspended",
          waitingFor: "a CI run to finish", createdAt: "2026-08-13T00:00:00.000Z",
        },
      ]),
      details: vi.fn().mockResolvedValue({
        process: {
          id: "run-1", operation: "implement", state: "suspended",
          waitingFor: "a CI run to finish", createdAt: "2026-08-13T00:00:00.000Z",
        },
        canRollback: false,
      }),
    };
    render(<ProcessesView api={api} />);

    expect(await screen.findByText("suspended")).toHaveClass("badge");
    expect(screen.getByText("a CI run to finish")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("Waiting for: a CI run to finish")).toBeInTheDocument();
  });
});

// the-review-button-shows-what-it-has: the press is answered where it was
// made, and a hundred rows can be narrowed.
describe("ProcessesView - the answer appears under the row", () => {
  function listOf(count: number) {
    return Array.from({ length: count }, (unused, at) => ({
      id: `run-${at + 1}`,
      operation: at === 0 ? "implement" : "chain",
      changeName: `change-${at + 1}`,
      agentId: at === 0 ? "claude-cli" : "codex-acp",
      state: at === 0 ? "interrupted" : "completed",
      createdAt: "2026-08-13T00:00:00.000Z",
    }));
  }

  it("opens the details under the run's own row, and folds them on a second press", async () => {
    const api = createApi();
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");

    const review = screen.getByTestId("processes-review-run-1");
    expect(review).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(review);

    const open = await screen.findByTestId("processes-details-run-1");
    expect(await screen.findByText("src/app.ts")).toBeInTheDocument();
    // The answer is inside the table, in the row that follows the one
    // pressed, not in a panel at the foot of the tab.
    expect(open.previousElementSibling).toContainElement(review);
    expect(review).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(review);
    await waitFor(() => expect(screen.queryByTestId("processes-details-run-1")).not.toBeInTheDocument());
    expect(screen.getByTestId("processes-review-run-1")).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the open run when another is asked for", async () => {
    const api: ProcessesApi = {
      ...createApi(),
      list: vi.fn().mockResolvedValue(listOf(2)),
      details: vi.fn(async (processId: string) => ({
        process: { id: processId, operation: "chain", state: "completed", createdAt: "2026-08-13T00:00:00.000Z", summary: `summary of ${processId}` },
        canRollback: false,
      })),
    };
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");

    fireEvent.click(screen.getByTestId("processes-review-run-1"));
    expect(await screen.findByText("summary of run-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("processes-review-run-2"));
    expect(await screen.findByText("summary of run-2")).toBeInTheDocument();
    expect(screen.queryByTestId("processes-details-run-1")).not.toBeInTheDocument();
  });

  it("says in the row itself when the details cannot be read", async () => {
    const api: ProcessesApi = { ...createApi(), details: vi.fn().mockRejectedValue(new Error("journal is unreadable")) };
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");

    fireEvent.click(screen.getByTestId("processes-review-run-1"));

    const open = await screen.findByTestId("processes-details-run-1");
    expect(open).toHaveTextContent("Its details could not be read: journal is unreadable");
  });

  it("narrows the list by a word and says how many of how many it shows", async () => {
    const api: ProcessesApi = { ...createApi(), list: vi.fn().mockResolvedValue(listOf(3)) };
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");

    fireEvent.change(screen.getByTestId("processes-filter"), { target: { value: "implement" } });

    expect(screen.getByTestId("processes-filtered")).toHaveTextContent('Filtered by "implement" - showing 1 of 3');
    expect(screen.getByTestId("processes-review-run-1")).toBeInTheDocument();
    expect(screen.queryByTestId("processes-review-run-2")).not.toBeInTheDocument();
  });

  it("closes an open run the filter hides, so nothing is left open out of sight", async () => {
    const api: ProcessesApi = {
      ...createApi(),
      list: vi.fn().mockResolvedValue(listOf(2)),
      details: vi.fn(async (processId: string) => ({
        process: { id: processId, operation: "implement", state: "interrupted", createdAt: "2026-08-13T00:00:00.000Z", summary: `summary of ${processId}` },
        canRollback: false,
      })),
    };
    render(<ProcessesView api={api} />);
    await screen.findByText("interrupted");

    fireEvent.click(screen.getByTestId("processes-review-run-1"));
    expect(await screen.findByText("summary of run-1")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("processes-filter"), { target: { value: "codex" } });

    await waitFor(() => expect(screen.queryByTestId("processes-details-run-1")).not.toBeInTheDocument());
  });
});

// a-screen-says-what-it-is-doing 3.14
describe("ProcessesView — says what it is reading", () => {
  it("reports its reading while the list loads, and null once it has returned", async () => {
    type Listed = Awaited<ReturnType<ProcessesApi["list"]>>;
    let answer: (value: Listed) => void = () => undefined;
    const api: ProcessesApi = { ...createApi(), list: vi.fn(() => new Promise<Listed>((resolve) => { answer = resolve; })) };
    const onReadingChange = vi.fn();
    render(<ProcessesView api={api} onReadingChange={onReadingChange} />);

    await waitFor(() => expect(onReadingChange).toHaveBeenLastCalledWith("Reading persisted runs…"));
    expect(screen.getByRole("button", { name: "Clean old history" })).toBeDisabled();

    answer([]);

    await waitFor(() => expect(onReadingChange).toHaveBeenLastCalledWith(null));
    expect(screen.getByRole("button", { name: "Clean old history" })).toBeEnabled();
  });
});
