import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BUILT_IN_TEMPLATES } from "./templates/index.js";

// See openspec/changes/template-catalog/design.md. Built-in templates are
// TypeScript modules (packages/core/src/templates/*.ts), not files on
// disk — this is what makes them work identically whether run from source
// (server, unbundled) or from the packaged VS Code .vsix (esbuild-bundled,
// no access to core's original file tree). Project-level templates are
// real files under `openspec/templates/<id>/` in the target workspace,
// mirroring `openspec/changes/<id>/` exactly.

export interface TemplateVariable {
  name: string;
  prompt: string;
  type?: "string" | "boolean";
  default?: string | boolean;
}

export interface TemplateManifest {
  id: string;
  title: string;
  category: string;
  version: string;
  summary: string;
  variables: TemplateVariable[];
  /** Only present on a project-level template created via
   * `customizeTemplate` — provenance, not a live sync link (see
   * design.md's Non-Goals). */
  forkedFrom?: { id: string; version: string };
}

export interface TemplateArtifacts {
  proposal: string;
  design: string;
  tasks: string;
}

export interface CatalogTemplate {
  manifest: TemplateManifest;
  artifacts: TemplateArtifacts;
  origin: "built-in" | "project";
}

export class TemplateAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Project-level template already exists: ${id}`);
    this.name = "TemplateAlreadyExistsError";
  }
}

export class UnknownBuiltInTemplateError extends Error {
  constructor(id: string) {
    super(`Unknown built-in template: ${id}`);
    this.name = "UnknownBuiltInTemplateError";
  }
}

const TEMPLATE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function assertValidTemplateId(id: string): void {
  if (!TEMPLATE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid template id: ${id}`);
  }
}

function templatesRoot(workspaceRoot: string): string {
  return path.join(path.resolve(workspaceRoot), "openspec", "templates");
}

function templateDir(workspaceRoot: string, id: string): string {
  assertValidTemplateId(id);
  return path.join(templatesRoot(workspaceRoot), id);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export function listBuiltInTemplates(): CatalogTemplate[] {
  return BUILT_IN_TEMPLATES.map((template) => ({ ...template, origin: "built-in" as const }));
}

export function findBuiltInTemplate(id: string): CatalogTemplate | undefined {
  return listBuiltInTemplates().find((template) => template.manifest.id === id);
}

async function readProjectTemplate(workspaceRoot: string, id: string): Promise<CatalogTemplate | undefined> {
  const dir = templateDir(workspaceRoot, id);
  const manifestPath = path.join(dir, "template.json");
  if (!(await pathExists(manifestPath))) return undefined;

  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as TemplateManifest;
    const [proposal, design, tasks] = await Promise.all([
      readFile(path.join(dir, "proposal.md"), "utf8").catch(() => ""),
      readFile(path.join(dir, "design.md"), "utf8").catch(() => ""),
      readFile(path.join(dir, "tasks.md"), "utf8").catch(() => ""),
    ]);
    return { manifest, artifacts: { proposal, design, tasks }, origin: "project" };
  } catch {
    // Invalid manifest JSON — skip this entry rather than failing the
    // whole listing (see spec.md, "Project-level templates live in the
    // user's repository").
    return undefined;
  }
}

export async function listProjectTemplates(workspaceRoot: string): Promise<CatalogTemplate[]> {
  let entries: string[];
  try {
    entries = (await readdir(templatesRoot(workspaceRoot), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }

  const templates = await Promise.all(
    entries.map((id) => readProjectTemplate(workspaceRoot, id).catch(() => undefined)),
  );
  return templates.filter((template): template is CatalogTemplate => template !== undefined);
}

export async function customizeTemplate(workspaceRoot: string, builtInId: string): Promise<CatalogTemplate> {
  const source = findBuiltInTemplate(builtInId);
  if (!source) throw new UnknownBuiltInTemplateError(builtInId);

  const dir = templateDir(workspaceRoot, builtInId);
  if (await pathExists(dir)) throw new TemplateAlreadyExistsError(builtInId);

  const manifest: TemplateManifest = {
    ...source.manifest,
    forkedFrom: { id: source.manifest.id, version: source.manifest.version },
  };

  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(path.join(dir, "template.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    writeFile(path.join(dir, "proposal.md"), source.artifacts.proposal, "utf8"),
    writeFile(path.join(dir, "design.md"), source.artifacts.design, "utf8"),
    writeFile(path.join(dir, "tasks.md"), source.artifacts.tasks, "utf8"),
  ]);

  return { manifest, artifacts: source.artifacts, origin: "project" };
}

/** Substitutes `{{name}}` for each declared variable that has a supplied
 * value; a declared-but-unsupplied variable's placeholder is left as-is
 * (see spec.md — an empty substitution would look identical to
 * intentionally-empty content). Writes nothing to disk. */
export function renderTemplate(
  template: CatalogTemplate,
  variables: Record<string, string | boolean>,
): TemplateArtifacts {
  function substitute(content: string): string {
    let result = content;
    for (const variable of template.manifest.variables) {
      if (!(variable.name in variables)) continue;
      result = result.replaceAll(`{{${variable.name}}}`, String(variables[variable.name]));
    }
    return result;
  }

  return {
    proposal: substitute(template.artifacts.proposal),
    design: substitute(template.artifacts.design),
    tasks: substitute(template.artifacts.tasks),
  };
}
