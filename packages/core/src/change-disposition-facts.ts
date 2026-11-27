export type ChangeDispositionState = "active" | "deferred" | "cancelled";

export interface ChangeDispositionDecision {
  state: ChangeDispositionState;
  reason: string;
  at: string;
}

export interface ChangeDisposition {
  revision: string;
  history: ChangeDispositionDecision[];
}

export interface ChangeDispositionRequest {
  revision: string;
  state: ChangeDispositionState;
  reason: string;
}

export function lastDisposition(reading: ChangeDisposition | undefined): ChangeDispositionDecision | undefined {
  return reading?.history.at(-1);
}
