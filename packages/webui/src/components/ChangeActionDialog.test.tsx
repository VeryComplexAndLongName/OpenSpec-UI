import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeActionDialog, PrReviewExampleDialog, type PerformChangeAction } from "./ChangeActionDialog.js";

// a-change-is-acted-on-from-its-card (ADR 0044): a standalone card's action,
// run by the server where the change is worked, said over the Pipeline.

describe("ChangeActionDialog", () => {
  it("shows the fictional example and copies its summary without refreshing", async () => {
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    try {
      render(<PrReviewExampleDialog onClose={() => undefined} />);
      expect(screen.getByRole("dialog", { name: "PR Review example" })).toHaveTextContent("This fictional checkout change");
      expect(screen.queryByRole("button", { name: "Refresh GitHub checks" })).not.toBeInTheDocument();
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
    fireEvent.click(await screen.findByRole("button", { name: "Refresh GitHub checks" }));
    expect(perform.mock.calls).toEqual([[target, undefined], [target, { prReview: { refreshGitHubChecks: true } }]]);
    expect(await screen.findByRole("link", { name: "Open run" })).toHaveAttribute("href", "https://github.com/owner/repo/actions/runs/12");
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
