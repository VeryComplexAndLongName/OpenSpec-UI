import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ComplianceApp } from "./ComplianceApp.js";
import type { ComplianceReading } from "@openspec-ui/core/browser";

const reading: ComplianceReading = {
  generation: 0,
  policy: { backgroundEnabled: false, global: {}, topics: {}, rules: {} },
  rules: [],
  observations: [],
  pending: 0,
  nextAllowedAtMs: 0,
};

it("mounts the shared Metro root and follows live light, dark and high-contrast themes", async () => {
  document.body.className = "vscode-light";
  render(<ComplianceApp api={vi.fn(async () => reading)} />);
  const root = screen.getByTestId("compliance-webview-root");

  expect(root).toHaveClass("openspec-metro");
  expect(root).not.toHaveClass("dark-side");

  await act(async () => { document.body.className = "vscode-dark"; });
  expect(root).toHaveClass("dark-side");

  await act(async () => { document.body.className = "vscode-high-contrast"; });
  expect(root).toHaveClass("dark-side");

  await act(async () => { document.body.className = "vscode-high-contrast vscode-high-contrast-light"; });
  expect(root).not.toHaveClass("dark-side");
});