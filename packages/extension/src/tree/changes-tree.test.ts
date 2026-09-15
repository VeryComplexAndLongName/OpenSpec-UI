import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
const readTaskChecklistMock = vi.fn();
const applicableRepoSetupActionIdsMock = vi.fn((..._args: unknown[]) => [] as string[]);
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  readTaskChecklist: (...args: unknown[]) => readTaskChecklistMock(...args),
  applicableRepoSetupActionIds: (...args: unknown[]) => applicableRepoSetupActionIdsMock(...args),
}));

// Detection is the host's half and costs a process; the tree is given
// the facts rather than gathering them here.
const readRepoSetupFactsMock = vi.fn(async (..._args: unknown[]) => ({} as Record<string, unknown>));
vi.mock("../repo-setup-facts.js", () => ({
  readRepoSetupFacts: (...args: unknown[]) => readRepoSetupFactsMock(...args),
}));

const { ChangesTreeProvider, ChangeTreeItem } = await import("./changes-tree.js");
type ChangeTreeItem = InstanceType<typeof ChangeTreeItem>;

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

    expect(items).toHaveLength(5);
    expect(items[0]?.contextValue).toBe("openspec-ui.config");
    expect(items[1]?.contextValue).toBe("openspec-ui.repoBootstrapRoot");
    expect(items[2]?.contextValue).toBe("openspec-ui.harnessSettingsRoot");
    expect(items[3]?.label).toBe("execution-core");
    expect(items[3]?.description).toBe("implemented");
    expect(items[4]?.description).toBe("in-progress");
    // Explicit stable ids, not the VS Code label-derived fallback — see
    // openspec/changes/tree-item-stable-ids/proposal.md.
    expect(items.map((item) => item.id)).toEqual([
      "artifact:/workspace/repo/openspec/config.yaml",
      "repo-bootstrap-root",
      "harness-settings-root",
      "change:active:execution-core",
      "change:active:shared-ui",
    ]);
  });

  it("lists only what the rule says applies", async () => {
    // The whole point of setup-offers-only-what-applies: an action that
    // configures something absent writes a file nothing reads, and
    // worse, states that a thing is configured when nothing acts on it.
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [],
    });
    applicableRepoSetupActionIdsMock.mockReturnValue(["generate-agent-instructions"]);

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const actions = await provider.getChildren(roots[1]);

    expect(actions.map((item) => item.command?.command)).toEqual([
      "openspec-ui.generateAgentInstructions",
    ]);
  });

  it("decides from facts the host gathered, not from the tree's own guess", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [],
    });
    readRepoSetupFactsMock.mockResolvedValue({ originUrl: "https://gitlab.com/o/r" } as never);
    applicableRepoSetupActionIdsMock.mockReturnValue(["generate-agent-instructions"]);

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    await provider.getChildren(roots[1]);

    expect(applicableRepoSetupActionIdsMock).toHaveBeenCalledWith({ originUrl: "https://gitlab.com/o/r" });
  });

  it("expands the Repository Setup node to the actions that apply, each with a stable id", async () => {
    applicableRepoSetupActionIdsMock.mockReturnValue([
      "generate-agent-instructions",
      "configure-dependabot",
      "generate-subtype-instructions",
    ]);
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
    const change = roots[3];
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

  // a-change-lists-what-its-schema-declares 3.3: DW's report. A nested delta
  // spec is named by its path, and a schema that could not be read says so
  // above the spec-driven artifacts it fell back to.
  it("names a nested delta by its path, and puts a schema fallback row first under its own change", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{
        name: "dashboard",
        path: "/changes/dashboard",
        state: "draft",
        artifacts: [
          { id: "proposal", kind: "proposal", label: "Proposal", path: "/changes/dashboard/proposal.md", exists: true },
          {
            id: "delta-spec:web/dashboard-foundation",
            kind: "delta-spec",
            label: "web/dashboard-foundation",
            path: "/changes/dashboard/specs/web/dashboard-foundation/spec.md",
            exists: true,
          },
          { id: "adr", kind: "schema-artifact", label: "ADR", path: "/changes/dashboard/adr.md", exists: true },
        ],
        schema: {
          name: "nowhere-to-be-found",
          source: "built-in",
          artifacts: [],
          fallback: { reason: "not-found", detail: "schema \"nowhere-to-be-found\" is not in openspec/schemas" },
        },
      }],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const change = roots[3];
    const children = await provider.getChildren(change);

    expect(children.map((item) => item.label)).toEqual([
      "Schema: nowhere-to-be-found",
      "Proposal",
      "Spec: web/dashboard-foundation",
      "ADR",
    ]);
    expect(children[0]?.description).toContain("not found");
    expect(children[0]?.tooltip).toContain("nowhere-to-be-found");
    expect(children[0]?.id).toBe("schema-fallback:active:dashboard");
    expect(children[2]?.description).toBeUndefined();
    expect(provider.getParent(children[0]!)).toBe(change);
  });

  // an-artifact-label-says-what-it-is 2.2: a spec file archive will not apply
  // says so, and the delta spec beside it does not.
  it("marks a spec file archive will not apply, and leaves the delta spec beside it unmarked", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [{
        name: "landing",
        path: "/changes/landing",
        state: "draft",
        artifacts: [
          { id: "delta-spec:checkout", kind: "delta-spec", label: "checkout", path: "/changes/landing/specs/checkout/spec.md", exists: true },
          {
            id: "specs:specs/landing-page.md",
            kind: "schema-artifact",
            label: "Specs: landing-page.md",
            path: "/changes/landing/specs/landing-page.md",
            exists: true,
            notAppliedOnArchive: true,
          },
        ],
      }],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const children = await provider.getChildren(roots[3]);

    expect(children.map((item) => [item.label, item.description])).toEqual([
      ["Spec: checkout", undefined],
      ["Specs: landing-page.md", "not applied on archive"],
    ]);
    expect(children[0]?.tooltip).toBeUndefined();
    expect(children[1]?.tooltip).toContain("specs/<capability>/spec.md");
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
    const artifacts = await provider.getChildren(roots[3]);

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
    const changeChildren = await provider.getChildren(roots[3]);
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
    expect(children[0]?.id).not.toBe(roots[3]?.id);
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

    expect(items[3]?.label).toBe("Initialize OpenSpec");
    expect(items[3]?.command?.command).toBe("openspec-ui.initialize");
    expect(items[3]?.id).toBe("empty:Initialize OpenSpec");
  });

  it("Harness Settings root is a direct-command leaf, not a group", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      configPath: "/workspace/repo/openspec/config.yaml",
      configExists: true,
      changes: [],
    });

    const provider = new ChangesTreeProvider("/workspace/repo");
    const roots = await provider.getChildren();
    const harnessSettingsRoot = roots[2];

    expect(harnessSettingsRoot?.command?.command).toBe("openspec-ui.configureHarness");
    expect(harnessSettingsRoot?.collapsibleState).toBe(0); // None — not expandable
    expect(await provider.getChildren(harnessSettingsRoot)).toEqual([]);
  });

  it("refresh() fires onDidChangeTreeData", () => {
    const provider = new ChangesTreeProvider("/workspace/repo");
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);
    provider.refresh();
    expect(listener).toHaveBeenCalled();
  });

  describe("getParent", () => {
    it("resolves a change to undefined — it's a root row", async () => {
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        configPath: "/workspace/repo/openspec/config.yaml",
        configExists: true,
        changes: [{ name: "shared-ui", path: "/changes/shared-ui", state: "draft", artifacts: [] }],
      });
      const provider = new ChangesTreeProvider("/workspace/repo");
      const roots = await provider.getChildren();
      const change = roots[3];

      expect(provider.getParent(change!)).toBeUndefined();
    });

    it("resolves an artifact to its change, matched by id rather than object identity", async () => {
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        configPath: "/workspace/repo/openspec/config.yaml",
        configExists: true,
        changes: [{
          name: "shared-ui",
          path: "/changes/shared-ui",
          state: "draft",
          artifacts: [
            { id: "proposal", kind: "proposal", label: "Proposal", path: "/changes/shared-ui/proposal.md", exists: true },
            { id: "tasks", kind: "tasks", label: "Tasks", path: "/changes/shared-ui/tasks.md", exists: true },
          ],
        }],
      });
      const provider = new ChangesTreeProvider("/workspace/repo");
      const roots = await provider.getChildren();
      const change = roots[3];
      const [proposal, tasks] = await provider.getChildren(change);

      expect(provider.getParent(proposal!)?.id).toBe(change?.id);
      expect(provider.getParent(tasks!)?.id).toBe(change?.id);
    });

    it("gives the parent the state the tree drew, not a written-in one", async () => {
      // The reported symptom: a change with every task done read `draft`
      // after a window reload, because VS Code restores the selection
      // through this chain and draws what it returns. Asserting the id
      // alone passed while the state was wrong — the id is built from the
      // name and the archived flag, which the rebuilt row had right.
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        configPath: "/workspace/repo/openspec/config.yaml",
        configExists: true,
        changes: [{
          name: "all-done",
          path: "/changes/all-done",
          state: "implemented",
          artifacts: [
            { id: "proposal", kind: "proposal", label: "Proposal", path: "/changes/all-done/proposal.md", exists: true },
            { id: "tasks", kind: "tasks", label: "Tasks", path: "/changes/all-done/tasks.md", exists: true },
          ],
        }],
      });
      const provider = new ChangesTreeProvider("/workspace/repo");
      const change = (await provider.getChildren())[3] as ChangeTreeItem;
      const [proposal, tasks] = await provider.getChildren(change);

      for (const child of [proposal, tasks]) {
        const parent = provider.getParent(child!) as ChangeTreeItem;
        expect(parent.state).toBe("implemented");
        expect(parent.description).toBe("implemented");
      }
    });

    it("resolves a workspace-level artifact to no parent, rather than to an assembled row", async () => {
      discoverOpenSpecWorkspaceMock.mockResolvedValue({
        configPath: "/workspace/repo/openspec/config.yaml",
        configExists: true,
        changes: [],
      });
      const provider = new ChangesTreeProvider("/workspace/repo");
      const config = (await provider.getChildren())[0];

      expect(provider.getParent(config!)).toBeUndefined();
    });
  });
});
