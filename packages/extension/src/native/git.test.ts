import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const { getGitExtensionExports } = await import("./git.js");

afterEach(() => {
  vi.clearAllMocks();
});

describe("getGitExtensionExports", () => {
  it("returns undefined when the built-in git extension is not installed", async () => {
    vscodeMock.extensions.getExtension.mockReturnValue(undefined);
    expect(await getGitExtensionExports()).toBeUndefined();
  });

  it("returns exports directly when the extension is already active", async () => {
    const exports = { getAPI: vi.fn(), toGitUri: vi.fn() };
    vscodeMock.extensions.getExtension.mockReturnValue({ isActive: true, exports });
    expect(await getGitExtensionExports()).toBe(exports);
  });

  it("activates the extension first when it is not yet active", async () => {
    const exports = { getAPI: vi.fn(), toGitUri: vi.fn() };
    vscodeMock.extensions.getExtension.mockReturnValue({
      isActive: false,
      exports: undefined,
      activate: vi.fn().mockResolvedValue(exports),
    });
    expect(await getGitExtensionExports()).toBe(exports);
  });
});
