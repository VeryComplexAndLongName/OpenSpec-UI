import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listSpecsMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listSpecs: (...args: unknown[]) => listSpecsMock(...args),
}));

const { SpecsTreeProvider } = await import("./specs-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("SpecsTreeProvider", () => {
  it("lists specs with a requirement-count description and an open-spec.md command", async () => {
    listSpecsMock.mockResolvedValue({
      specs: [
        { id: "execution-core", requirementCount: 6 },
        { id: "shared-ui", requirementCount: 1 },
      ],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const provider = new SpecsTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(2);
    expect(items[0]?.description).toBe("6 requirements");
    expect(items[1]?.description).toBe("1 requirement");
    expect(items[0]?.command?.command).toBe("vscode.open");
    expect((items[0]?.command?.arguments?.[0] as { fsPath: string }).fsPath).toContain("execution-core");
  });

  // OpenSpec CLI 1.7.0 reports a capability kept in an area folder by its
  // path (a-change-lists-what-its-schema-declares 3.4; DW's layout).
  it("opens a nested capability's spec.md from the id the CLI reports", async () => {
    listSpecsMock.mockResolvedValue({
      specs: [{ id: "web/dashboard-foundation", requirementCount: 1 }],
      root: { path: "/workspace/repo", source: "nearest" },
    });

    const provider = new SpecsTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items[0]?.label).toBe("web/dashboard-foundation");
    const opened = (items[0]?.command?.arguments?.[0] as { fsPath: string }).fsPath.replace(/\\/g, "/");
    expect(opened).toMatch(/\/workspace\/repo\/openspec\/specs\/web\/dashboard-foundation\/spec\.md$/);
  });

  it("explains that canonical specs are produced by archive", async () => {
    listSpecsMock.mockResolvedValue({ specs: [], root: { path: "/workspace/repo", source: "nearest" } });

    const provider = new SpecsTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("No canonical specs");
    expect(items[0]?.description).toContain("archived");
  });
});
