import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "./server.js";
const preview = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
vi.mock("@openspec-ui/core", async (actual) => ({ ...await actual<typeof import("@openspec-ui/core")>(), previewIssueChange: preview, createChangeFromIssue: create }));
afterEach(() => { vi.clearAllMocks(); });

describe("issue preview/create HTTP contract", () => {
  it("preserves preview revision through create, protects cwd/token and rejects malformed input", async () => {
    const server = createServer({ workspaceRoot: process.cwd(), host: "127.0.0.1", port: 0, runners: new Map(), accessToken: "issue-fixture" });
    const source = { title: "Request", revision: "a".repeat(64), sourceUrl: "https://github.com/team/repo/issues/12" };
    preview.mockResolvedValue(source); create.mockResolvedValue({ directory: process.cwd() });
    try {
      const address = await server.listen();
      const post = (route: string, body: unknown, token = "issue-fixture") => fetch(`http://127.0.0.1:${address.port}/api/change-editor/${route}`, {
        method: "POST", headers: { "content-type": "application/json", "x-openspec-ui-token": token }, body: JSON.stringify(body),
      });
      const cwd = process.cwd();
      const response = await post("issue-preview", { cwd, reference: "12" });
      expect(response.status).toBe(200); expect(await response.json()).toEqual(source);
      expect(preview).toHaveBeenCalledWith({ repositoryRoot: cwd, reference: "12" });
      expect(create).not.toHaveBeenCalled();
      expect((await post("issue-preview", { cwd, reference: "12" }, "wrong")).status).toBe(401);
      expect((await post("issue-preview", { cwd: "Z:/outside-workspace", reference: "12" })).status).toBe(403);
      expect((await post("create", { cwd, changeName: "from-issue", issue: { reference: "12", revision: "bad" } })).status).toBe(400);
      expect(create).not.toHaveBeenCalled();
      const result = await post("create", { cwd, changeName: "from-issue", issue: { reference: "12", revision: source.revision } });
      expect(result.status).toBe(200);
      expect(create).toHaveBeenCalledWith({ repositoryRoot: cwd, changeName: "from-issue", reference: "12", revision: source.revision });
      create.mockRejectedValueOnce(new Error("The issue changed. Preview it again."));
      const refused = await post("create", { cwd, changeName: "from-issue", issue: { reference: "12", revision: source.revision } });
      expect(refused.status).toBe(500); expect(await refused.text()).toContain("Preview it again");
    } finally { await server.close(); }
  }, 15000);
});
