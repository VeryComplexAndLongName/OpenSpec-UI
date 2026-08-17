import { describe, expect, it, vi } from "vitest";
import {
  TemplateAlreadyExistsError,
  customizeTemplate,
  deleteProjectTemplate,
  listTemplates,
  renderTemplate,
} from "./template-catalog-client.js";

describe("listTemplates", () => {
  it("posts cwd and returns builtIn/project lists", async () => {
    const payload = { builtIn: [{ manifest: { id: "seed" } }], project: [] };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(listTemplates(request, "/workspace")).resolves.toEqual(payload);
    expect(request.mock.calls[0]?.[0]).toBe("/api/templates/list");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({ cwd: "/workspace" });
  });
});

describe("customizeTemplate", () => {
  it("posts cwd and id, returns the created project template", async () => {
    const created = { manifest: { id: "seed", forkedFrom: { id: "seed", version: "1.0.0" } } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(created), { status: 200 }));

    await expect(customizeTemplate(request, "/workspace", "seed")).resolves.toEqual(created);
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({ cwd: "/workspace", id: "seed" });
  });

  it("throws TemplateAlreadyExistsError on 409", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "already exists" }), { status: 409 }),
    );

    await expect(customizeTemplate(request, "/workspace", "seed")).rejects.toBeInstanceOf(TemplateAlreadyExistsError);
  });
});

describe("deleteProjectTemplate", () => {
  it("posts cwd and id and resolves on success", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await expect(deleteProjectTemplate(request, "/workspace", "my-template")).resolves.toBeUndefined();
    expect(request.mock.calls[0]?.[0]).toBe("/api/templates/delete");
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      id: "my-template",
    });
  });

  it("throws with the server-provided error message on 404", async () => {
    const request = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Unknown project-level template: my-template" }), { status: 404 }),
    );

    await expect(deleteProjectTemplate(request, "/workspace", "my-template")).rejects.toThrow(
      "Unknown project-level template: my-template",
    );
  });
});

describe("renderTemplate", () => {
  it("posts cwd/origin/id/variables and returns rendered artifacts", async () => {
    const rendered = { proposal: "p", design: "d", tasks: "t" };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(rendered), { status: 200 }));

    await expect(
      renderTemplate(request, "/workspace", "built-in", "seed", { packageName: "myapp" }),
    ).resolves.toEqual(rendered);
    expect(JSON.parse((request.mock.calls[0]?.[1] as RequestInit).body as string)).toEqual({
      cwd: "/workspace",
      origin: "built-in",
      id: "seed",
      variables: { packageName: "myapp" },
    });
  });
});
