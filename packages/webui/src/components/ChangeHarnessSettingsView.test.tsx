import { HARNESS_TEMPLATES, templatesForScope } from "@openspec-ui/core/browser";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TOP_LEVEL_CONFIG_KEYS } from "@openspec-ui/core";
import { ChangeHarnessSettingsView } from "./ChangeHarnessSettingsView.js";
import type { HarnessSettingsApi } from "./harness-settings-parts.js";

// a-change-is-configured-from-the-change. This view is opened from a
// change and edits that change's own file. The view it replaces lost the
// change's name when the name arrived after it mounted: it copied the name
// into state once and read the copy, so a panel opened from the Changes
// tree showed an empty field and no settings.

function createApi(overrides: Partial<HarnessSettingsApi> = {}): HarnessSettingsApi {
  return {
    listCustomAgents: vi.fn().mockResolvedValue({
      agents: [],
      directories: [{ family: "claude", scope: "project", path: "/repo/.claude/agents" }],
    }),
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

const saveButton = () => screen.getByRole("button", { name: "Save change settings" });

async function renderLoaded(api: HarnessSettingsApi, changeName = "demo") {
  const view = render(<ChangeHarnessSettingsView api={api} changeName={changeName} />);
  await screen.findByLabelText("change propose agent");
  return view;
}

describe("ChangeHarnessSettingsView — knowing its change", () => {
  it("reads the change it was given when it mounts, and asks for no name", async () => {
    const api = createApi();
    await renderLoaded(api);

    expect(api.readChangeOverride).toHaveBeenCalledTimes(1);
    expect(api.readChangeOverride).toHaveBeenCalledWith("demo");
    expect(screen.queryByTestId("change-override-name-input")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("change-harness-fields").textContent).toContain("openspec/changes/demo/harness.json");
  });

  it("reads the other change when it is given another name", async () => {
    const api = createApi();
    const { rerender } = await renderLoaded(api);

    rerender(<ChangeHarnessSettingsView api={api} changeName="other" />);

    await waitFor(() => expect(api.readChangeOverride).toHaveBeenLastCalledWith("other"));
    await waitFor(() => expect(screen.getByTestId("change-harness-fields").textContent).toContain("openspec/changes/other/harness.json"));
  });

  it("shows the change it was last given, when an earlier reading answers late", async () => {
    let answerFirst: (value: Partial<import("@openspec-ui/core/browser").HarnessConfig> | null) => void = () => undefined;
    const readChangeOverride = vi.fn((name: string) => name === "first"
      ? new Promise<Partial<import("@openspec-ui/core/browser").HarnessConfig> | null>((resolve) => { answerFirst = resolve; })
      : Promise.resolve({ reviewGate: { mode: "agent-sufficient" as const } }));
    const api = createApi({ readChangeOverride });
    const { rerender } = render(<ChangeHarnessSettingsView api={api} changeName="first" />);

    rerender(<ChangeHarnessSettingsView api={api} changeName="second" />);
    await waitFor(() => expect(screen.getByLabelText("Change review gate mode")).toHaveValue("agent-sufficient"));

    answerFirst({ reviewGate: { mode: "human-required" } });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(screen.getByLabelText("Change review gate mode")).toHaveValue("agent-sufficient");
  });

  it("shows the reason a reading got no answer", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockRejectedValue(new Error("the host did not reply within 10 seconds to harness/read-change-override")),
    });
    render(<ChangeHarnessSettingsView api={api} changeName="demo" />);

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/read-change-override/u)).toBeInTheDocument();
  });

  it("offers the global defaults where the host can open them", async () => {
    const onEditGlobal = vi.fn();
    render(<ChangeHarnessSettingsView api={createApi()} changeName="demo" onEditGlobal={onEditGlobal} />);
    await screen.findByLabelText("change propose agent");

    fireEvent.click(screen.getByRole("button", { name: "Edit global defaults" }));

    expect(onEditGlobal).toHaveBeenCalledOnce();
  });
});

