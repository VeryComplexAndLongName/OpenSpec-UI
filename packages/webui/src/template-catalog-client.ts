import type { CatalogTemplate, TemplateArtifacts } from "@openspec-ui/core/browser";
import type { ChangeEditorRequest } from "./change-editor-client.js";

export class TemplateAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateAlreadyExistsError";
  }
}

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

export async function listTemplates(
  request: ChangeEditorRequest,
  cwd: string,
): Promise<{ builtIn: CatalogTemplate[]; project: CatalogTemplate[] }> {
  const response = await request("/api/templates/list", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<{ builtIn: CatalogTemplate[]; project: CatalogTemplate[] }>;
}

export async function customizeTemplate(
  request: ChangeEditorRequest,
  cwd: string,
  id: string,
): Promise<CatalogTemplate> {
  const response = await request("/api/templates/customize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, id }),
  });
  if (response.status === 409) throw new TemplateAlreadyExistsError(await responseError(response));
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<CatalogTemplate>;
}

export async function renderTemplate(
  request: ChangeEditorRequest,
  cwd: string,
  origin: "built-in" | "project",
  id: string,
  variables: Record<string, string | boolean>,
): Promise<TemplateArtifacts> {
  const response = await request("/api/templates/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, origin, id, variables }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<TemplateArtifacts>;
}
