import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IssueChangeForm } from "./IssueChangeForm.js";

const preview = { number: 12, title: "Keep <script> as text", body: "Request from issue", sourceUrl: "https://github.com/team/repo/issues/12", revision: "a".repeat(64), forge: "GitHub", state: "open", updatedAt: "today", truncated: true };
describe("IssueChangeForm", () => {
  it("requires preview and explicit creation, preserving the exact confirmed revision", async () => {
    const apiFetch = vi.fn(async () => new Response(JSON.stringify(preview)));
    const onCreate = vi.fn(async () => undefined);
    render(<IssueChangeForm cwd="/repo" changeName="from-issue" apiFetch={apiFetch} onCreate={onCreate} />);
    expect(screen.queryByRole("button", { name: "Create Change From Issue" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Issue number or URL"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Show Issue" }));
    expect(await screen.findByText(preview.title)).toBeVisible();
    expect(screen.getByText(/Source truncated/)).toBeVisible();
    expect(screen.getByText(/may commit and push/)).toBeVisible();
    expect(onCreate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create Change From Issue" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ reference: "12", revision: preview.revision }));
    fireEvent.change(screen.getByLabelText("Issue number or URL"), { target: { value: "13" } });
    expect(screen.queryByRole("button", { name: "Create Change From Issue" })).toBeNull();
  });
  it("shows a refusal and never offers confirmation for an unreadable issue", async () => {
    render(<IssueChangeForm cwd="/repo" changeName="from-issue" apiFetch={async () => new Response(JSON.stringify({ error: "Access refused" }), { status: 403 })} onCreate={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Issue number or URL"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Show Issue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access refused");
    expect(screen.queryByRole("button", { name: "Create Change From Issue" })).toBeNull();
  });
  it("does not reuse a preview returned after the workspace changed", async () => {
    let resolve!: (response: Response) => void;
    const apiFetch = vi.fn(() => new Promise<Response>((done) => { resolve = done; }));
    const props = { changeName: "from-issue", apiFetch, onCreate: vi.fn() };
    const { rerender } = render(<IssueChangeForm {...props} cwd="/repo" />);
    fireEvent.change(screen.getByLabelText("Issue number or URL"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Show Issue" }));
    rerender(<IssueChangeForm {...props} cwd="/other" />);
    resolve(new Response(JSON.stringify(preview)));
    await waitFor(() => expect(screen.getByRole("button", { name: "Show Issue" })).not.toBeDisabled());
    expect(screen.queryByText(preview.title)).toBeNull();
  });
});
