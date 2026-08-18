import { afterEach, describe, expect, it, vi } from "vitest";
import { createVscodeMock } from "../test-utils/vscode-mock.js";

const vscodeMock = createVscodeMock();
vi.mock("vscode", () => vscodeMock);

const listBuiltInTemplatesMock = vi.fn();
const listProjectTemplatesMock = vi.fn();
vi.mock("@openspec-ui/core", () => ({
  listBuiltInTemplates: (...args: unknown[]) => listBuiltInTemplatesMock(...args),
  listProjectTemplates: (...args: unknown[]) => listProjectTemplatesMock(...args),
}));

const { TemplatesTreeProvider } = await import("./templates-tree.js");

afterEach(() => {
  vi.clearAllMocks();
});

function template(id: string, category: string, extra: Partial<{ forkedFrom: { id: string; version: string } }> = {}) {
  return {
    manifest: { id, title: id, category, version: "1.0.0", summary: "s", variables: [], ...extra },
    artifacts: { proposal: "", design: "", tasks: "" },
    origin: "built-in" as const,
  };
}

describe("TemplatesTreeProvider", () => {
  it("groups built-in and project templates as top-level nodes", async () => {
    listBuiltInTemplatesMock.mockReturnValue([template("seed", "data-layer")]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const groups = await provider.getChildren();

    expect(groups.map((g) => g.label)).toEqual(["Built-in", "Project"]);
    expect(listProjectTemplatesMock).toHaveBeenCalledWith("/workspace/repo");
    expect(groups.map((g) => g.id)).toEqual(["template-group:Built-in", "template-group:Project"]);
  });

  it("groups templates within an origin by category, sorted alphabetically", async () => {
    listBuiltInTemplatesMock.mockReturnValue([
      template("z-tool", "testing"),
      template("a-tool", "auth"),
      template("b-tool", "auth"),
    ]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [builtInGroup] = await provider.getChildren();
    const categoryGroups = await provider.getChildren(builtInGroup);

    expect(categoryGroups.map((g) => g.label)).toEqual(["auth", "testing"]);
    expect(categoryGroups.map((g) => g.id)).toEqual([
      "template-category-group:Built-in:auth",
      "template-category-group:Built-in:testing",
    ]);
    expect(categoryGroups[0]?.description).toBe("2");
  });

  it("lists templates inside a category subgroup as leaf items with the right contextValue", async () => {
    listBuiltInTemplatesMock.mockReturnValue([template("seed", "data-layer")]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [builtInGroup] = await provider.getChildren();
    const [categoryGroup] = await provider.getChildren(builtInGroup);
    const items = await provider.getChildren(categoryGroup);

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("seed");
    expect(items[0]?.contextValue).toBe("openspec-ui.builtInTemplate");
    expect(items[0]?.id).toBe("template:built-in:seed");
    expect(items[0]?.id).not.toBe(categoryGroup?.id);
    expect(items[0]?.id).not.toBe(builtInGroup?.id);
  });

  it("marks project templates with a distinct contextValue", async () => {
    listBuiltInTemplatesMock.mockReturnValue([]);
    const projectTemplate = { ...template("seed", "data-layer"), origin: "project" as const };
    listProjectTemplatesMock.mockResolvedValue([projectTemplate]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [, projectGroup] = await provider.getChildren();
    const [categoryGroup] = await provider.getChildren(projectGroup);
    const items = await provider.getChildren(categoryGroup);

    expect(items[0]?.contextValue).toBe("openspec-ui.projectTemplate");
  });

  it("explains an empty origin group instead of showing nothing", async () => {
    listBuiltInTemplatesMock.mockReturnValue([]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [, projectGroup] = await provider.getChildren();
    const items = await provider.getChildren(projectGroup);

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("No templates");
  });
});
