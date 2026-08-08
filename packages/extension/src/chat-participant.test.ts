import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "./test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
let handler: ((...args: unknown[]) => unknown) | undefined;
const createChatParticipantMock = vi.fn((id: string, requestHandler: (...args: unknown[]) => unknown) => {
  handler = requestHandler;
  return { id, iconPath: undefined, dispose: vi.fn() };
});
vi.mock("vscode", () => ({
  ...vscodeMock,
  chat: { createChatParticipant: createChatParticipantMock },
  LanguageModelChatMessage: { User: (content: string) => ({ role: "user", content }) },
}));

const discoverOpenSpecWorkspaceMock = vi.fn();
const statusChangeMock = vi.fn();
const validateChangeMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  discoverOpenSpecWorkspace: (...args: unknown[]) => discoverOpenSpecWorkspaceMock(...args),
  statusChange: (...args: unknown[]) => statusChangeMock(...args),
  validateChange: (...args: unknown[]) => validateChangeMock(...args),
}));

const { registerOpenSpecChatParticipant } = await import("./chat-participant.js");

afterEach(() => {
  vi.clearAllMocks();
  handler = undefined;
});

function register() {
  const context = {
    extensionUri: vscodeMock.Uri.file("/extension"),
    subscriptions: [] as Array<{ dispose(): void }>,
  };
  return registerOpenSpecChatParticipant(
    context as unknown as import("vscode").ExtensionContext,
    { getWorkspaceRoot: () => "/workspace/repo" },
  );
}

function responseStream() {
  return { markdown: vi.fn(), button: vi.fn(), progress: vi.fn() };
}

function activeChange() {
  return {
    name: "demo",
    path: "/workspace/repo/openspec/changes/demo",
    state: "draft",
    archived: false,
    artifacts: [],
  };
}

describe("OpenSpec chat participant", () => {
  it("shows command help when no slash command is selected", async () => {
    register();
    const response = responseStream();

    await handler?.(
      { command: undefined, prompt: "", model: {} },
      {},
      response,
      { isCancellationRequested: false },
    );

    expect(response.markdown).toHaveBeenCalledWith(expect.stringContaining("/implement"));
  });

  it("routes implement through the managed Workbench command", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({ changes: [activeChange()] });
    register();
    const response = responseStream();

    await handler?.(
      { command: "implement", prompt: "demo", model: {} },
      {},
      response,
      { isCancellationRequested: false },
    );

    expect(vscodeMock.commands.executeCommand).toHaveBeenCalledWith(
      "openspec-ui.startImplementation",
      expect.objectContaining({ changeName: "demo" }),
    );
    expect(response.markdown).toHaveBeenCalledWith(expect.stringContaining("checkpointed"));
  });

  it("streams plan output from the model selected in VS Code Chat", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({ changes: [activeChange()] });
    const sendRequest = vi.fn(async () => ({
      text: (async function* () { yield "Step one"; yield "Step two"; })(),
    }));
    register();
    const response = responseStream();

    await handler?.(
      { command: "plan", prompt: "demo focus on tests", model: { sendRequest } },
      {},
      response,
      { isCancellationRequested: false },
    );

    expect(sendRequest).toHaveBeenCalled();
    expect(response.markdown.mock.calls.flat()).toEqual(["Step one", "Step two"]);
  });

  it("reports a model error without affecting deterministic commands", async () => {
    discoverOpenSpecWorkspaceMock.mockResolvedValue({ changes: [activeChange()] });
    register();
    const response = responseStream();

    await handler?.(
      { command: "review", prompt: "demo", model: { sendRequest: vi.fn().mockRejectedValue(new Error("No model available")) } },
      {},
      response,
      { isCancellationRequested: false },
    );

    expect(response.markdown).toHaveBeenCalledWith(expect.stringContaining("No model available"));
    expect(statusChangeMock).not.toHaveBeenCalled();
    expect(validateChangeMock).not.toHaveBeenCalled();
  });
});
