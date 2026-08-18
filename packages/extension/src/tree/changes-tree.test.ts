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

    expect(items).toHaveLength(4);
    expect(items[0]?.contextValue).toBe("openspec-ui.config");
    expect(items[1]?.contextValue).toBe("openspec-ui.repoBootstrapRoot");
    expect(items[2]?.label).toBe("execution-core");
    expect(items[2]?.description).toBe("implemented");
    expect(items[3]?.description).toBe("in-progress");
    // Explicit stable ids, not the VS Code label-derived fallback — see
    // openspec/changes/tree-item-stable-ids/proposal.md.
    expect(items.map((item) => item.id)).toEqual([
      "artifact:/workspace/repo/openspec/config.yaml",
      "repo-bootstrap-root",
      "change:active:execution-core",
      "change:active:shared-ui",
    ]);
  });

  it("expands the Repository Setup node to the three bootstrap actions, each with a stable id", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const bootstrapRoot = roots[1];
    const actions = await provider.getChildren(bootstrapRoot);

    expect(actions.map((item) => item.command?.command)).toEqual([
      "openspec-ui.generateAgentInstructions",
      "openspec-ui.configureDependabot",
      "openspec-ui.generateSubtypeInstructions",
    ]);
    expect(actions.every((item) => item.contextValue === "openspec-ui.repoBootstrapAction")).toBe(true);
    expect(actions.map((item) => item.id)).toEqual([
      "repo-bootstrap-action:openspec-ui.generateAgentInstructions",
      "repo-bootstrap-action:openspec-ui.configureDependabot",
      "repo-bootstrap-action:openspec-ui.generateSubtypeInstructions",
    ]);
    expect(new Set(actions.map((item) => item.id)).size).toBe(3);
    expect(actions[0]?.id).not.toBe(bootstrapRoot?.id);
  });

  it("shows standard, delta, and tasks artifacts under a change — tasks.md is collapsible, not a leaf", async () => {
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
          { id: "tasks", kind: "tasks", label: "Tasks", path: "/changes/shared-ui/tasks.md", exists: true },
          { id: "delta-spec:x", kind: "delta-spec", label: "x", path: "/changes/shared-ui/specs/x/spec.md", exists: true },
        ],
      }],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const change = roots[2];
    const artifacts = await provider.getChildren(change);

    // Individual tasks are NOT flattened in here alongside Proposal/Design/
    // Spec — this is the exact bug reported live twice: "tasks aren't
    // nested under Tasks, they're next to it." readTaskChecklist must not
    // even be called yet — task fetching is lazy, only on expanding Tasks.
    expect(artifacts.map((item) => item.label)).toEqual(["Proposal", "Design", "Tasks", "Spec: x"]);
    expect(readTaskChecklistMock).not.toHaveBeenCalled();
    expect(artifacts[1]?.description).toBe("missing");
    expect(artifacts[0]?.command?.command).toBe("vscode.open");
    expect(artifacts.map((item) => item.id)).toEqual([
      "artifact:/changes/shared-ui/proposal.md",
      "artifact:/changes/shared-ui/design.md",
      "artifact:/changes/shared-ui/tasks.md",
      "artifact:/changes/shared-ui/specs/x/spec.md",
    ]);
    // Every other artifact is a non-collapsible leaf; Tasks is the only
    // one with real children, so it's the only one collapsible.
    expect(artifacts[0]?.collapsibleState).toBe(0); // None
    expect(artifacts[1]?.collapsibleState).toBe(0); // None
    expect(artifacts[2]?.collapsibleState).toBe(1); // Collapsed
    expect(artifacts[2]?.contextValue).toBe("openspec-ui.tasksArtifact");
    expect(artifacts[3]?.collapsibleState).toBe(0); // None
  });

  it("a missing tasks.md is a non-collapsible leaf, same as any other missing artifact", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{
        name: "shared-ui",
        path: "/changes/shared-ui",
        state: "draft",
        artifacts: [
          { id: "tasks", kind: "tasks", label: "Tasks", path: "/changes/shared-ui/tasks.md", exists: false },
        ],
      }],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const artifacts = await provider.getChildren(roots[2]);

    expect(artifacts[0]?.collapsibleState).toBe(0); // None
    expect(artifacts[0]?.description).toBe("missing");
  });

  it("nests tasks.md's individual checklist items under the Tasks artifact, not under the Change directly", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{
        name: "shared-ui",
        path: "/changes/shared-ui",
        state: "in-progress",
        artifacts: [
          { id: "tasks", kind: "tasks", label: "Tasks", path: "/changes/shared-ui/tasks.md", exists: true },
        ],
      }],
    });
    readTaskChecklistMock.mockResolvedValue([
      { lineNumber: 2, text: "1.1 First task", done: true },
      { lineNumber: 3, text: "1.2 Second task", done: false },
    ]);

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const changeChildren = await provider.getChildren(roots[2]);
    const tasksArtifact = changeChildren[0];
    expect(tasksArtifact?.contextValue).toBe("openspec-ui.tasksArtifact");

    const children = await provider.getChildren(tasksArtifact);

    expect(readTaskChecklistMock).toHaveBeenCalledWith("/workspace/repo", "shared-ui", false);
    expect(children.map((item) => item.label)).toEqual(["1.1 First task", "1.2 Second task"]);
    expect(children[0]?.description).toBe("done");
    expect(children[1]?.description).toBeUndefined();
    expect(children[0]?.contextValue).toBe("openspec-ui.activeTaskDone");
    expect(children[1]?.contextValue).toBe("openspec-ui.activeTask");
    expect(children[0]?.command?.command).toBe("openspec-ui.revealTask");
    // Regression coverage: task ids must be distinct from both their
    // parent Tasks artifact's id and the Change's own id.
    expect(children.map((item) => item.id)).toEqual([
      "task:active:shared-ui:2",
      "task:active:shared-ui:3",
    ]);
    expect(children[0]?.id).not.toBe(tasksArtifact?.id);
    expect(children[0]?.id).not.toBe(roots[2]?.id);
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

    expect(items[2]?.label).toBe("Initialize OpenSpec");
    expect(items[2]?.command?.command).toBe("openspec-ui.initialize");
    expect(items[2]?.id).toBe("empty:Initialize OpenSpec");
  });

  it("refresh() fires onDidChangeTreeData", () => {
    const provider = new ChangesTreeProvider("/workspace/repo");
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });
});
