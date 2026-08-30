import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HarnessSettingsView, type HarnessSettingsApi } from "./HarnessSettingsView.js";

function createApi(overrides: Partial<HarnessSettingsApi> = {}): HarnessSettingsApi {
  return {
    resolveGlobal: vi.fn().mockResolvedValue({
      stepAgents: { propose: "claude-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
    }),
    writeGlobal: vi.fn().mockResolvedValue(undefined),
    readChangeOverride: vi.fn().mockResolvedValue(null),
    writeChangeOverride: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("HarnessSettingsView", () => {
  it("loads and shows the global stepAgents recommendation on mount", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);

    expect(await screen.findByLabelText("propose agent")).toHaveValue("claude-cli");
    expect(api.resolveGlobal).toHaveBeenCalledOnce();
  });

  it("saves the global config with the edited stepAgents and autonomyLevel", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.change(screen.getByLabelText("Global autonomy level"), { target: { value: "semi-autonomous" } });
    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    await waitFor(() =>
      expect(api.writeGlobal).toHaveBeenCalledWith({
        stepAgents: { propose: "claude-cli", apply: "gemini-cli" },
        autonomyLevel: "semi-autonomous",
      }),
    );
  });

  it("global stepAgents select has no inherit option (there is nothing to inherit from)", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    const options = Array.from((screen.getByLabelText("propose agent") as HTMLSelectElement).querySelectorAll("option")).map((o) => o.textContent);
    expect(options).not.toContain("(inherit)");
    expect(options).toContain("(none)");
  });

  it("does not show the per-change form until an override is explicitly loaded", () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);

    expect(screen.queryByLabelText("Change review gate mode")).not.toBeInTheDocument();
  });

  it("loads an existing per-change override and shows only its explicitly-set fields as non-inherited", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue({ reviewGate: { mode: "agent-sufficient" } }),
    });
    render(<HarnessSettingsView api={api} />);

    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));

    expect(await screen.findByLabelText("Change review gate mode")).toHaveValue("agent-sufficient");
    expect(api.readChangeOverride).toHaveBeenCalledWith("demo");
    // stepAgents were never set in the override — the field must show
    // "(inherit)", not silently default to a real agent id.
    expect(screen.getByLabelText("change propose agent")).toHaveValue("");
  });

  it("saves only the explicitly-set per-change fields, omitting inherited ones", async () => {
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue(null) });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("Change review gate mode");

    fireEvent.change(screen.getByLabelText("Change review gate mode"), { target: { value: "agent-sufficient" } });
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() =>
      expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", {
        stepAgents: {},
        reviewGate: { mode: "agent-sufficient" },
      }),
    );
  });

  it("shows a load-failure message instead of silently showing nothing", async () => {
    const api = createApi({ resolveGlobal: vi.fn().mockRejectedValue(new Error("network down")) });
    render(<HarnessSettingsView api={api} />);

    expect(await screen.findByText("Load failed: network down")).toBeInTheDocument();
  });
});
