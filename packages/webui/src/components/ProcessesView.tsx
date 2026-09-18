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
    <div className="openspec-processes-screen" data-testid="processes-view">
      {/* The shared components (the-remaining-tabs-wear-metro): the tab's
          controls in one toolbar, the runs in a panel that says how many,
          and the one being reviewed in a panel of its own. */}
      <div className="openspec-controls">
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
        {message ? <span className="openspec-shell-note" role="status" data-testid="processes-message">{message}</span> : null}
      </div>

      <section className="openspec-panel">
        <div className="openspec-panel-head">
          <h2>Persisted runs</h2>
          {processes.length > 0 ? (
            <span className="openspec-panel-head-note">{processes.length === 1 ? "1 run" : `${processes.length} runs`}</span>
          ) : null}
        </div>
        {processes.length === 0 ? <p className="openspec-panel-body openspec-panel-empty">No persisted processes.</p> : (
          <table className="table openspec-table">
            <thead><tr><th>Operation</th><th>Change</th><th>Agent</th><th>Progress</th><th>State</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>{processes.map((process) => (
              <tr key={process.id}>
                <td>{process.operation}</td><td>{process.changeName ?? "-"}</td>
                <td>{process.agentId ?? "-"}</td>
                <td>{formatPercent(process.changeName ? changeProgress?.[process.changeName] : undefined)}</td>
                <td>
                  {/* The state as a badge, as every other list of rows
                      carries one; what waits and what it cost stay beside
                      it as words. */}
                  <span className="badge openspec-process-state">{process.state}</span>
                  {[process.waitingFor, formatCostUsd(process.usage?.costUsd)].filter(Boolean).length > 0 ? (
                    <span className="openspec-process-state-note">
                      {[process.waitingFor, formatCostUsd(process.usage?.costUsd)].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </td><td>{process.createdAt}</td>
                <td>
                  <button className="button" type="button" onClick={() => void inspect(process.id)}>
                    <Icon meaning="review" />Review
                  </button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      {details ? (
        <section className="openspec-panel openspec-process-details">
          <div className="openspec-panel-head">
            <h2>{details.process.operation}</h2>
            <span className="openspec-panel-head-note">
              <span className="badge openspec-process-state">{details.process.state}</span>
            </span>
          </div>
          <div className="openspec-panel-body">
            <p>{details.process.waitingFor ? `Waiting for: ${details.process.waitingFor}` : details.process.summary ?? details.process.error ?? "No summary"}</p>
          </div>
          {(details.delta ?? []).length > 0 ? (
            <table className="table openspec-table">
              <thead><tr><th scope="col">Changed file</th><th scope="col">How</th></tr></thead>
              <tbody>{(details.delta ?? []).map((item) => (
                <tr key={item.path}><td>{item.path}</td><td>{item.kind}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="openspec-panel-body openspec-panel-empty">No file was changed.</p>}
          <p className="openspec-panel-fine">
            {`Checkpoint coverage. Skipped files: ${details.coverage?.skippedFiles.join(", ") || "none"}. `}
            {`Excluded directories: ${details.coverage?.excludedDirectories.join(", ") || "none"}.`}
          </p>
          <div className="openspec-panel-foot">
            <button className="button alert" type="button" onClick={() => void rollback()} disabled={loading || !details.canRollback}>
              <Icon meaning="warning" />Rollback files
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
