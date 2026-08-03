import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock, Uri } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const getGitExtensionExportsMock = vi.fn();
vi.mock("./git.js", () => ({ getGitExtensionExports: () => getGitExtensionExportsMock() }));

const { openDiffAgainstHead } = await import("./diff.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("openDiffAgainstHead", () => {
  it("opens vscode.diff between the HEAD git URI and the working file when git is available", async () => {
    const headUri = Uri.file("/workspace/repo/.git-head-virtual/tasks.md");
    const toGitUri = vi.fn().mockReturnValue(headUri);
    getGitExtensionExportsMock.mockResolvedValue({ getAPI: vi.fn(), toGitUri });

    const fileUri = Uri.file("/workspace/repo/openspec/changes/x/tasks.md") as unknown as import("vscode").Uri;
    await openDiffAgainstHead(fileUri, "x: tasks.md");

    expect(toGitUri).toHaveBeenCalledWith(fileUri, "HEAD");
    expect(vscodeMock.commands.executeCommand).toHaveBeenCalledWith("vscode.diff", headUri, fileUri, "x: tasks.md");
  });

  it("falls back to opening the file directly when the git extension is unavailable", async () => {
    getGitExtensionExportsMock.mockResolvedValue(undefined);

    const fileUri = Uri.file("/workspace/repo/openspec/changes/x/tasks.md") as unknown as import("vscode").Uri;
    await openDiffAgainstHead(fileUri, "x: tasks.md");

    expect(vscodeMock.commands.executeCommand).toHaveBeenCalledWith("vscode.open", fileUri);
  });
});
