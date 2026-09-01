import { useEffect, useState } from "react";

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

export function ProcessesView({ api, changeProgress }: { api: ProcessesApi; changeProgress?: Record<string, ChangeProgress> }) {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [details, setDetails] = useState<ProcessDetails | null>(null);
  const [retentionDays, setRetentionDays] = useState(30);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProcesses(await api.list());
    } catch (error) {
      setMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [api]);

  async function inspect(processId: string) {
    setLoading(true);
    try {
      setDetails(await api.details(processId));
      setMessage(null);
    } catch (error) {
      setMessage(`Details failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function rollback() {
    if (!details) return;
    setLoading(true);
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
      setLoading(false);
    }
  }

  async function cleanup() {
    setLoading(true);
    try {
      const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
      const result = await api.cleanup(cutoff);
      setDetails(null);
      await load();
      setMessage(`Removed ${result.removed} processes; ${result.retained} retained.`);
    } catch (error) {
      setMessage(`Cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-testid="processes-view">
      <div className="openspec-ai-panel-controls">
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Loading..." : "Refresh"}</button>
        <label className="openspec-shell-field">
          Retain days
          <input type="number" min={1} value={retentionDays} onChange={(event) => setRetentionDays(Math.max(1, Number(event.target.value) || 1))} />
        </label>
        <button type="button" onClick={() => void cleanup()} disabled={loading}>Clean old history</button>
      </div>
      {message ? <p className="openspec-shell-note" role="status">{message}</p> : null}
      {processes.length === 0 ? <p className="openspec-shell-note">No persisted processes.</p> : (
        <table className="openspec-overview-table">
          <thead><tr><th>Operation</th><th>Change</th><th>Agent</th><th>Progress</th><th>State</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>{processes.map((process) => (
            <tr key={process.id}>
              <td>{process.operation}</td><td>{process.changeName ?? "-"}</td>
              <td>{process.agentId ?? "-"}</td>
              <td>{formatPercent(process.changeName ? changeProgress?.[process.changeName] : undefined)}</td>
              <td>{[process.state, formatCostUsd(process.usage?.costUsd)].filter(Boolean).join(" · ")}</td><td>{process.createdAt}</td>
              <td><button type="button" onClick={() => void inspect(process.id)}>Review</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {details ? (
        <div className="openspec-process-details">
          <h3>{details.process.operation}: {details.process.state}</h3>
          <p>{details.process.summary ?? details.process.error ?? "No summary"}</p>
          <h4>Changed files</h4>
          <ul>{(details.delta ?? []).map((item) => <li key={item.path}>{item.kind}: {item.path}</li>)}</ul>
          <h4>Checkpoint coverage</h4>
          <p>Skipped files: {details.coverage?.skippedFiles.join(", ") || "none"}</p>
          <p>Excluded directories: {details.coverage?.excludedDirectories.join(", ") || "none"}</p>
          <div className="openspec-ai-panel-controls">
            <button type="button" onClick={() => void rollback()} disabled={loading || !details.canRollback}>Rollback files</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
