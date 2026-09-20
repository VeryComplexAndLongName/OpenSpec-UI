import { afterEach, describe, expect, it, vi } from "vitest";
import type { SurveyedDirectory, WorktreeSurvey } from "@openspec-ui/core";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const discoverOpenSpecWorkspaceMock = vi.fn();
vi.mock("@openspec-ui/core", async () => ({
  ...(await vi.importActual<typeof import("@openspec-ui/core/browser")>("@openspec-ui/core/browser")),
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  surveyWorktrees: vi.fn(async () => { throw new Error("no repository"); }),
}));

const { ChangeElsewhereProvider, ELSEWHERE_SCHEME, elsewhereUri, registerChangeElsewhere } =
  await import("./change-elsewhere.js");

// changes-shows-one-change-and-who-owns-it 4.1-4.4 and 5.1-5.2.

afterEach(() => {
  vi.clearAllMocks();
});

function directory(partial: Partial<Extract<SurveyedDirectory, { readable: true }>>): SurveyedDirectory {
  return {
    path: "/wt/mine",
    label: "mine",
    labelDeclared: false,
    isMain: false,
    isThis: false,
    runs: [],
    readable: true,
    changes: [],
    authorDiffers: false,
    ...partial,
  };
}

const SURVEY: WorktreeSurvey = {
  directories: [
    directory({ isThis: true, branch: "mine", belongsTo: "mine" }),
    directory({ path: "/wt/theirs", label: "theirs", branch: "theirs", belongsTo: "theirs" }),
  ],
  runsElsewhere: [],
};

function context() {
  return { subscriptions: [] as unknown[] } as unknown as import("vscode").ExtensionContext;
}

describe("the URI another directory's copy is served on", () => {
  it("names the change, the artifact, the directory and that it is read-only", () => {
    const uri = elsewhereUri({
      changeName: "theirs",
      label: "their-worktree",
      filePath: "/wt/theirs/openspec/changes/theirs/tasks.md",
      artifact: "tasks.md",
    });

    expect(uri.scheme).toBe(ELSEWHERE_SCHEME);
    expect(uri.path).toBe("/theirs tasks (their-worktree, read-only).md");
    // The real path rides in the query, where only the provider reads it.
    expect(uri.query).toBe("/wt/theirs/openspec/changes/theirs/tasks.md");
  });
});

describe("what the provider serves", () => {
  it("serves that working directory's own copy, edits and all", async () => {
    const provider = new ChangeElsewhereProvider(async () => "## Why\n\ntheir uncommitted words\n");

    const text = await provider.provideTextDocumentContent(
      elsewhereUri({ changeName: "theirs", label: "theirs", filePath: "/wt/theirs/p.md", artifact: "proposal.md" }),
    );

    expect(text).toContain("their uncommitted words");
  });

  it("explains a file that is not there, rather than failing", async () => {
    const provider = new ChangeElsewhereProvider(async () => { throw new Error("ENOENT: no such file"); });

    const text = await provider.provideTextDocumentContent(
      elsewhereUri({ changeName: "theirs", label: "theirs", filePath: "/wt/theirs/design.md", artifact: "design.md" }),
    );

    expect(text).toContain("could not be read");
    expect(text).toContain("/wt/theirs/design.md");
    expect(text).toContain("ENOENT");
  });
});

describe("the picker", () => {
  it("puts this working directory's own change first, and says where each is worked", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [
        { name: "theirs", path: "/wt/mine/openspec/changes/theirs", state: "draft", artifacts: [] },
        { name: "mine", path: "/wt/mine/openspec/changes/mine", state: "draft", artifacts: [] },
      ],
    });
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);
    registerChangeElsewhere(context(), {
      getWorkspaceRoot: () => "/wt/mine",
      survey: async () => SURVEY,
    });

    await vscodeMock._registeredCommands.get("openspec-ui.pickChange")?.();

    const [entries] = vscodeMock.window.showQuickPick.mock.calls[0] as [Array<{ label: string; description: string }>];
    expect(entries.map((entry) => entry.label)).toEqual(["mine", "theirs"]);
    expect(entries[0]?.description).toBe("this working directory's own");
    expect(entries[1]?.description).toBe("worked in theirs");
  });

  it("lists a change worked in another directory that this checkout does not have", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({
      changes: [{ name: "mine", path: "/wt/mine/openspec/changes/mine", state: "draft", artifacts: [] }],
    });
    vscodeMock.window.showQuickPick.mockResolvedValue(undefined);
    registerChangeElsewhere(context(), {
      getWorkspaceRoot: () => "/wt/mine",
      survey: async () => SURVEY,
    });

    await vscodeMock._registeredCommands.get("openspec-ui.pickChange")?.();

    const [entries] = vscodeMock.window.showQuickPick.mock.calls[0] as [Array<{ label: string; description: string }>];
    expect(entries.map((entry) => entry.label)).toEqual(["mine", "theirs"]);
    expect(entries[1]?.description).toContain("not in this checkout");
  });
});

describe("opening a directory", () => {
  it("refuses to open one for a change worked here, and says so", async () => {
    registerChangeElsewhere(context(), {
      getWorkspaceRoot: () => "/wt/mine",
      survey: async () => SURVEY,
    });

    await vscodeMock._registeredCommands.get("openspec-ui.openChangeDirectory")?.({
      changeName: "mine",
      ownership: { kind: "here" },
    });

    expect(vscodeMock.commands.executeCommand).not.toHaveBeenCalledWith("vscode.openFolder", expect.anything(), expect.anything());
    expect(vscodeMock.window.showInformationMessage).toHaveBeenCalled();
  });

  it("opens the directory a change is worked in", async () => {
    registerChangeElsewhere(context(), {
      getWorkspaceRoot: () => "/wt/mine",
      survey: async () => SURVEY,
    });

    await vscodeMock._registeredCommands.get("openspec-ui.openChangeDirectory")?.({
      changeName: "theirs",
      ownership: { kind: "elsewhere", label: "theirs", path: "/wt/theirs" },
    });

    const opened = vscodeMock.commands.executeCommand.mock.calls.find((call: unknown[]) => call[0] === "vscode.openFolder");
    expect(String((opened?.[1] as { fsPath?: string; path?: string }).path ?? "")).toContain("/wt/theirs");
  });
});
