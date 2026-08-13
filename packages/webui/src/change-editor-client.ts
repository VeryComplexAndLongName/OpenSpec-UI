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