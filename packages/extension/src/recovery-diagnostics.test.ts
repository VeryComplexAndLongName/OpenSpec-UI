import { describe, expect, it } from "vitest";
import { WorkbenchJournalLoadError } from "@openspec-ui/core";
import { recoveryDisabledMessage } from "./recovery-diagnostics.js";

describe("recoveryDisabledMessage", () => {
  it("presents actionable core compatibility diagnostics without parsing message text", () => {
    const error = new WorkbenchJournalLoadError(
      "Workbench run journal version 2 is not supported. Upgrade OpenSpec UI to recover runs.",
      {
        code: "unsupported-journal-version",
        journalPath: "/workspace/.openspec-ui/workbench-runs.json",
        foundVersion: 2,
        supportedVersion: 1,
      },
    );

    expect(recoveryDisabledMessage(error)).toContain("Upgrade OpenSpec UI to recover runs");
  });
});