import { afterEach, describe, expect, it, vi } from "vitest";

const listChangesMock = vi.fn();
const validateChangeMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listChanges: (...args: unknown[]) => listChangesMock(...args),
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const { runValidateAll } = await import("./openspec-validate.js");

function validateResult(failed: number, items = 3) {
  return {
    items: [],
    summary: { totals: { items, passed: items - failed, failed }, byType: {} },
    version: "1.0.0",
    root: { path: "/repo", source: "cli" },
  };
}

afterEach(() => {
  listChangesMock.mockReset();
  validateChangeMock.mockReset();
});

describe("runValidateAll", () => {
  it("reports ok:true when every active change passes strict validation", async () => {
    listChangesMock.mockResolvedValue({
      changes: [{ name: "a" }, { name: "b" }],
      root: { path: "/repo", source: "cli" },
    });
    validateChangeMock.mockResolvedValue(validateResult(0));

    const result = await runValidateAll("/repo");

    expect(result.ok).toBe(true);
    expect(result.results).toEqual([
      { id: "a", valid: true, failedItems: 0, totalItems: 3 },
      { id: "b", valid: true, failedItems: 0, totalItems: 3 },
    ]);
    expect(validateChangeMock).toHaveBeenCalledWith("a", { cwd: "/repo" });
    expect(validateChangeMock).toHaveBeenCalledWith("b", { cwd: "/repo" });
  });

  it("reports ok:false and keeps every result when one change fails validation", async () => {
    listChangesMock.mockResolvedValue({ changes: [{ name: "a" }, { name: "b" }], root: {} });
    validateChangeMock.mockImplementation(async (id: string) =>
      id === "a" ? validateResult(2) : validateResult(0),
    );

    const result = await runValidateAll("/repo");

    expect(result.ok).toBe(false);
    expect(result.results).toEqual([
      { id: "a", valid: false, failedItems: 2, totalItems: 3 },
      { id: "b", valid: true, failedItems: 0, totalItems: 3 },
    ]);
  });

  it("captures a single change's validateChange() rejection without aborting the run", async () => {
    listChangesMock.mockResolvedValue({ changes: [{ name: "broken" }, { name: "fine" }], root: {} });
    validateChangeMock.mockImplementation(async (id: string) => {
      if (id === "broken") throw new Error("openspec exited with code 1: corrupted change");
      return validateResult(0);
    });

    const result = await runValidateAll("/repo");

    expect(result.ok).toBe(false);
    expect(result.results).toEqual([
      { id: "broken", valid: false, failedItems: 0, totalItems: 0, error: "openspec exited with code 1: corrupted change" },
      { id: "fine", valid: true, failedItems: 0, totalItems: 3 },
    ]);
  });

  it("propagates a listChanges() rejection to the caller (no report can be produced)", async () => {
    listChangesMock.mockRejectedValue(new Error("openspec CLI not found"));

    await expect(runValidateAll("/repo")).rejects.toThrow("openspec CLI not found");
    expect(validateChangeMock).not.toHaveBeenCalled();
  });
});
