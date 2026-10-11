import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ComplianceView } from "./ComplianceView.js";
import type { ComplianceReading } from "@openspec-ui/core/browser";

const reading: ComplianceReading = {
  generation: 1, policy: { backgroundEnabled: false, global: {}, topics: {}, rules: {} }, pending: 2, nextAllowedAtMs: 0,
  rules: [
    { id: "runtime-ignore", topic: "runtime", title: "Runtime ignore", source: "ADR-0049", severity: "warning", conservativeMs: 20, repair: "append-runtime-ignore" },
    { id: "sweep-result", topic: "sweep", title: "Sweep branch", source: "ADR-0034", severity: "warning", conservativeMs: 20 },
  ],
  observations: [{ ruleId: "sweep-result", subject: "demo", owner: "sweep", producer: "workspace-sweep", repository: "/repo/.git",
    revision: "one", outcome: "finding", evidence: "Rebase conflict", checkedAt: "2026-10-11T10:00:00Z", changedAt: "2026-10-11T09:00:00Z",
    finding: { ruleId: "sweep-result", subject: "demo", owner: "sweep", producer: "workspace-sweep", repository: "/repo/.git",
      revision: "one", outcome: "finding", evidence: "Rebase conflict", checkedAt: "2026-10-11T10:00:00Z" } }],
};

it("opens cached results and details without initiating checks or repairs", async () => {
  const api = vi.fn(async () => reading);
  render(<ComplianceView api={api} />);
  await screen.findByText("Sweep branch");
  fireEvent.click(screen.getByText("Sweep branch"));
  expect(screen.getByText("Managed by Sweep")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Repair Rules..." })).not.toBeInTheDocument();
  expect(api.mock.calls).toHaveLength(1);
  expect(api).toHaveBeenCalledWith({ op: "read" });
});

it("mounts settings lazily and exposes independent tracking and reaction controls", async () => {
  const api = vi.fn(async () => reading);
  render(<ComplianceView api={api} />);
  await screen.findByText("Sweep branch");
  expect(screen.queryByRole("switch", { name: "Background monitoring" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
  expect(screen.getByRole("switch", { name: "Track Runtime ignore" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Reaction for Runtime ignore" })).toBeInTheDocument();
  expect(screen.queryByRole("switch", { name: "Track Sweep branch" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Background monitoring" }));
  await waitFor(() => expect(api).toHaveBeenCalledWith(expect.objectContaining({ op: "settings", generation: 1 })));
});

it("starts explicit completion only after pressing Read remaining", async () => {
  const api = vi.fn(async request => request.op === "step" ? { ...reading, pending: 0 } : reading);
  render(<ComplianceView api={api} />);
  await screen.findByText("Sweep branch");
  fireEvent.click(screen.getByRole("button", { name: /Read remaining/ }));
  await waitFor(() => expect(api).toHaveBeenCalledWith({ op: "step" }));
});

it("shows persisted repair advice and offers only an explicit safe retry", async () => {
  const original = reading.observations[0]!;
  const item = { ...original, ruleId: "runtime-ignore", owner: "compliance" as const,
    repairAdvice: "An active Git operation blocks repair. Finish it before retrying.",
    finding: { ...original.finding!, ruleId: "runtime-ignore", owner: "compliance" as const } };
  const api = vi.fn(async () => ({ ...reading, observations: [item] }));
  render(<ComplianceView api={api} />);
  await screen.findByText("Repair skipped - Advice");
  fireEvent.click(screen.getByText("Runtime ignore"));
  expect(screen.getByText(item.repairAdvice)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Repair Rules..." })).toHaveAttribute("title", "Retry safe repair");
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith({ op: "read" });
});