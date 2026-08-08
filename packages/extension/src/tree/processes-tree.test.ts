import { describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { ProcessTreeItem } = await import("./processes-tree.js");

function process(operation: string, state: "queued" | "running" | "completed" | "failed" | "cancelled") {
  return {
    id: `${operation}-${state}`,
    operation,
    state,
    mutating: true,
    createdAt: "2026-08-08T00:00:00.000Z",
  } as import("@openspec-ui/core").WorkbenchProcess;
}

describe("ProcessTreeItem", () => {
  it("offers finish only for active implementation sessions", () => {
    expect(new ProcessTreeItem(process("implement", "running")).contextValue).toBe("openspec-ui.implementationProcess");
    expect(new ProcessTreeItem(process("archive", "running")).contextValue).toBe("openspec-ui.cancellableProcess");
  });

  it("offers rollback only for completed implementation sessions", () => {
    expect(new ProcessTreeItem(process("implement", "completed")).contextValue).toBe("openspec-ui.rollbackableProcess");
    expect(new ProcessTreeItem(process("implement", "failed")).contextValue).toBe("openspec-ui.finishedProcess");
    expect(new ProcessTreeItem(process("validate", "completed")).contextValue).toBe("openspec-ui.finishedProcess");
  });
});
