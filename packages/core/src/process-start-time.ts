// The operating system's creation time for a process, per platform. The time
// is the process's identity across PID reuse: a stale PID can name an
// unrelated process, but (pid, start time) cannot be mistaken for it.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);

export type StartTimeReader = (pid: number) => Promise<Date | undefined>;

/** Reads a process's OS creation time, or `undefined` when it cannot be
 * determined. Callers must fail closed and never guess a time. */
export async function readProcessStartTime(pid: number): Promise<Date | undefined> {
  if (!Number.isSafeInteger(pid) || pid <= 0) return undefined;
  if (process.platform === "win32") return windowsStartTime(pid);
  // `ps -o lstart=` is the robust portable reading on both Linux and macOS:
  // it returns a wall-clock creation time without parsing /proc field
  // indices or converting clock ticks.
  return posixStartTime(pid);
}

async function windowsStartTime(pid: number): Promise<Date | undefined> {
  try {
    const { stdout } = await execute("powershell", [
      "-NoProfile", "-NonInteractive", "-Command",
      `(Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}").CreationDate`,
    ], { windowsHide: true, timeout: 3_000, maxBuffer: 4_096 });
    const text = stdout.trim();
    return text ? new Date(text) : undefined;
  } catch {
    return undefined;
  }
}

async function posixStartTime(pid: number): Promise<Date | undefined> {
  try {
    const { stdout } = await execute("ps", ["-o", "lstart=", "-p", String(pid)], {
      timeout: 3_000, maxBuffer: 4_096,
    });
    const text = stdout.trim();
    return text ? new Date(text) : undefined;
  } catch {
    return undefined;
  }
}
