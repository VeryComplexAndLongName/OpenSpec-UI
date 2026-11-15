import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeActionDialog, PrReviewExampleDialog, type PerformChangeAction } from "./ChangeActionDialog.js";

// a-change-is-acted-on-from-its-card (ADR 0044): a standalone card's action,
// run by the server where the change is worked, said over the Pipeline.

describe("ChangeActionDialog", () => {
  it("marks the displayed SHA then switches between the incremental and full review", async () => {
    const head = "a".repeat(40);
    const shown = { title: "Review", summary: "Proposal", diff: "+Full", truncated: false, head };
    const perform = vi.fn<PerformChangeAction>()
      .mockResolvedValueOnce({ kind: "pr-review", report: shown })
      .mockResolvedValueOnce({ kind: "pr-review", report: { ...shown, lastReviewed: head } })
      .mockResolvedValueOnce({ kind: "pr-review", report: { ...shown, lastReviewed: head, sinceLastReview: true, diff: "+Revised proposal" } })
      .mockResolvedValueOnce({ kind: "pr-review", report: { ...shown, lastReviewed: head } });
    const target = { action: "showPrReview" as const, changeName: "demo" };
    render(<ChangeActionDialog target={target} perform={perform} onClose={() => undefined} />);

    fireEvent.click(await screen.findByRole("button", { name: "Mark as reviewed" }));
    expect(perform).toHaveBeenLastCalledWith(target, { prReview: { markReviewedCommit: head } });
    fireEvent.click(await screen.findByRole("button", { name: "Show Changes Since Last Review" }));
    expect(perform).toHaveBeenLastCalledWith(target, { prReview: { sinceLastReview: true } });
    expect(await screen.findByLabelText("Committed diff")).toHaveTextContent("+Revised proposal");
    fireEvent.click(screen.getByRole("button", { name: "Show Full PR Diff" }));
    expect(await screen.findByLabelText("Committed diff")).toHaveTextContent("+Full");
  });

  it("shows the fictional example and copies its summary without refreshing", async () => {
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      render(<PrReviewExampleDialog onClose={() => undefined} />);
      expect(screen.getByRole("dialog", { name: "PR Review example" })).toHaveTextContent("This fictional checkout change");
      expect(screen.queryByRole("button", { name: "Refresh PR checks" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Committed diff")).toHaveTextContent("address.postalCode.trim()");
      fireEvent.click(screen.getByRole("button", { name: "Copy PR summary" }));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PR summary copied."));
      expect(copy.mock.calls[0]?.[0]).toContain("### Scenario evidence");
    } finally {
      copy.mockRestore();
    }
  });

  it("refreshes GitHub checks on request and links to the returned run", async () => {
    const perform = vi.fn<PerformChangeAction>()
      .mockResolvedValueOnce({ kind: "pr-review", report: { title: "Review", summary: "Local evidence", diff: null, truncated: false } })
      .mockResolvedValueOnce({ kind: "pr-review", report: {
        title: "Review", summary: "### GitHub checks\n\n- [Open run](<https://github.com/owner/repo/actions/runs/12>)",
        diff: null, truncated: false,
      } });
    const target = { action: "showPrReview" as const, changeName: "demo" };
    render(<ChangeActionDialog target={target} perform={perform} onClose={() => undefined} />);
    fireEvent.click(await screen.findByRole("button", { name: "Refresh PR checks" }));
    expect(perform.mock.calls).toEqual([[target, undefined], [target, { prReview: { refreshGitHubChecks: true } }]]);
    expect(await screen.findByRole("link", { name: "Open run" })).toHaveAttribute("href", "https://github.com/owner/repo/actions/runs/12");
  });

  it("shows a mapping diff before submitting a distinct save", async () => {
    const head = "a".repeat(40);
    const revision = "b".repeat(64);
    const scenario = { capability: "checkout", requirement: "Shipping", scenario: "Address change" };
    const selection = { head, scenario, check: "Address tests" };
    const shown = { title: "Review", summary: "GitLab checks", diff: null, truncated: false, head,
      mappingChoices: { scenarios: [scenario], checks: [selection.check] } };
    const perform = vi.fn<PerformChangeAction>()
      .mockResolvedValueOnce({ kind: "pr-review", report: shown })
      .mockResolvedValueOnce({ kind: "pr-review", report: { ...shown, mappingPreview: { selection, revision, diff: "+Address tests" } } })
      .mockResolvedValueOnce({ kind: "pr-review", report: { ...shown, summary: "Mapping saved" } });
    const target = { action: "showPrReview" as const, changeName: "demo" };
    render(<ChangeActionDialog target={target} perform={perform} onClose={() => undefined} />);
    fireEvent.change(await screen.findByRole("combobox", { name: "Scenario" }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Reported check" }), { target: { value: selection.check } });
    fireEvent.click(screen.getByRole("button", { name: "Show Mapping Preview" }));
    expect(perform).toHaveBeenLastCalledWith(target, { prReview: { scenarioMapping: { mode: "preview", selection } } });
    expect(await screen.findByLabelText("Scenario mapping diff")).toHaveTextContent("+Address tests");
    expect(perform).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Save Scenario Mapping" }));
    expect(perform).toHaveBeenLastCalledWith(target, { prReview: { scenarioMapping: { mode: "save", selection, revision } } });
    expect(await screen.findByText("Mapping saved")).toBeVisible();
  });

  it("sends a reading action at once and shows what came back", async () => {
    const perform = vi.fn<PerformChangeAction>(async () => ({ kind: "report", title: "Show Ancestry demo", markdown: "- **older** change" }));
    render(<ChangeActionDialog target={{ action: "showAncestry", changeName: "demo" }} perform={perform} onClose={() => undefined} />);

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Show Ancestry demo");
    expect(await screen.findByTestId("change-action-report")).toHaveTextContent("older change");
    expect(perform).toHaveBeenCalledWith({ action: "showAncestry", changeName: "demo" }, undefined);
  });

  it("offers the relations the server named, and sends the one picked", async () => {
    const perform = vi.fn<PerformChangeAction>()
      .mockResolvedValueOnce({ kind: "relations", keys: ["follows", "supersedes", "blocked_by"], changes: ["alpha", "beta"], stated: [] })
      .mockResolvedValueOnce({ kind: "done", message: "demo now states supersedes beta." });
    render(<ChangeActionDialog target={{ action: "addRelation", changeName: "demo" }} perform={perform} onClose={() => undefined} />);

    const form = await screen.findByTestId("change-action-relation");
    const [kind, change] = form.querySelectorAll("select");
    fireEvent.change(kind!, { target: { value: "supersedes" } });
    fireEvent.change(change!, { target: { value: "beta" } });
    fireEvent.click(screen.getByRole("button", { name: "Add Relation" }));

    expect(await screen.findByTestId("change-action-done")).toHaveTextContent("demo now states supersedes beta.");
    expect(perform).toHaveBeenLastCalledWith({ action: "addRelation", changeName: "demo" }, { relation: { key: "supersedes", id: "beta" } });
  });

  it("asks what to say before it sends anything, and says a refusal", async () => {
    const perform = vi.fn<PerformChangeAction>(async () => { throw new Error("nothing is running on demo, so there is nobody to say it to"); });
    render(<ChangeActionDialog target={{ action: "sendMessage", changeName: "demo" }} perform={perform} onClose={() => undefined} />);

    expect(perform).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "What to say" }), { target: { value: "do not touch the manifest" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Message" }));

    await waitFor(() => expect(screen.getByTestId("change-action-failed")).toHaveTextContent("nobody to say it to"));
    expect(perform).toHaveBeenCalledWith({ action: "sendMessage", changeName: "demo" }, { message: { kind: "note", words: "do not touch the manifest" } });
  });
});
