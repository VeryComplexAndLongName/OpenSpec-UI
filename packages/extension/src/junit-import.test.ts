import { describe, expect, it, vi } from "vitest";
import { pickJUnitReport } from "./junit-import.js";

describe("native JUnit input collection", () => {
  const head = "a".repeat(40);
  const testedCommit = "b".repeat(40);
  function host() {
    return { choose: vi.fn(async () => "report.xml" as string | undefined), size: vi.fn(async () => 100),
      commit: vi.fn(async () => testedCommit as string | undefined), read: vi.fn(async () => new TextEncoder().encode("<testsuite/>")) };
  }
  it("forwards the selected bytes and explicit revision without inferring HEAD", async () => {
    const input = host();
    expect(await pickJUnitReport(head, input)).toEqual({ head, testedCommit, xml: "<testsuite/>" });
    expect(input.read).toHaveBeenCalledWith("report.xml");
  });
  it("does not read a file after either native prompt is cancelled", async () => {
    const cancelledFile = host(); cancelledFile.choose.mockResolvedValue(undefined);
    expect(await pickJUnitReport(head, cancelledFile)).toBeUndefined();
    expect(cancelledFile.read).not.toHaveBeenCalled();
    const cancelledCommit = host(); cancelledCommit.commit.mockResolvedValue(undefined);
    expect(await pickJUnitReport(head, cancelledCommit)).toBeUndefined();
    expect(cancelledCommit.read).not.toHaveBeenCalled();
  });
  it("refuses an oversized or grown file before forwarding it", async () => {
    const large = host(); large.size.mockResolvedValue(128 * 1024 + 1);
    await expect(pickJUnitReport(head, large)).rejects.toThrow("128 KiB");
    expect(large.read).not.toHaveBeenCalled();
    const grown = host(); grown.read.mockResolvedValue(new Uint8Array(128 * 1024 + 1));
    await expect(pickJUnitReport(head, grown)).rejects.toThrow("128 KiB");
  });
});
