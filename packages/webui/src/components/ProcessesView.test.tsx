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
    expect(await screen.findByText("modified: src/app.ts")).toBeInTheDocument();
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
});