describe("ChangeHarnessSettingsView — what it inherits", () => {
  it("names the agent a stage inherits, and from where", async () => {
    await renderLoaded(createApi());

    const texts = (label: string) => [...(screen.getByLabelText(label) as HTMLSelectElement).querySelectorAll("option")]
      .map((option) => option.textContent ?? "");
    expect(texts("change propose agent")[0]).toBe("(inherit: claude-cli, from the global file)");
    expect(texts("change apply agent")[0]).toBe("(inherit: no agent set in the global file)");
    expect(texts("Change autonomy level")[0]).toBe("(inherit: assisted, from the global file)");
    expect(texts("Change review gate mode")[0]).toBe("(inherit: human-required, from the global file)");
  });

  it("shows only the explicitly-set fields as set", async () => {
    await renderLoaded(createApi({ readChangeOverride: vi.fn().mockResolvedValue({ reviewGate: { mode: "agent-sufficient" } }) }));

    expect(screen.getByLabelText("Change review gate mode")).toHaveValue("agent-sufficient");
    // stepAgents were never set in the override — the field must show
    // inherit, not silently default to a real agent id.
    expect(screen.getByLabelText("change propose agent")).toHaveValue("");
  });

  it("shows archive and git as mechanical rows with no agent picker", async () => {
    await renderLoaded(createApi());

    expect(screen.queryByLabelText("change archive agent")).toBeNull();
    expect(screen.queryByLabelText("change git agent")).toBeNull();
    expect(screen.getAllByText("runs mechanically — no agent")).toHaveLength(2);
  });

  it("hides the effort/budget fields for a stage still inheriting its agent", async () => {
    await renderLoaded(createApi());

    expect(screen.queryByLabelText("change propose effort")).toBeNull();
    expect(screen.queryByLabelText("change propose budget")).toBeNull();
  });
});

