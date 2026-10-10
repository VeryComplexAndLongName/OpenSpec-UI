import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

// Each test makes and removes a temporary directory; the eight took 45 ms
// together on 2026-10-09, and a loaded machine is given room.
vi.setConfig({ testTimeout: 10_000 });

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const applicableRepoSetupActionIdsMock = vi.fn((..._args: unknown[]) => [] as string[]);
vi.mock("@openspec-ui/core", async () => ({
  ...(await vi.importActual<typeof import("@openspec-ui/core")>("@openspec-ui/core")),
  applicableRepoSetupActionIds: (...args: unknown[]) => applicableRepoSetupActionIdsMock(...args),
}));

// Detection is the host's half and costs a process; the tree is given
// the facts rather than gathering them here.
const readRepoSetupFactsMock = vi.fn(async (..._args: unknown[]) => ({} as Record<string, unknown>));
vi.mock("../repo-setup-facts.js", () => ({
  readRepoSetupFacts: (...args: unknown[]) => readRepoSetupFactsMock(...args),
}));

const { WorkspaceTreeProvider, AgentsRootTreeItem, describeAgent, stagesByAgent } = await import("./workspace-tree.js");
const { RepoBootstrapRootTreeItem } = await import("./changes-tree.js");

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "workspace-tree-"));
});

afterEach(async () => {
  vi.clearAllMocks();
  await rm(root, { recursive: true, force: true });
});

function provider(detectAgents = vi.fn(async () => ({})), readHarness = vi.fn(async () => undefined)) {
  return new WorkspaceTreeProvider(root, { detectAgents, readHarness });
}

describe("WorkspaceTreeProvider", () => {
  it("lists what is about the workspace: the Pipeline, the Dashboard, its harness, agents, configuration and setup", async () => {
    await mkdir(path.join(root, "openspec"));
    await writeFile(path.join(root, "openspec", "config.yaml"), "schema: spec-driven\n");

    const rows = await provider().getChildren();

    expect(rows.map((row) => row.id)).toEqual([
      "workspace-command:openspec-ui.openPipeline",
      "workspace-command:openspec-ui.openDashboard",
      "harness-settings-root",
      "workspace-agents",
      `artifact:${path.join(root, "openspec", "config.yaml")}`,
      "repo-bootstrap-root",
    ]);
    expect(rows[0]?.command?.command).toBe("openspec-ui.openPipeline");
    expect(rows[4]?.description).toBeUndefined();
  });

  it("says the configuration is missing where it is", async () => {
    const rows = await provider().getChildren();

    expect(rows[4]?.description).toBe("missing");
  });

  it("opens the workspace harness with one press, a row with nothing beneath", async () => {
    const tree = provider();
    const harness = (await tree.getChildren())[2];

    expect(harness?.label).toBe("Workspace Harness");
    expect(harness?.command?.command).toBe("openspec-ui.configureWorkspaceHarness");
    expect(harness?.collapsibleState).toBe(0);
    expect(await tree.getChildren(harness)).toEqual([]);
  });

  it("offers a row for each check the workspace declares, and none for the rest", async () => {
    const tree = provider();
    tree.setChecks({ typecheck: "typecheck", lint: "osui-lint" });

    const commands = (await tree.getChildren()).map((row) => row.command?.command);

    expect(commands).toContain("openspec-ui.runTypecheck");
    expect(commands).toContain("openspec-ui.runLint");
    expect(commands).not.toContain("openspec-ui.runTests");
  });

  it("lists every agent with whether it is here, its version and the stages the harness gives it", async () => {
    const detect = vi.fn(async () => ({ "claude-cli": { detected: true, version: "2.1.0" }, "codex-cli": { detected: false } }));
    const harness = vi.fn(async () => ({ stepAgents: { apply: "claude-cli", verify: { agent: "claude-cli", model: "opus" } } }) as never);
    const tree = provider(detect, harness);

    const agents = await tree.getChildren(new AgentsRootTreeItem());

    const claude = agents.find((row) => row.id === "workspace-agent:claude-cli");
    const codex = agents.find((row) => row.id === "workspace-agent:codex-cli");
    expect(claude?.description).toBe("found 2.1.0 - apply, verify");
    expect(claude?.contextValue).toBe("openspec-ui.agent");
    expect(codex?.description).toBe("not found");
    expect(codex?.contextValue).toBe("openspec-ui.agent.missing");
  });

  it("detects the agents once until Refresh Views, since each detection starts their CLIs", async () => {
    const detect = vi.fn(async () => ({}));
    const tree = provider(detect);

    await tree.getChildren(new AgentsRootTreeItem());
    await tree.getChildren(new AgentsRootTreeItem());
    expect(detect).toHaveBeenCalledOnce();

    tree.refresh();
    await tree.getChildren(new AgentsRootTreeItem());
    expect(detect).toHaveBeenCalledTimes(2);
  });

  it("expands Repository Setup to the actions that apply, from facts the host gathered", async () => {
    readRepoSetupFactsMock.mockResolvedValue({ originUrl: "https://gitlab.com/o/r" } as never);
    applicableRepoSetupActionIdsMock.mockReturnValue(["generate-agent-instructions", "configure-dependabot"]);

    const actions = await provider().getChildren(new RepoBootstrapRootTreeItem());

    expect(applicableRepoSetupActionIdsMock).toHaveBeenCalledWith({ originUrl: "https://gitlab.com/o/r" });
    expect(actions.map((row) => row.id)).toEqual([
      "repo-bootstrap-action:openspec-ui.generateInstructions",
      "repo-bootstrap-action:openspec-ui.configureDependabot",
    ]);
  });
});

describe("describeAgent and stagesByAgent", () => {
  it("says found without a version where none was read, and no stages where the harness gives none", () => {
    expect(describeAgent({ detected: true }, [])).toBe("found");
    expect(stagesByAgent(undefined).size).toBe(0);
  });
});
