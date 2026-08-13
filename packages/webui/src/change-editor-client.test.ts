import { describe, expect, it, vi } from "vitest";
import {
  ChangeEditorSaveConflictError,
  saveChangeEditorDocument,
  type ChangeEditorDocument,
} from "./change-editor-client.js";

const document: ChangeEditorDocument = {
  changeName: "safe-save",
  revision: "loaded-revision",
  files: { proposal: "p", design: "d", tasks: "t", spec: "s" },
};

describe("Change Editor client", () => {
  it("sends the loaded revision and returns the saved revision", async () => {
    const saved = { ...document, revision: "saved-revision" };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(saved), { status: 200 }));

    await expect(saveChangeEditorDocument(request, "/workspace", document)).resolves.toEqual(saved);
    const requestInit = request.mock.calls[0]?.[1];
    if (!requestInit) throw new Error("Change Editor save request was not captured");
    expect(JSON.parse(requestInit.body as string)).toEqual({
      cwd: "/workspace",
      changeName: "safe-save",
      files: document.files,
      revision: "loaded-revision",
    });
  });

  it("reports stale saves as a typed conflict", async () => {
    const request = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "files changed" }),
      { status: 409 },
    ));

    await expect(saveChangeEditorDocument(request, "/workspace", document))
      .rejects.toBeInstanceOf(ChangeEditorSaveConflictError);
  });
});