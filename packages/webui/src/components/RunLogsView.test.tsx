import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunLogRecord, RunLogSummary } from "@openspec-ui/core/browser";
import { RunLogsView, runLogBlocks } from "./RunLogsView.js";

// a-change-shows-its-run-logs. The host reads; these assert what a person
// is shown of what it read.

const summary = (overrides: Partial<RunLogSummary>): RunLogSummary => ({
  runId: "r1",
  agent: "claude-cli",
  kind: "implement",
  changeName: "alpha",
  stages: ["implement"],
  startedAt: "2026-09-21T10:00:00.000Z",
  endedAt: "2026-09-21T10:02:05.000Z",
  outcome: "completed",
  bytes: 100,
  ...overrides,
});

const RECORDS: RunLogRecord[] = [
  { type: "start", runId: "r1", at: "2026-09-21T10:00:00.000Z", agent: "claude-cli", kind: "chain", cwd: "/repo", stage: "apply" },
  { type: "line", at: "2026-09-21T10:00:01.000Z", stream: "stdout", text: "compiling " },
  { type: "line", at: "2026-09-21T10:00:01.100Z", stream: "stdout", text: "done" },
  { type: "line", at: "2026-09-21T10:00:02.000Z", stream: "tool", text: "Bash: npm test" },
  { type: "line", at: "2026-09-21T10:00:03.000Z", stream: "stderr", text: "1 failing" },
  { type: "end", at: "2026-09-21T10:00:04.000Z", outcome: "failed", reason: "tests failed" },
];

describe("runLogBlocks", () => {
  it("joins the chunks of one stream, marks what is not the agent speaking, and says how a part ended", () => {
    const blocks = runLogBlocks(RECORDS);

    expect(blocks.map((block) => block.kind)).toEqual(["part", "text", "text", "text", "end"]);
    expect(blocks[1]).toEqual({ kind: "text", stream: "stdout", text: "compiling done" });
    expect(blocks[2]).toEqual({ kind: "text", stream: "tool", text: "[tool] Bash: npm test" });
    expect(blocks[4]).toMatchObject({ kind: "end", outcome: "failed" });
    expect(blocks[4]?.text).toContain("tests failed");
  });
});

describe("RunLogsView", () => {
  it("lists the change's runs, shows the newest, and shows another when chosen", async () => {
    const read = vi.fn(async (runId: string) => runId === "r2" ? RECORDS : [RECORDS[0]!, { type: "line", at: "t", stream: "stdout", text: "older run" } as RunLogRecord]);
    render(
      <RunLogsView
        changeName="alpha"
        load={async () => [summary({ runId: "r2", startedAt: "2026-09-21T11:00:00.000Z", outcome: "failed", reason: "tests failed" }), summary({ runId: "r1" })]}
        read={read}
        onClose={() => undefined}
      />,
    );

    const list = await screen.findByTestId("run-logs-list");
    expect(within(list).getByTestId("run-logs-run-r2")).toHaveTextContent("failed");
    expect(within(list).getByTestId("run-logs-run-r2")).toHaveTextContent("tests failed");
    await waitFor(() => expect(screen.getByTestId("run-log")).toHaveTextContent("compiling done"));

    fireEvent.click(within(within(list).getByTestId("run-logs-run-r1")).getByRole("button"));
    await waitFor(() => expect(screen.getByTestId("run-log")).toHaveTextContent("older run"));
    expect(read).toHaveBeenCalledWith("r1");
  });

  it("says so where no run has left a log", async () => {
    render(<RunLogsView changeName="alpha" load={async () => []} read={async () => []} onClose={() => undefined} />);

    expect(await screen.findByTestId("run-logs-none")).toHaveTextContent("No run of this change has left a log");
  });

  // logs-open-when-asked: opened beneath the picture, the view showed 82
  // pixels of itself and the press seemed to do nothing.
  it("takes the focus, closes on Escape, and gives the focus back to the button pressed", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Logs of alpha</button>
          {open ? <RunLogsView changeName="alpha" load={async () => []} read={async () => []} onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Logs of alpha" });
    opener.focus();
    fireEvent.click(opener);

    const view = screen.getByRole("dialog", { name: "Logs of alpha" });
    expect(view).toHaveFocus();
    await screen.findByTestId("run-logs-none");

    fireEvent.keyDown(view, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("says why where the logs could not be read, and closes", async () => {
    const onClose = vi.fn();
    render(<RunLogsView changeName="alpha" load={async () => { throw new Error("no workspace"); }} read={async () => []} onClose={onClose} />);

    expect(await screen.findByTestId("run-logs-failed")).toHaveTextContent("no workspace");
    fireEvent.click(screen.getByTestId("run-logs-close"));
    expect(onClose).toHaveBeenCalled();
  });
});
