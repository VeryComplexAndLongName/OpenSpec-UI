// How each change's last run ended — the facts a card reads.
//
// Pure and free of Node built-ins on purpose: the browser bundle carries
// these shapes to the Pipeline view, which draws them and computes
// nothing (a-card-says-what-its-change-is-doing).

/** The latest run of one change that has ended. */
export interface LastRun {
  runId: string;
  outcome: "completed" | "failed" | "cancelled";
  /** The stage it ended at, where the log names one. */
  stage?: string;
  /** When it ended, as the log recorded it. */
  endedAt: string;
  /** Why it ended, where the ending gave a reason. */
  reason?: string;
  /** The sum of what the run's entries reported spending; absent when none
   * reported a cost, which is not the same as costing nothing. */
  costUsd?: number;
}

/** Each change's last ended run, keyed by the change's directory name. */
export interface LastRunsReport {
  byChange: Record<string, LastRun>;
}
