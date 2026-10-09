import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeActionDialog, type PerformChangeAction } from "./ChangeActionDialog.js";

// a-change-is-acted-on-from-its-card (ADR 0044): a standalone card's action,
// run by the server where the change is worked, said over the Pipeline.

describe("ChangeActionDialog", () => {
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
