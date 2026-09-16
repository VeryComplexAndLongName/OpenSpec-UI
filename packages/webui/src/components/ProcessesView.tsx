import { useEffect, useState } from "react";
import { Icon } from "./Icon.js";

export interface ProcessSummary {
  id: string;
  operation: string;
  changeName?: string;
  /** Which Agentic Harness agent ran this process, when known — see
   * openspec/changes/agentic-harness/. Absent for processes not tied to
   * a specific agent. */
  agentId?: string;
  state: string;
  createdAt: string;
  summary?: string;
  error?: string;
  /** What a `"suspended"` process is waiting for — mirrors
   * `WorkbenchProcess.waitingFor` in `@openspec-ui/core`. Absent for any
   * process that has never suspended. */
  waitingFor?: string;
  /** This process's recorded cost, when its audit entry carried usage —
   * see `WorkbenchProcess.usage` in `@openspec-ui/core`. Absent — not
   * zero — for a process whose run reported no usage. */
  usage?: { costUsd?: number };
}

/** `undefined` — never `"$0.00"` — when the process carries no usage: an
 * absent cost means unmeasured, not free (mirrors the extension's
 * `processes-tree.ts`'s `formatCostUsd`). */
function formatCostUsd(costUsd: number | undefined): string | undefined {
  return costUsd === undefined ? undefined : `$${costUsd.toFixed(2)}`;
}

/** Percent-complete is derived from the associated change's real
 * `tasks.md` checkbox state (`completedTasks`/`totalTasks`), never from
 * a process's own free-text progress message — see design.md, "Percent-
 * complete source". */
export interface ChangeProgress {
  completedTasks: number;
  totalTasks: number;
}

function formatPercent(progress: ChangeProgress | undefined): string {
  if (!progress || progress.totalTasks === 0) return "-";
  return `${Math.round((progress.completedTasks / progress.totalTasks) * 100)}%`;
}

export interface ProcessDetails {
  process: ProcessSummary;
  delta?: Array<{ path: string; kind: string }>;
  coverage?: { excludedDirectories: string[]; skippedFiles: string[] };
  canRollback: boolean;
}

export interface ProcessesApi {
  list(): Promise<ProcessSummary[]>;
  details(processId: string): Promise<ProcessDetails>;
  rollback(processId: string): Promise<{ restored: string[]; conflicts: string[] }>;
  cleanup(cutoff: string): Promise<{ removed: number; retained: number }>;
}

export function ProcessesView({
  api,
  changeProgress,
  onReadingChange,
}: {
  api: ProcessesApi;
  changeProgress?: Record<string, ChangeProgress>;
  /** What this view is reading or doing, or `null` once it has settled, for
   * the shell's status line and tab spinner (a-screen-says-what-it-is-doing). */
  onReadingChange?: (reading: string | null) => void;
}) {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [details, setDetails] = useState<ProcessDetails | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [message, setMessage] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const loading = reading !== null;

  useEffect(() => { onReadingChange?.(reading); }, [reading, onReadingChange]);

  async function load() {
    setReading("Reading persisted runs…");
    try {
      setProcesses(await api.list());
    } catch (error) {
      setMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setReading(null);
    }
  }

  useEffect(() => { void load(); }, [api]);

  async function inspect(processId: string) {
    setReading("Reading the run's details…");
    try {
      setDetails(await api.details(processId));
      setMessage(null);
    } catch (error) {
      setMessage(`Details failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setReading(null);
    }
  }

  async function rollback() {
    if (!details) return;
    setReading("Rolling the run's files back…");
    try {
      const result = await api.rollback(details.process.id);
      setMessage(result.conflicts.length > 0
        ? `Rollback blocked by conflicts: ${result.conflicts.join(", ")}`
        : `Rollback restored ${result.restored.length} files.`);
      await load();
      setDetails(await api.details(details.process.id));
    } catch (error) {
      setMessage(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setReading(null);
    }
  }

  async function cleanup() {
    setReading("Removing old history…");
    try {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
      const result = await api.cleanup(cutoff);
      setDetails(null);
      await load();
      setMessage(`Removed ${result.removed} processes; ${result.retained} retained.`);
    } catch (error) {
      setMessage(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setReading(null);
    }
  }

  return (
    <div data-testid="processes-view">
      <div className="openspec-ai-panel-controls">
        {/* One label in every state. It read "Loading..." during any reading,
            a Review included, and the change of width moved every control
            after it: the jerk the owner reported. What is being read is
            said by the shell's status line (a-screen-says-what-it-is-doing). */}
        <button className="button" type="button" onClick={() => void load()} disabled={loading}>
          <Icon meaning="refresh" />Refresh
        </button>
        <label className="openspec-shell-field">
          Retain days
          <input type="number" min={1} value={retentionDays} onChange={(event) => setRetentionDays(Math.max(1, Number(event.target.value) || 1))} />
        </label>
        {/* The destructive pair take `warning`, not `stop`: stopping is what
            a run does, and these delete history that cannot come back
            (the-web-ui-screens-wear-metro 4.1). */}
        <button className="button alert" type="button" onClick={() => void cleanup()} disabled={loading}>
          <Icon meaning="warning" />Clean old history
        </button>
      </div>
      {message ? <p className="openspec-shell-note" role="status" data-testid="processes-message">{message}</p> : null}
      {processes.length === 0 ? <p className="openspec-shell-note">No persisted processes.</p> : (
        <table className="table openspec-overview-table">
          <thead><tr><th>Operation</th><th>Change</th><th>Agent</th><th>Progress</th><th>State</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>{processes.map((process) => (
            <tr key={process.id}>
              <td>{process.operation}</td><td>{process.changeName ?? "-"}</td>
              <td>{process.agentId ?? "-"}</td>
              <td>{formatPercent(process.changeName ? changeProgress?.[process.changeName] : undefined)}</td>
              <td>{[process.state, process.waitingFor, formatCostUsd(process.usage?.costUsd)].filter(Boolean).join(" · ")}</td><td>{process.createdAt}</td>
              <td>
                <button className="button" type="button" onClick={() => void inspect(process.id)}>
                  <Icon meaning="review" />Review
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {details ? (
        <div className="openspec-process-details">
          <h3>{details.process.operation}: {details.process.state}</h3>
          <p>{details.process.waitingFor ? `Waiting for: ${details.process.waitingFor}` : details.process.summary ?? details.process.error ?? "No summary"}</p>
          <h4>Changed files</h4>
          <ul>{(details.delta ?? []).map((item) => <li key={item.path}>{item.kind}: {item.path}</li>)}</ul>
          <h4>Checkpoint coverage</h4>
          <p>Skipped files: {details.coverage?.skippedFiles.join(", ") || "none"}</p>
          <p>Excluded directories: {details.coverage?.excludedDirectories.join(", ") || "none"}</p>
          <div className="openspec-ai-panel-controls">
            <button className="button alert" type="button" onClick={() => void rollback()} disabled={loading || !details.canRollback}>
              <Icon meaning="warning" />Rollback files
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
