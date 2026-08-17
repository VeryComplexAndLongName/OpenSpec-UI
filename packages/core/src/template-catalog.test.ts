import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  TemplateAlreadyExistsError,
  UnknownBuiltInTemplateError,
  customizeTemplate,
  listBuiltInTemplates,
  listProjectTemplates,
  renderTemplate,
  type CatalogTemplate,
} from "./template-catalog.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-template-catalog-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("listBuiltInTemplates", () => {
  it("includes the seed template", () => {
    const templates = listBuiltInTemplates();
    const seed = templates.find((t) => t.manifest.id === "python-sqlalchemy-alembic");
    expect(seed).toBeDefined();
    expect(seed?.origin).toBe("built-in");
    expect(seed?.manifest.variables.length).toBeGreaterThan(0);
  });
});

describe("listProjectTemplates", () => {
  it("returns an empty list when openspec/templates does not exist", async () => {
    const root = await temporaryRoot();
    expect(await listProjectTemplates(root)).toEqual([]);
  });

  it("reads a real project-level template from disk", async () => {
    const root = await temporaryRoot();
    const dir = path.join(root, "openspec", "templates", "my-template");
    await mkdir(dir, { recursive: true });
    const manifest = {
      id: "my-template",
      title: "My Template",
      category: "custom",
      version: "1.0.0",
      summary: "A hand-written project-level template.",
      variables: [],
    };
    await Promise.all([
      writeFile(path.join(dir, "template.json"), JSON.stringify(manifest), "utf8"),
      writeFile(path.join(dir, "proposal.md"), "## Why\n", "utf8"),
      writeFile(path.join(dir, "design.md"), "## Context\n", "utf8"),
      writeFile(path.join(dir, "tasks.md"), "## 1. X\n", "utf8"),
    ]);

    const templates = await listProjectTemplates(root);
    expect(templates).toHaveLength(1);
    expect(templates[0]?.origin).toBe("project");
    expect(templates[0]?.manifest.title).toBe("My Template");
    expect(templates[0]?.artifacts.proposal).toBe("## Why\n");
  });

  it("skips a project template directory with invalid manifest JSON", async () => {
    const root = await temporaryRoot();
    const dir = path.join(root, "openspec", "templates", "broken");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "template.json"), "{not valid json", "utf8");

    expect(await listProjectTemplates(root)).toEqual([]);
  });
});

describe("customizeTemplate", () => {
  it("forks a built-in template with a backlink", async () => {
    const root = await temporaryRoot();

    const created = await customizeTemplate(root, "python-sqlalchemy-alembic");

    expect(created.origin).toBe("project");
    expect(created.manifest.forkedFrom).toEqual({ id: "python-sqlalchemy-alembic", version: "1.0.0" });

    const listed = await listProjectTemplates(root);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.manifest.forkedFrom).toEqual({ id: "python-sqlalchemy-alembic", version: "1.0.0" });
    expect(listed[0]?.artifacts.proposal).toBe(
      listBuiltInTemplates().find((t) => t.manifest.id === "python-sqlalchemy-alembic")?.artifacts.proposal,
    );
  });

  it("rejects customizing into an id that already exists", async () => {
    const root = await temporaryRoot();
    await customizeTemplate(root, "python-sqlalchemy-alembic");

    await expect(customizeTemplate(root, "python-sqlalchemy-alembic")).rejects.toThrow(TemplateAlreadyExistsError);
  });

  it("rejects an unknown built-in id", async () => {
    const root = await temporaryRoot();
    await expect(customizeTemplate(root, "does-not-exist")).rejects.toThrow(UnknownBuiltInTemplateError);
  });
});

describe("renderTemplate", () => {
  const template: CatalogTemplate = {
    manifest: {
      id: "t",
      title: "T",
      category: "c",
      version: "1.0.0",
      summary: "s",
      variables: [{ name: "packageName", prompt: "p" }],
    },
    artifacts: {
      proposal: "Package: {{packageName}}",
      design: "See {{packageName}}/db.py",
      tasks: "- [ ] Set up {{packageName}}",
    },
    origin: "built-in",
  };

  it("substitutes a supplied variable across all three artifacts", () => {
    const rendered = renderTemplate(template, { packageName: "myapp" });
    expect(rendered.proposal).toBe("Package: myapp");
    expect(rendered.design).toBe("See myapp/db.py");
    expect(rendered.tasks).toBe("- [ ] Set up myapp");
  });

  it("leaves the placeholder as-is when the variable is not supplied", () => {
    const rendered = renderTemplate(template, {});
    expect(rendered.proposal).toBe("Package: {{packageName}}");
  });
});
