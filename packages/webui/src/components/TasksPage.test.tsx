import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TasksPage, type ChangeTasksReading } from "./TasksPage.js";

// a-card-works-its-own-tasks 3.3: what a card's name opens in a browser.
const reading = (source: "own-worktree" | "this-checkout"): ChangeTasksReading => ({
  ok: true,
  changeName: "fresh",
  source,
  path: source === "own-worktree" ? "/wt/fresh" : "/repo",
  tasksPath: "/wt/fresh/openspec/changes/fresh/tasks.md",
  rows: [
    { number: "1.1", text: "Write it", lineNumber: 2, done: true, closedBy: "agent" },
    { number: "1.2", text: "**Human-only**: look", lineNumber: 3, body: "closely, in the Pipeline.", done: false, closedBy: "person" },
  ],
});

describe("TasksPage", () => {
  it("shows every task whole, with what is written under it, and where it was read", async () => {
    render(<TasksPage changeName="fresh" load={async () => reading("own-worktree")} />);

    const page = await screen.findByTestId("tasks-page");
    expect(page.textContent).toContain("closely, in the Pipeline.");
    expect(screen.getByTestId("tasks-page-where").textContent).toContain("/wt/fresh");
  });

  it("closes a task through the panel, and reads the list again", async () => {
    const load = vi.fn(async () => reading("own-worktree"));
    const set = vi.fn(async () => ({ ok: true, said: "Written." }));
    render(<TasksPage changeName="fresh" load={load} actions={{ set, commit: vi.fn(), openTargets: ["tasks"] }} />);

    fireEvent.click(await screen.findByTestId("tasks-page-row-1.2"));
    const panel = screen.getByTestId("task-panel");
    fireEvent.change(within(panel).getByTestId("task-panel-note"), { target: { value: "seen" } });
    fireEvent.click(within(panel).getByTestId("task-panel-set"));

    await waitFor(() => expect(set).toHaveBeenCalledWith("fresh", { lineNumber: 3, text: "1.2 **Human-only**: look" }, true, "seen"));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });

  it("is read-only where the change has no worktree of its own", async () => {
    render(<TasksPage changeName="fresh" load={async () => reading("this-checkout")} actions={{ set: vi.fn(), commit: vi.fn(), openTargets: ["tasks"] }} />);

    expect((await screen.findByTestId("tasks-page-where")).textContent).toContain("read-only");
    expect(screen.queryByTestId("tasks-page-list")).toBeNull();
    fireEvent.click(screen.getByTestId("tasks-page-row-1.2"));
    expect(within(screen.getByTestId("task-panel")).queryByTestId("task-panel-form")).toBeNull();
  });

  it("marks the line it was opened at, and says a refusal", async () => {
    const { unmount } = render(<TasksPage changeName="fresh" load={async () => reading("own-worktree")} line={3} />);
    await screen.findByTestId("tasks-page");
    expect(document.querySelector("[data-line='3']")?.getAttribute("data-marked")).toBe("true");
    unmount();

    render(<TasksPage changeName="gone" load={async () => ({ ok: false, kind: "no-task-list", reason: "gone has no tasks.md." })} />);
    expect((await screen.findByTestId("tasks-page-refused")).textContent).toBe("gone has no tasks.md.");
  });
});
