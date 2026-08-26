export interface ChangeTimelineTask {
  lineNumber: number;
  text: string;
  done: boolean;
  date: string | null;
}

export interface ChangeTimelineSpec {
  specId: string;
  content: string;
}

export interface ChangeTimeline {
  changeName: string;
  archived: boolean;
  createdDate: string | null;
  archivedDate: string | null;
  proposal: string;
  design: string;
  specs: ChangeTimelineSpec[];
  tasks: ChangeTimelineTask[];
}

export interface ChangeTimelineEntry {
  changeName: string;
  archived: boolean;
}

export type ChangeTimelineRequest = (pathname: string, init: RequestInit) => Promise<Response>;

async function responseError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${response.status} ${response.statusText}`;
}

export async function loadChangeTimeline(
  request: ChangeTimelineRequest,
  cwd: string,
  changeName: string,
  archived: boolean,
): Promise<ChangeTimeline> {
  const response = await request("/api/change-timeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, changeName, archived }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeTimeline>;
}

export async function loadChangeTimelines(
  request: ChangeTimelineRequest,
  cwd: string,
  entries: ChangeTimelineEntry[],
): Promise<ChangeTimeline[]> {
  const response = await request("/api/change-timelines", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cwd, entries }),
  });
  if (!response.ok) throw new Error(await responseError(response));
  return response.json() as Promise<ChangeTimeline[]>;
}
