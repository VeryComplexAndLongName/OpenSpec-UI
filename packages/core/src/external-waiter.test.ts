import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalWaiterAbortedError, ExternalWaiterTimeoutError, waitForExternalSignal } from "./external-waiter.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForExternalSignal", () => {
  it("resolves on the first check reporting a change, and checks no further afterward", async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValue(true);

    const promise = waitForExternalSignal({ check, intervalMs: 1000, maxDurationMs: 60_000 });
    await expect(promise).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("stops on abort, and checks no further afterward", async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValue(false);
    const controller = new AbortController();

    const promise = waitForExternalSignal({
      check,
      intervalMs: 1000,
      maxDurationMs: 60_000,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(2500);
    const callsBeforeAbort = check.mock.calls.length;
    expect(callsBeforeAbort).toBeGreaterThan(0);

    controller.abort();
    await expect(promise).rejects.toBeInstanceOf(ExternalWaiterAbortedError);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(check).toHaveBeenCalledTimes(callsBeforeAbort);
  });

  it("fails once its maximum duration elapses, and checks no further afterward", async () => {
    vi.useFakeTimers();
    const check = vi.fn().mockResolvedValue(false);

    const promise = waitForExternalSignal({ check, intervalMs: 1000, maxDurationMs: 5000 });
    const assertion = expect(promise).rejects.toBeInstanceOf(ExternalWaiterTimeoutError);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;

    const callsAtTimeout = check.mock.calls.length;
    expect(callsAtTimeout).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(check).toHaveBeenCalledTimes(callsAtTimeout);
  });

  it("resolves as soon as a later poll reports a change, not only on the first", async () => {
    vi.useFakeTimers();
    const check = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    const promise = waitForExternalSignal({ check, intervalMs: 1000, maxDurationMs: 60_000 });
    await vi.advanceTimersByTimeAsync(2000);

    await expect(promise).resolves.toBeUndefined();
    expect(check).toHaveBeenCalledTimes(3);
  });
});
