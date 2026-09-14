import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChangeReadinessReport } from "@openspec-ui/core/browser";
import { PipelineView } from "./PipelineView.js";

// a-change-says-where-it-stands 4.5. What a refresh fetches is the host's;
// the view asks once however often it is pressed, then reads again.

const REPORT: ChangeReadinessReport = { changes: [] };

describe("PipelineView — Refresh", () => {
  it("fetches once however often it is pressed meanwhile, reads again, and says when refs were fetched", async () => {
    let finish: (sources: string) => void = () => undefined;
    const refresh = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const load = vi.fn(async () => REPORT);
    render(<PipelineView isActive load={load} refresh={refresh} />);
    await screen.findByTestId("pipeline-empty");
    const readsBefore = load.mock.calls.length;

    fireEvent.click(screen.getByTestId("pipeline-refresh"));
    fireEvent.click(screen.getByTestId("pipeline-refresh"));
    expect(screen.getByTestId("pipeline-refresh")).toBeDisabled();
    finish("Main read from origin/main. Refs last fetched 2026-09-14 00:50 UTC.");

    expect(await screen.findByTestId("pipeline-refs")).toHaveTextContent("Refs last fetched 2026-09-14 00:50 UTC.");
    expect(refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(load.mock.calls.length).toBeGreaterThan(readsBefore));
    expect(screen.getByTestId("pipeline-refresh")).not.toBeDisabled();
  });

  it("says a failed refresh beside the control", async () => {
    render(<PipelineView isActive load={async () => REPORT} refresh={async () => { throw new Error("could not resolve host"); }} />);
    await screen.findByTestId("pipeline-empty");

    fireEvent.click(screen.getByTestId("pipeline-refresh"));

    expect(await screen.findByTestId("pipeline-refresh-error")).toHaveTextContent("Refresh failed: could not resolve host");
  });

  it("offers no Refresh where the host gives none", async () => {
    render(<PipelineView isActive load={async () => REPORT} />);
    await screen.findByTestId("pipeline-empty");

    expect(screen.queryByTestId("pipeline-refresh")).toBeNull();
  });
});
