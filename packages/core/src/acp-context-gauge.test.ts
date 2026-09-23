import { describe, expect, it } from "vitest";
import { describeContextShare, readAcpContextGauge } from "./acp-context-gauge.js";

// a-run-can-outgrow-its-context. Measured against dsh 0.1.5-rc.2 on
// 2026-09-23: `{"used":8202,"size":1000000,"sessionUpdate":"usage_update"}`.

describe("readAcpContextGauge", () => {
  it("reads what the agent said about its window", () => {
    expect(readAcpContextGauge({ sessionUpdate: "usage_update", used: 8202, size: 1_000_000 }))
      .toEqual({ used: 8202, size: 1_000_000, share: 0.008202 });
  });

  it("reads a full window as a share of one", () => {
    expect(readAcpContextGauge({ sessionUpdate: "usage_update", used: 200, size: 200 })?.share).toBe(1);
  });

  it.each([
    ["an update of another kind", { sessionUpdate: "agent_message_chunk", used: 1, size: 2 }],
    ["an update of no kind at all", { used: 1, size: 2 }],
    ["a missing figure", { sessionUpdate: "usage_update", used: 1 }],
    ["a figure that is not a number", { sessionUpdate: "usage_update", used: "1", size: 2 }],
    ["a window of nothing", { sessionUpdate: "usage_update", used: 1, size: 0 }],
    ["a negative reading", { sessionUpdate: "usage_update", used: -1, size: 2 }],
    ["an infinite reading", { sessionUpdate: "usage_update", used: Number.POSITIVE_INFINITY, size: 2 }],
  ])("says nothing of %s", (_what, update) => {
    expect(readAcpContextGauge(update as Record<string, unknown>)).toBeUndefined();
  });
});

describe("describeContextShare", () => {
  // The ceiling names itself and the figures it judged: a person reading
  // a cancelled run has to tell a rule firing from somebody clicking.
  it("names the ceiling, its value, and what was measured", () => {
    const said = describeContextShare({ used: 850_000, size: 1_000_000, share: 0.85 }, 0.8);

    expect(said).toBe(
      "stopped at the context ceiling: budget.maxContextShare is 80.0%"
      + ", and the agent reported 850,000 of 1,000,000 tokens in its context (85.0%)",
    );
  });
});
