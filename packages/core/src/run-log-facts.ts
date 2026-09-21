// What a run's log holds, as types a browser can import: the records of
// `.openspec-ui/runs/<runId>.jsonl` and the summary a list shows
// (a-change-shows-its-run-logs). Kept apart from run-log.ts, which reads
// and writes files.

export type RunLogStream =
  | "stdout"
  | "stderr"
  | "reply"
  | "reasoning"
  | "tool"
  | "progress"
  | "stage"
  | "permission"
  | "stop"
  | "note";

export interface RunLogStart {
  type: "start";
  runId: string;
  at: string;
  agent: string;
  kind: string;
  cwd: string;
  changeName?: string;
  stage?: string;
  taskNumber?: string;
}

export interface RunLogLine {
  type: "line";
  at: string;
  stream: RunLogStream;
  text: string;
}

export type RunLogOutcome = "completed" | "failed" | "cancelled" | "blocked";

export interface RunLogEnd {
  type: "end";
  at: string;
  outcome: RunLogOutcome;
  reason?: string;
  summary?: string;
}

export type RunLogRecord = RunLogStart | RunLogLine | RunLogEnd;

export interface RunLogSummary {
  runId: string;
  agent: string;
  kind: string;
  changeName?: string;
  /** Each stage's start, in order; one for a run that is not a chain. */
  stages: string[];
  startedAt: string;
  /** Absent while the run goes on, or where it never wrote its end. */
  endedAt?: string;
  outcome?: RunLogOutcome;
  reason?: string;
  bytes: number;
}
