export interface ChangeEditorFiles {
  proposal: string;
  design: string;
  tasks: string;
  spec: string;
}

export interface ChangeEditorDocument {
  changeName: string;
  files: ChangeEditorFiles;
  revision: string;
}

export type ChangeEditorRequest = (pathname: string, init: RequestInit) => Promise<Response>;

export class ChangeEditorSaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChangeEditorSaveConflictError";
  }
}

async function responseError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({})) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

export async function loadChangeEditorDocument(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
): Promise<ChangeEditorDocument> {
  const response = await request("/api/change-editor/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeEditorDocument>;
}

/** Appends a fetched tasks template below the currently loaded tasks
 * content, for the user to review before saving. See the "Non-Goals" in
 * openspec/changes/archive-tasks-as-template/design.md — deliberately no
 * renumbering/merging of `## N.` groups, just verbatim appending. */
export function mergeTasksTemplate(existingTasks: string, template: string): string {
  return existingTasks.trim().length > 0 ? `${existingTasks}\n${template}` : template;
}

/** Reads an archived change's `tasks.md` as a checkbox-reset template (see
 * openspec/changes/archive-tasks-as-template/design.md). Does not write
 * anything — the caller merges the returned markdown into its own editor
 * state and saves through the normal conflict-checked save flow. */
export async function loadArchivedTasksTemplate(
  request: ChangeEditorRequest,
  cwd: string,
  changeName: string,
): Promise<string> {
  const response = await request("/api/change-editor/archive-tasks-template", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as { template: string };
  return payload.template;
}

export async function saveChangeEditorDocument(
  request: ChangeEditorRequest,
  cwd: string,
  document: ChangeEditorDocument,
): Promise<ChangeEditorDocument> {
  const response = await request("/api/change-editor/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      cwd,
      changeName: document.changeName,
      files: document.files,
      revision: document.revision,
    }),
  });
  if (response.status === 409) throw new ChangeEditorSaveConflictError(await responseError(response));
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeEditorDocument>;
}