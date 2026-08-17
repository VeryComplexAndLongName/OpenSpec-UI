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

const seedTemplate = {
  manifest: { id: "seed", title: "Seed", category: "c", version: "1.0.0", summary: "s", variables: [] },
  artifacts: { proposal: "", design: "", tasks: "" },
  origin: "built-in" as const,
};

describe("TemplatesTreeProvider", () => {
  it("groups built-in and project templates as top-level nodes", async () => {
    listBuiltInTemplatesMock.mockReturnValue([seedTemplate]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const groups = await provider.getChildren();

    expect(groups.map((g) => g.label)).toEqual(["Built-in", "Project"]);
    expect(listProjectTemplatesMock).toHaveBeenCalledWith("/workspace/repo");
  });

  it("lists templates inside a group as leaf items with the right contextValue", async () => {
    listBuiltInTemplatesMock.mockReturnValue([seedTemplate]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [builtInGroup] = await provider.getChildren();
    const items = await provider.getChildren(builtInGroup);

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("Seed");
    expect(items[0]?.contextValue).toBe("openspec-ui.builtInTemplate");
  });

  it("marks project templates with a distinct contextValue", async () => {
    listBuiltInTemplatesMock.mockReturnValue([]);
    const projectTemplate = { ...seedTemplate, origin: "project" as const };
    listProjectTemplatesMock.mockResolvedValue([projectTemplate]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [, projectGroup] = await provider.getChildren();
    const items = await provider.getChildren(projectGroup);

    expect(items[0]?.contextValue).toBe("openspec-ui.projectTemplate");
  });

  it("explains an empty group instead of showing nothing", async () => {
    listBuiltInTemplatesMock.mockReturnValue([]);
    listProjectTemplatesMock.mockResolvedValue([]);

    const provider = new TemplatesTreeProvider("/workspace/repo");
    const [, projectGroup] = await provider.getChildren();
    const items = await provider.getChildren(projectGroup);

    expect(items).toHaveLength(1);
    expect(items[0]?.label).toBe("No templates");
  });
});
