export function recoveryDisabledMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `OpenSpec Workbench: run recovery disabled (${detail}).`;
}