import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LeftoverList } from "./LeftoverList.js";
import type { WorkspaceLeftoverReading } from "../change-leftovers-client.js";

const EMPTY: WorkspaceLeftoverReading = { cleared: [], kept: [], failures: [], finishedWith: [] };

describe("LeftoverList", () => {
  it("says what went, since it went without being asked", () => {
    render(<LeftoverList reading={{
      ...EMPTY,
      cleared: [{ name: "left-behind", path: "/repo/openspec/changes/left-behind", files: ["harness.json"], archivedAs: "2026-09-10-left-behind" }],
    }} />);

    expect(screen.getByTestId("leftovers-cleared").textContent).toContain("Cleared 1 directory");
    expect(screen.getByTestId("leftovers-cleared").textContent).toContain("held harness.json");
    expect(screen.getByTestId("leftovers-cleared").textContent).toContain("its change is archived");
  });

  it("says what it will not clear, with what that holds, and offers the press", () => {
    const onRemove = vi.fn();
    render(<LeftoverList
      reading={{
        ...EMPTY,
        kept: [{ name: "my-idea", path: "/repo/openspec/changes/my-idea", files: ["notes.txt"] }],
      }}
      onRemove={onRemove}
    />);

    expect(screen.getByTestId("leftovers-kept").textContent).toContain("no change of this name is archived");
    fireEvent.click(screen.getByTestId("remove-leftover-my-idea"));
    expect(onRemove).toHaveBeenCalledWith({ name: "my-idea" });
  });

  it("names a working directory with nothing left to do, with its branch and the reason", () => {
    const onRemove = vi.fn();
    render(<LeftoverList
      reading={{
        ...EMPTY,
        finishedWith: [{ path: "C:/wt/change-b", label: "change-b", branch: "change-b", reason: "merged" }],
      }}
      onRemove={onRemove}
    />);

    const text = screen.getByTestId("leftovers-working-directories").textContent ?? "";
    expect(text).toContain("change-b");
    expect(text).toContain("its branch is merged");
    expect(text).toContain("its tree is clean");
    fireEvent.click(screen.getByTestId("remove-directory-change-b"));
    expect(onRemove).toHaveBeenCalledWith({ path: "C:/wt/change-b" });
  });

  it("draws nothing where the workspace was left holding nothing", () => {
    const { container } = render(<LeftoverList reading={EMPTY} />);

    expect(container.firstChild).toBeNull();
  });

  it("says why the reading could not be taken", () => {
    render(<LeftoverList reading={undefined} error="EPERM: operation not permitted" />);

    expect(screen.getByTestId("leftovers-error").textContent).toContain("EPERM");
  });

  it("names a directory the sweep could not remove", () => {
    render(<LeftoverList reading={{
      ...EMPTY,
      failures: [{ name: "left-behind", path: "/repo/openspec/changes/left-behind", reason: "EBUSY" }],
    }} />);

    expect(screen.getByTestId("leftovers-failures").textContent).toContain("EBUSY");
  });
});
