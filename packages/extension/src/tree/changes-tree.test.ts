import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
const readTaskChecklistMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  readTaskChecklist: (...args: unknown[]) => readTaskChecklistMock(...args),
}));

const { ChangesTreeProvider } = await import("./changes-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  readTaskChecklistMock.mockResolvedValue([]);
});

describe("ChangesTreeProvider", () => {
  it("lists config and collapsible changes with their derived state", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [
        { name: "execution-core", path: "/changes/execution-core", state: "implemented", artifacts: [] },
        { name: "shared-ui", path: "/changes/shared-ui", state: "in-progress", artifacts: [] },
      ],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items).toHaveLength(3);
    expect(items[0]?.contextValue).toBe("openspec-ui.config");
    expect(items[1]?.label).toBe("execution-core");
    expect(items[1]?.description).toBe("implemented");
    expect(items[2]?.description).toBe("in-progress");
    // Explicit stable ids, not the VS Code label-derived fallback — see
    // openspec/changes/tree-item-stable-ids/proposal.md.
    expect(items.map((item) => item.id)).toEqual([
      "artifact:/workspace/repo/openspec/config.yaml",
      "change:active:execution-core",
      "change:active:shared-ui",
    ]);
  });

  it("shows standard and delta artifacts under a change", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{
        name: "shared-ui",
        path: "/changes/shared-ui",
        state: "draft",
        artifacts: [
          { id: "proposal", kind: "proposal", label: "Proposal", path: "/changes/shared-ui/proposal.md", exists: true },
          { id: "design", kind: "design", label: "Design", path: "/changes/shared-ui/design.md", exists: false },
          { id: "delta-spec:x", kind: "delta-spec", label: "x", path: "/changes/shared-ui/specs/x/spec.md", exists: true },
        ],
      }],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const change = roots[1];
    const artifacts = await provider.getChildren(change);

    expect(artifacts.map((item) => item.label)).toEqual(["Proposal", "Design", "Spec: x"]);
    expect(artifacts[1]?.description).toBe("missing");
    expect(artifacts[0]?.command?.command).toBe("vscode.open");
    expect(artifacts.map((item) => item.id)).toEqual([
      "artifact:/changes/shared-ui/proposal.md",
      "artifact:/changes/shared-ui/design.md",
      "artifact:/changes/shared-ui/specs/x/spec.md",
    ]);
  });

  it("shows tasks.md's individual checklist items after the artifacts, as active tasks", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{ name: "shared-ui", path: "/changes/shared-ui", state: "in-progress", artifacts: [] }],
    });
    readTaskChecklistMock.mockResolvedValue([
      { lineNumber: 2, text: "1.1 First task", done: true },
      { lineNumber: 3, text: "1.2 Second task", done: false },
    ]);

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const children = await provider.getChildren(roots[1]);

    expect(readTaskChecklistMock).toHaveBeenCalledWith("/workspace/repo", "shared-ui", false);
    expect(children.map((item) => item.label)).toEqual(["1.1 First task", "1.2 Second task"]);
    expect(children[0]?.description).toBe("done");
    expect(children[1]?.description).toBeUndefined();
    expect(children[0]?.contextValue).toBe("openspec-ui.activeTaskDone");
    expect(children[1]?.contextValue).toBe("openspec-ui.activeTask");
    expect(children[0]?.command?.command).toBe("openspec-ui.revealTask");
    // Regression coverage: task ids must be distinct from their parent
    // Change's own id (and from each other) — without this, VS Code's
    // label-derived id fallback could desync the tree, reported live as
    // tasks rendering flush with the Change instead of nested under it.
    expect(children.map((item) => item.id)).toEqual([
      "task:active:shared-ui:2",
      "task:active:shared-ui:3",
    ]);
    expect(children[0]?.id).not.toBe(roots[1]?.id);
  });

  it("offers initialization when the workspace has no OpenSpec artifacts", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      initialized: false,
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: false,
      changes: [],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const items = await provider.getChildren();

    expect(items[1]?.label).toBe("Initialize OpenSpec");
    expect(items[1]?.command?.command).toBe("openspec-ui.initialize");
    expect(items[1]?.id).toBe("empty:Initialize OpenSpec");
  });

  it("refresh() fires onDidChangeTreeData", () => {
    const provider = new ChangesTreeProvider("/workspace/repo");
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });
});
