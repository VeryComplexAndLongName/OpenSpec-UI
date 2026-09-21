import { useEffect, useRef, useState } from "react";
import type { RunLogRecord, RunLogStream, RunLogSummary } from "@openspec-ui/core/browser";

// A change's run logs, opened from its card (a-change-shows-its-run-logs):
// every run that kept a log, newest first, and the one chosen as the run
// said it. The host reads; this only draws, so the standalone and the
// editor's panel show the same thing.

export interface RunLogsViewProps {
  changeName: string;
  load: () => Promise<RunLogSummary[]>;
  read: (runId: string) => Promise<RunLogRecord[]>;
  onClose: () => void;
}

const OUTCOME_WORD: Record<string, string> = {
  completed: "completed",
  failed: "failed",
  cancelled: "stopped",
  blocked: "refused",
};

function when(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : date.toLocaleString();
}

function duration(from: string, to: string | undefined): string {
  if (to === undefined) return "";
  const seconds = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  if (!Number.isFinite(seconds)) return "";
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

/** The records as parts a person reads: each stage's start as a heading,
 * the pieces of one stream run together into one block, and how the part
 * ended. A stream arrives in chunks cut wherever the pipe cut them. */
export function runLogBlocks(records: readonly RunLogRecord[]): Array<
  | { kind: "part"; text: string }
  | { kind: "text"; stream: RunLogStream; text: string }
  | { kind: "end"; outcome: string; text: string }
> {
  const blocks: ReturnType<typeof runLogBlocks> = [];
  for (const record of records) {
    if (record.type === "start") {
      blocks.push({ kind: "part", text: `${record.stage ?? record.kind} by ${record.agent}, started ${when(record.at)}${record.taskNumber ? `, task ${record.taskNumber}` : ""}` });
    } else if (record.type === "line") {
      const last = blocks.at(-1);
      const streamed = record.stream === "stdout" || record.stream === "stderr" || record.stream === "reply" || record.stream === "reasoning";
      if (streamed && last?.kind === "text" && last.stream === record.stream) {
        last.text += record.text;
      } else {
        blocks.push({ kind: "text", stream: record.stream, text: streamed ? record.text : `[${record.stream}] ${record.text}` });
      }
    } else {
      const said = [record.reason, record.summary].filter((part): part is string => part !== undefined && part.length > 0).join(": ");
      blocks.push({ kind: "end", outcome: record.outcome, text: `${OUTCOME_WORD[record.outcome] ?? record.outcome} at ${when(record.at)}${said ? ` - ${said}` : ""}` });
    }
  }
  return blocks;
}

export function RunLogsView({ changeName, load, read, onClose }: RunLogsViewProps) {
  const [runs, setRuns] = useState<RunLogSummary[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [records, setRecords] = useState<RunLogRecord[] | null>(null);
  const [readFailed, setReadFailed] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  // Opened beneath a picture that can be taller than the window: brought
  // into view, so the press is seen to have done something.
  useEffect(() => {
    panel.current?.scrollIntoView?.({ block: "nearest" });
  }, [changeName]);

  useEffect(() => {
    let current = true;
    setRuns(null);
    setFailed(null);
    setChosen(null);
    setRecords(null);
    load().then(
      (listed) => {
        if (!current) return;
        setRuns(listed);
        if (listed[0] !== undefined) setChosen(listed[0].runId);
      },
      (error: unknown) => { if (current) setFailed(error instanceof Error ? error.message : String(error)); },
    );
    return () => { current = false; };
  }, [changeName, load]);

  useEffect(() => {
    if (chosen === null) return;
    let current = true;
    setRecords(null);
    setReadFailed(null);
    read(chosen).then(
      (read) => { if (current) setRecords(read); },
      (error: unknown) => { if (current) setReadFailed(error instanceof Error ? error.message : String(error)); },
    );
    return () => { current = false; };
  }, [chosen, read]);

  return (
    <section ref={panel} className="openspec-run-logs" role="dialog" aria-label={`Logs of ${changeName}`} data-testid="run-logs">
      <div className="openspec-run-logs-head">
        <h3>Logs of {changeName}</h3>
        <button type="button" className="button" data-testid="run-logs-close" onClick={onClose}>Close</button>
      </div>
      {failed !== null ? <p className="openspec-shell-note" data-testid="run-logs-failed">The logs could not be read: {failed}</p> : null}
      {runs === null && failed === null ? <p className="openspec-shell-note">Reading the logs...</p> : null}
      {runs !== null && runs.length === 0
        ? (
          <p className="openspec-shell-note" data-testid="run-logs-none">
            No run of this change has left a log. Runs keep their logs from this version on.
          </p>
        )
        : null}
      {runs !== null && runs.length > 0
        ? (
          <table className="openspec-run-logs-list" data-testid="run-logs-list">
            <thead>
              <tr><th>Started</th><th>What</th><th>Agent</th><th>Ended</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.runId} aria-selected={run.runId === chosen} data-testid={`run-logs-run-${run.runId}`}>
                  <td>
                    <button type="button" className="button" aria-label={`Show the log of the run started ${when(run.startedAt)}`} onClick={() => setChosen(run.runId)}>
                      {when(run.startedAt)}
                    </button>
                  </td>
                  <td>{run.stages.length > 1 ? `${run.kind}: ${run.stages.join(", ")}` : run.stages[0] ?? run.kind}</td>
                  <td>{run.agent}</td>
                  <td>
                    {run.outcome === undefined
                      ? "running, or never said"
                      : `${OUTCOME_WORD[run.outcome] ?? run.outcome}${duration(run.startedAt, run.endedAt) ? ` after ${duration(run.startedAt, run.endedAt)}` : ""}`}
                    {run.reason ? ` - ${run.reason}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
        : null}
      {readFailed !== null ? <p className="openspec-shell-note">This log could not be read: {readFailed}</p> : null}
      {chosen !== null && records !== null
        ? (
          <div className="openspec-run-log" data-testid="run-log" tabIndex={0} aria-label="The run's log">
            {runLogBlocks(records).map((block, index) => block.kind === "part"
              ? <p key={index} className="openspec-run-log-part">{block.text}</p>
              : block.kind === "end"
                ? <p key={index} className={`openspec-run-log-end openspec-run-log-end--${block.outcome}`}>{block.text}</p>
                : <p key={index} className={`openspec-run-log-line openspec-run-log-line--${block.stream}`}>{block.text}</p>)}
          </div>
        )
        : null}
    </section>
  );
}