describe("ChangeHarnessSettingsView — saving", () => {
  it("disables save until a field changes, and says there are unsaved changes", async () => {
    await renderLoaded(createApi());

    expect(saveButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Change review gate mode"), { target: { value: "agent-sufficient" } });

    expect(saveButton()).toBeEnabled();
    expect(screen.getByTestId("change-harness-unsaved").textContent).toBe("Unsaved changes");
  });

  it("saves only the explicitly-set fields, omitting inherited ones", async () => {
    const api = createApi();
    await renderLoaded(api);

    fireEvent.change(screen.getByLabelText("Change review gate mode"), { target: { value: "agent-sufficient" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", { stepAgents: {}, reviewGate: { mode: "agent-sufficient" } }),
    );
  });

  it("sets the change to autonomous, which only a change may be", async () => {
    const api = createApi();
    await renderLoaded(api);

    const levels = [...(screen.getByLabelText("Change autonomy level") as HTMLSelectElement).querySelectorAll("option")].map((o) => o.value);
    expect(levels).toEqual(["", "assisted", "semi-autonomous", "autonomous"]);

    fireEvent.change(screen.getByLabelText("Change autonomy level"), { target: { value: "autonomous" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", { stepAgents: {}, autonomyLevel: "autonomous" }));
  });

  it("loads a stage's effort and budget, and keeps the budget when the effort is changed", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue({
        stepAgents: { apply: { agent: "copilot-cli", effort: "none", budget: { maxAiCredits: 30 } } },
      }),
    });
    await renderLoaded(api);

    expect(screen.getByLabelText("change apply effort")).toHaveValue("none");
    expect(screen.getByLabelText("change apply budget")).toHaveValue(30);

    fireEvent.change(screen.getByLabelText("change apply effort"), { target: { value: "low" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", {
        stepAgents: { apply: { agent: "copilot-cli", effort: "low", budget: { maxAiCredits: 30 } } },
      }),
    );
  });

  it("keeps every accepted key when saving", async () => {
    const everyKey = {
      stepAgents: { propose: "claude-cli" },
      autonomyLevel: "autonomous",
      reviewGate: { mode: "agent-sufficient" },
      checkpoints: { requireConfirmationBetweenSteps: false },
      budget: { maxCostUsd: 25 },
      timeout: { maxRunSeconds: 14400, maxStageSeconds: 3600 },
      maxStageAttempts: 2,
      gitStageAllowlist: ["openspec/**"],
      taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "reviewer" } },
      steps: [{ step: "await-change", before: "verify", param: "the-other-change" }],
      hints: { enabled: false },
    };
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue({ ...everyKey }) });
    await renderLoaded(api);

    fireEvent.change(screen.getByLabelText("change apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
    const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    expect(TOP_LEVEL_CONFIG_KEYS.filter((key) => !(key in saved))).toEqual([]);
    expect(saved.maxStageAttempts).toBe(2);
    expect(saved.budget).toEqual(everyKey.budget);
  });

  it("still removes autonomyLevel when it is set back to inherit", async () => {
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue({ stepAgents: {}, autonomyLevel: "autonomous" }) });
    await renderLoaded(api);

    fireEvent.change(screen.getByLabelText("Change autonomy level"), { target: { value: "" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", { stepAgents: {} }));
  });
});

describe("ChangeHarnessSettingsView — a named configuration", () => {
  it("offers every configuration a change may be given", async () => {
    await renderLoaded(createApi());

    const offered = [...(screen.getByLabelText("Named configuration") as HTMLSelectElement).querySelectorAll("option")].map((o) => o.value);
    expect(offered).toEqual(templatesForScope("change").map((template) => template.id));
  });

  it("saves the ceilings an applied configuration promised, not only its agents", async () => {
    const api = createApi();
    await renderLoaded(api);

    fireEvent.change(screen.getByLabelText("Named configuration"), { target: { value: "economy" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
    const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    const applied = HARNESS_TEMPLATES.find((template) => template.id === "economy")!;
    expect(saved.timeout).toEqual(applied.config.timeout);
    expect(saved.maxStageAttempts).toBe(applied.config.maxStageAttempts);
  });

  describe("applied against what the change resolves to", () => {
    // a-stage-override-keeps-its-custom-agent. `verify` is deliberately left
    // unset: a stage with no agent anywhere and a stage whose agent takes no
    // effort are different facts, and the message has to tell them apart.
    const mixedGlobal = () => ({
      stepAgents: { propose: "claude-cli", review: "gemini-cli", apply: "codex-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
    });

    async function applyEconomy(api: HarnessSettingsApi) {
      await renderLoaded(api);
      fireEvent.change(screen.getByLabelText("Named configuration"), { target: { value: "economy" } });
      fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    }

    it("writes an effort for each stage whose inherited agent accepts one", async () => {
      const api = createApi({ resolveGlobal: vi.fn().mockResolvedValue(mixedGlobal()) });
      await applyEconomy(api);

      expect(screen.getByLabelText("change propose effort")).toHaveValue("low");
      expect(screen.getByLabelText("change apply effort")).toHaveValue("minimal");
      expect(screen.getByLabelText("change propose agent")).toHaveValue("claude-cli");
      expect(screen.getByLabelText("change apply agent")).toHaveValue("codex-cli");

      fireEvent.click(saveButton());
      await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
      const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
      expect(saved.stepAgents).toEqual({
        propose: { agent: "claude-cli", effort: "low" },
        apply: { agent: "codex-cli", effort: "minimal" },
      });
    });

    it("says beside the button which stages were given an effort, and why the others were not", async () => {
      await applyEconomy(createApi({ resolveGlobal: vi.fn().mockResolvedValue(mixedGlobal()) }));

      const message = screen.getByTestId("change-harness-named-configuration-status").textContent ?? "";
      expect(message).toContain("propose low");
      expect(message).toContain("apply minimal");
      expect(message).toContain("review (gemini-cli)");
      expect(message).toContain("No agent is chosen for verify");
      expect(message).not.toContain("None of the agents on screen");
    });

    it("says no agent on screen accepts an effort only when that is so", async () => {
      await applyEconomy(createApi({
        resolveGlobal: vi.fn().mockResolvedValue({
          stepAgents: { propose: "gemini-cli", review: "gemini-cli", apply: "local-llm", verify: "local-llm" },
          autonomyLevel: "assisted",
          reviewGate: { mode: "human-required" },
        }),
      }));

      expect(screen.getByTestId("change-harness-named-configuration-status").textContent)
        .toContain("None of the agents on screen takes an effort setting");
    });
  });
});
