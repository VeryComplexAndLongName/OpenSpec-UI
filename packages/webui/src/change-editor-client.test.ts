import { describe, expect, it, vi } from "vitest";
import {
  ChangeEditorSaveConflictError,
  loadArchivedTasksTemplate,
  mergeTasksTemplate,
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

describe("loadArchivedTasksTemplate", () => {
  it("posts cwd and changeName and returns the template markdown", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ template: "- [ ] task\n" }), { status: 200 }),
    );

    await expect(loadArchivedTasksTemplate(request, "/workspace", "old-change")).resolves.toBe("- [ ] task\n");
    const requestInit = request.mock.calls[0]?.[1];
    if (!requestInit) throw new Error("archive-tasks-template request was not captured");
    expect(request.mock.calls[0]?.[0]).toBe("/api/change-editor/archive-tasks-template");
    expect(JSON.parse(requestInit.body as string)).toEqual({ cwd: "/workspace", changeName: "old-change" });
  });

  it("throws with the server-provided error message on failure", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Archived change not found: old-change" }), { status: 404 }),
    );

    await expect(loadArchivedTasksTemplate(request, "/workspace", "old-change"))
      .rejects.toThrow("Archived change not found: old-change");
  });
});

describe("mergeTasksTemplate", () => {
  it("appends the template below existing non-empty tasks content", () => {
    expect(mergeTasksTemplate("## 1. Existing\n\n- [ ] a\n", "## 1. From archive\n\n- [ ] b\n"))
      .toBe("## 1. Existing\n\n- [ ] a\n\n## 1. From archive\n\n- [ ] b\n");
  });

  it("returns the template as-is when the target tasks content is empty", () => {
    expect(mergeTasksTemplate("", "## 1. From archive\n\n- [ ] b\n")).toBe("## 1. From archive\n\n- [ ] b\n");
    expect(mergeTasksTemplate("   \n", "## 1. From archive\n\n- [ ] b\n")).toBe("## 1. From archive\n\n- [ ] b\n");
  });
});