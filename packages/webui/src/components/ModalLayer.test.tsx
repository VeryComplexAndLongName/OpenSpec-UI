import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ModalLayer } from "./ModalLayer.js";

// what-waits-for-a-person-is-a-dialog (ADR 0047).

function Opener({ onCancel }: { onCancel: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Behind</button>
      {open ? (
        <ModalLayer onCancel={() => { onCancel(); setOpen(false); }}>
          <form role="dialog" aria-modal="true" aria-label="Delete Change demo">
            <button type="button">First</button>
            <button type="button">Last</button>
          </form>
        </ModalLayer>
      ) : null}
    </>
  );
}

describe("ModalLayer", () => {
  it("takes the focus into the dialog, keeps it there, and gives it back when the dialog closes", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Delete Change demo" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const first = screen.getByRole("button", { name: "First" });
    const last = screen.getByRole("button", { name: "Last" });
    expect(document.activeElement).toBe(first);

    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    fireEvent.keyDown(last, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("stands a backdrop between the dialog and the view, and a click on it closes nothing", () => {
    const onCancel = vi.fn();
    render(<Opener onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const backdrop = screen.getByTestId("modal-layer").querySelector(".openspec-modal-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
