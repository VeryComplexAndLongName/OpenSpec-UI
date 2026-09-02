// A generic, lock-free poller for a stage that must wait on some external
// system — see openspec/changes/harness-suspendable-stage/design.md,
// "Polling lives in exactly one module, and holds nothing". This module
// owns no process and no lock; it only watches a caller-supplied `check`
// on an interval and reports when it changes. What is actually watched
// (a GitHub PR's status, say) arrives with the first consumer — nothing
// here is specific to any external system.

export interface ExternalWaiterOptions {
  /** Called on every poll tick. Returns (or resolves to) `true` once the
   * awaited condition has occurred. */
  check: () => Promise<boolean> | boolean;
  intervalMs: number;
  maxDurationMs: number;
  /** Stops polling immediately when it fires, rejecting the wait. */
  signal?: AbortSignal;
}

export class ExternalWaiterTimeoutError extends Error {
  constructor(maxDurationMs: number) {
    super(`External wait exceeded its maximum duration of ${maxDurationMs}ms`);
    this.name = "ExternalWaiterTimeoutError";
  }
}

export class ExternalWaiterAbortedError extends Error {
  constructor() {
    super("External wait was aborted");
    this.name = "ExternalWaiterAbortedError";
  }
}

/** Resolves once `check` reports a change; rejects on `maxDurationMs` or on
 * `signal` aborting. Stops polling — no further calls to `check` — the
 * moment any of those three happens, so a wait that is no longer needed
 * never outlives its consumer. */
export function waitForExternalSignal(options: ExternalWaiterOptions): Promise<void> {
  const { check, intervalMs, maxDurationMs, signal } = options;

  return new Promise<void>((resolve, reject) => {
    // Handled before anything is scheduled, and without going through
    // `settleReject`: that would call `stop()`, which reads the two timer
    // handles below. They are `const` (eslint prefer-const), so reading
    // them from this path would hit the temporal dead zone rather than the
    // `undefined` a `let` would have given. Returning here means `stop()`
    // is only ever reachable after both are initialized.
    if (signal?.aborted) {
      reject(new ExternalWaiterAbortedError());
      return;
    }

    let settled = false;
    let checking = false;

    function stop(): void {
      clearInterval(intervalHandle);
      clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", onAbort);
    }

    function settleResolve(): void {
      if (settled) return;
      settled = true;
      stop();
      resolve();
    }

    function settleReject(error: Error): void {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    }

    function onAbort(): void {
      settleReject(new ExternalWaiterAbortedError());
    }

    async function poll(): Promise<void> {
      if (settled || checking) return;
      checking = true;
      try {
        if (await check()) settleResolve();
      } finally {
        checking = false;
      }
    }

    signal?.addEventListener("abort", onAbort);

    const timeoutHandle = setTimeout(() => {
      settleReject(new ExternalWaiterTimeoutError(maxDurationMs));
    }, maxDurationMs);
    const intervalHandle = setInterval(() => {
      void poll();
    }, intervalMs);
    void poll();
  });
}
