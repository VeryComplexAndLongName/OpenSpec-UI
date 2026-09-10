import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HARNESS_TEMPLATES } from "@openspec-ui/core/browser";
// The key list is the point of the guard below, and it lives in
// harness-config.js, which imports node:fs and so is not in the browser
// entry. A test file is not bundled for the browser, so it reads it from
// the package root rather than the list being duplicated here — a copy
// would pass while the real list grew.
import { TOP_LEVEL_CONFIG_KEYS } from "@openspec-ui/core";
import { HarnessSettingsView, type HarnessSettingsApi } from "./HarnessSettingsView.js";

function createApi(overrides: Partial<HarnessSettingsApi> = {}): HarnessSettingsApi {
  return {
    // A workspace defining none is the ordinary case, including this
    // one — so that is what the default mock answers, and a test about
    // the picker overrides it.
    listCustomAgents: vi.fn().mockResolvedValue({
      agents: [],
      directories: [
        { family: "claude", scope: "project", path: "/repo/.claude/agents" },
        { family: "copilot", scope: "project", path: "/repo/.github/agents" },
      ],
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
        // Carried from the loaded config rather than dropped: the writer
        // replaces the file, so anything left out of this payload is
        // deleted. See settings-save-what-was-shown.
        reviewGate: { mode: "human-required" },
      }),
    );
  });

  it("shows archive as a mechanical row with no agent picker, in both the global and per-change forms (harness-mechanical-checks 4.4)", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue(null),
    });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    expect(screen.queryByLabelText("archive agent")).not.toBeInTheDocument();
    expect(screen.getAllByText("archive").length).toBeGreaterThan(0);
    expect(screen.getAllByText("runs mechanically — no agent").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("change propose agent");

    expect(screen.queryByLabelText("change archive agent")).not.toBeInTheDocument();
    // one "archive" row per form (global + change) plus the mechanical note.
    expect(screen.getAllByText("archive").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("runs mechanically — no agent").length).toBeGreaterThanOrEqual(2);
  });

  it("shows git as a mechanical row with no agent picker, in both the global and per-change forms (harness-git-stage-no-agent 3.1)", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue(null),
    });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    expect(screen.queryByLabelText("git agent")).not.toBeInTheDocument();
    expect(screen.getAllByText("git").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("change propose agent");

    expect(screen.queryByLabelText("change git agent")).not.toBeInTheDocument();
    // one "git" row per form (global + change) plus the mechanical note.
    expect(screen.getAllByText("git").length).toBeGreaterThanOrEqual(2);
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

describe("HarnessSettingsView effort and budget (harness-step-effort-and-budget)", () => {
  it("offers VS Code chat as a stage runner and hides effort/budget controls for it", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "vscode-chat" } });

    expect(screen.queryByLabelText("apply effort")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("apply budget")).not.toBeInTheDocument();
  });

  it("does not offer an effort or budget field for an agent with no such mechanism (gemini-cli)", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });

    expect(screen.queryByLabelText("apply effort")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("apply budget")).not.toBeInTheDocument();
  });

  it("offers only claude-cli's accepted effort values, and the maxCostUsd budget field", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "claude-cli" } });

    const effortSelect = screen.getByLabelText("apply effort") as HTMLSelectElement;
    const options = Array.from(effortSelect.querySelectorAll("option")).map((o) => o.value);
    expect(options).toEqual(["", "low", "medium", "high", "xhigh", "max"]);
    expect(screen.getByLabelText("apply budget")).toBeInTheDocument();
  });

  it("saves the global config with effort and budget set on a stage, as the object form", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "claude-cli" } });
    fireEvent.change(screen.getByLabelText("apply effort"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("apply budget"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    await waitFor(() =>
      expect(api.writeGlobal).toHaveBeenCalledWith({
        stepAgents: {
          propose: "claude-cli",
          apply: { agent: "claude-cli", effort: "high", budget: { maxCostUsd: 5 } },
        },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    );
  });

  it("saves a stage as the plain bare-string form when effort/budget are left unset", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "claude-cli" } });
    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    await waitFor(() =>
      expect(api.writeGlobal).toHaveBeenCalledWith({
        stepAgents: { propose: "claude-cli", apply: "claude-cli" },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    );
  });

  it("loads an existing per-change effort/budget override and re-saves it unchanged", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue({
        stepAgents: { apply: { agent: "copilot-cli", effort: "none", budget: { maxAiCredits: 30 } } },
      }),
    });
    render(<HarnessSettingsView api={api} />);

    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));

    expect(await screen.findByLabelText("change apply effort")).toHaveValue("none");
    expect(screen.getByLabelText("change apply budget")).toHaveValue(30);

    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() =>
      expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", {
        stepAgents: { apply: { agent: "copilot-cli", effort: "none", budget: { maxAiCredits: 30 } } },
      }),
    );
  });

  it("hides the per-change effort/budget fields for a stage still inheriting its agent", async () => {
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue(null) });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("change propose agent");

    expect(screen.queryByLabelText("change propose effort")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("change propose budget")).not.toBeInTheDocument();
  });
});

describe("HarnessSettingsView — what the configuration cannot do", () => {
  it("says a cost ceiling cannot act on an agent that reports no cost", async () => {
    const api = createApi({
      resolveGlobal: vi.fn().mockResolvedValue({
        stepAgents: { apply: "copilot-cli-acp" },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
        budget: { maxCostUsd: 10 },
        timeout: { maxStageSeconds: 600 },
      }),
    });

    render(<HarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByTestId("harness-findings")).toBeTruthy());
    expect(screen.getByTestId("harness-finding-apply").textContent).toContain("reports tokens and no cost");
    // Valid and saved regardless: an operator may knowingly leave one
    // stage's ceiling unable to act.
    expect(screen.getByTestId("harness-findings").textContent).toContain("will be saved");
  });

  it("renders nothing when every configured ceiling can act", async () => {
    // The quiet case. A surface that warns about a correct configuration
    // becomes noise people learn to ignore.
    const api = createApi({
      resolveGlobal: vi.fn().mockResolvedValue({
        stepAgents: { apply: "claude-cli-acp" },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
        budget: { maxCostUsd: 10 },
        timeout: { maxStageSeconds: 600 },
      }),
    });

    render(<HarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByTestId("harness-settings-view")).toBeTruthy());
    expect(screen.queryByTestId("harness-findings")).toBeNull();
  });
});

describe("HarnessSettingsView — templates", () => {
  it("offers a template with both what it is for and when it is wrong", async () => {
    render(<HarnessSettingsView api={createApi()} />);

    await waitFor(() => expect(screen.getByTestId("harness-templates-global")).toBeTruthy());
    const balanced = screen.getByTestId("harness-template-global-balanced");
    expect(balanced.textContent).toContain("Not for:");
    // The basis line is what lets a reader disagree with the judgement
    // rather than with the measurement.
    expect(balanced.textContent).toMatch(/p75|median|judgement/);
  });

  it("offers globally exactly what may be written globally", async () => {
    // A configuration using a per-change-only field is refused on save,
    // so offering it here would hand someone one that fails. Read from
    // the same function the view uses rather than from a named id, so
    // this keeps holding when the list changes.
    render(<HarnessSettingsView api={createApi()} />);

    await waitFor(() => expect(screen.getByTestId("harness-templates-global")).toBeTruthy());
    const offered = [...screen.getByTestId("harness-templates-global").querySelectorAll("li")]
      .map((item) => item.getAttribute("data-testid"));
    expect(offered).toEqual(HARNESS_TEMPLATES
      .filter((template) => template.scope !== "change")
      .map((template) => `harness-template-global-${template.id}`));
    for (const template of HARNESS_TEMPLATES.filter((entry) => entry.scope === "change")) {
      expect(screen.queryByTestId(`harness-template-global-${template.id}`)).toBeNull();
    }
  });

  it("fills the form without saving, and says so", async () => {
    const api = createApi();
    render(<HarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByTestId("harness-template-global-economy")).toBeTruthy());
    fireEvent.click(screen.getByTestId("harness-template-global-economy").querySelector("button")!);

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Nothing is saved"));
    expect(api.writeGlobal).not.toHaveBeenCalled();
  });
});

describe("HarnessSettingsView — saving preserves what it cannot show", () => {
  // settings-save-what-was-shown. Both writers replace the file, so a key
  // this view has no field for is deleted by pressing Save, not left
  // alone. Measured 2026-09-08: the global save sent 2 of the 8 accepted
  // top-level keys and the per-change save 3.
  //
  // Asserted against TOP_LEVEL_CONFIG_KEYS rather than against a list of
  // fields, so the ninth key added to the schema and forgotten here fails
  // immediately. Naming fields is what let this pass for as long as it
  // did.

  /** One value per accepted key, valid for a per-change file (which is
   * the stricter of the two: `autonomyLevel: "autonomous"` and
   * `reviewGate.mode: "agent-sufficient"` are refused globally). */
  const everyKey = {
    stepAgents: { propose: "claude-cli" },
    autonomyLevel: "autonomous",
    reviewGate: { mode: "agent-sufficient" },
    checkpoints: { requireConfirmationBetweenSteps: false },
    budget: { maxCostUsd: 25 },
    timeout: { maxRunSeconds: 14400, maxStageSeconds: 3600 },
    maxStageAttempts: 2,
    gitStageAllowlist: ["openspec/**"],
  } as const;

  function keysMissingFrom(saved: Record<string, unknown>, expected: readonly string[]): string[] {
    return expected.filter((key) => !(key in saved));
  }

  it("keeps every accepted key when saving the global config", async () => {
    // `autonomyLevel` and `reviewGate` are the two this form owns, so the
    // global fixture uses values a global file accepts.
    const globalConfig = { ...everyKey, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } };
    const api = createApi({ resolveGlobal: vi.fn().mockResolvedValue(globalConfig) });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    await waitFor(() => expect(api.writeGlobal).toHaveBeenCalled());
    const saved = (api.writeGlobal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    expect(keysMissingFrom(saved, TOP_LEVEL_CONFIG_KEYS)).toEqual([]);
    // The edit still lands, and the untouched keys are unchanged rather
    // than merely present.
    expect(saved.stepAgents).toMatchObject({ apply: "gemini-cli" });
    expect(saved.timeout).toEqual(everyKey.timeout);
    expect(saved.gitStageAllowlist).toEqual(everyKey.gitStageAllowlist);
  });

  it("keeps every accepted key when saving a per-change override", async () => {
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue({ ...everyKey }) });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("change propose agent");

    fireEvent.change(screen.getByLabelText("change apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
    const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    expect(keysMissingFrom(saved, TOP_LEVEL_CONFIG_KEYS)).toEqual([]);
    expect(saved.maxStageAttempts).toBe(2);
    expect(saved.budget).toEqual(everyKey.budget);
  });

  it("still removes autonomyLevel and reviewGate when a per-change field is set back to inherit", async () => {
    // Carrying the loaded file forward must not turn "inherit" into "keep
    // what was there", which would make the option unusable.
    const api = createApi({
      readChangeOverride: vi.fn().mockResolvedValue({ stepAgents: {}, autonomyLevel: "autonomous" }),
    });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByLabelText("change propose agent");

    fireEvent.change(screen.getByLabelText("Change autonomy level"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalledWith("demo", { stepAgents: {} }));
  });
});

describe("HarnessSettingsView — a per-change template", () => {
  it("offers the named configurations where a change is edited", async () => {
    // The per-change section had no picker at all until this existed,
    // which left any configuration reserved for a change with nowhere to
    // be applied from.
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue(null) });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));

    expect(await screen.findByTestId("harness-template-change-economy")).toBeTruthy();
  });

  it("saves the ceilings an applied template promised, not only its agents", async () => {
    // The assertion the previous change was missing: the diagnostic panel
    // updated, the sentence said "nothing is saved until you save", and
    // then the save dropped every ceiling the template exists to set.
    const api = createApi({ readChangeOverride: vi.fn().mockResolvedValue(null) });
    render(<HarnessSettingsView api={api} />);
    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));
    await screen.findByTestId("harness-template-change-economy");

    fireEvent.click(screen.getByTestId("harness-template-change-economy").querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Save override" }));

    await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
    const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
    const applied = HARNESS_TEMPLATES.find((template) => template.id === "economy")!;
    expect(saved.timeout).toEqual(applied.config.timeout);
    expect(saved.maxStageAttempts).toBe(applied.config.maxStageAttempts);
  });

  describe("applied against what the change resolves to", () => {
    // a-stage-override-keeps-its-custom-agent. This form resolved a
    // configuration's effort against the override's own fields, where
    // every stage the change does not name reads as "inherit" — so
    // nothing ever got an effort, and the message blamed the agents:
    // "None of the agents on screen takes an effort setting", which was
    // not the reason. The run dialog, resolving against the merged
    // configuration, wrote a different file for the same change.

    /** `verify` deliberately left unset: a stage with no agent anywhere
     * and a stage whose agent takes no effort are different facts, and
     * the message has to tell them apart. */
    const mixedGlobal = () => ({
      stepAgents: { propose: "claude-cli", review: "gemini-cli", apply: "codex-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
    });

    async function applyEconomyToChange(api: HarnessSettingsApi) {
      render(<HarnessSettingsView api={api} />);
      await screen.findByLabelText("propose agent");
      fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
      fireEvent.click(screen.getByRole("button", { name: "Load override" }));
      await screen.findByTestId("harness-template-change-economy");
      fireEvent.click(screen.getByTestId("harness-template-change-economy").querySelector("button")!);
    }

    it("writes an effort for each stage whose inherited agent accepts one", async () => {
      const api = createApi({
        resolveGlobal: vi.fn().mockResolvedValue(mixedGlobal()),
        readChangeOverride: vi.fn().mockResolvedValue(null),
      });
      await applyEconomyToChange(api);

      // Each agent's own bottom value, and the agent beside it: an
      // effort without its agent means nothing.
      expect(screen.getByLabelText("change propose effort")).toHaveValue("low");
      expect(screen.getByLabelText("change apply effort")).toHaveValue("minimal");
      expect(screen.getByLabelText("change propose agent")).toHaveValue("claude-cli");
      expect(screen.getByLabelText("change apply agent")).toHaveValue("codex-cli");

      fireEvent.click(screen.getByRole("button", { name: "Save override" }));
      await waitFor(() => expect(api.writeChangeOverride).toHaveBeenCalled());
      const saved = (api.writeChangeOverride as ReturnType<typeof vi.fn>).mock.calls[0]![1] as Record<string, unknown>;
      expect(saved.stepAgents).toEqual({
        propose: { agent: "claude-cli", effort: "low" },
        apply: { agent: "codex-cli", effort: "minimal" },
      });
    });

    it("says which stages were given an effort, and why the others were not", async () => {
      const api = createApi({
        resolveGlobal: vi.fn().mockResolvedValue(mixedGlobal()),
        readChangeOverride: vi.fn().mockResolvedValue(null),
      });
      await applyEconomyToChange(api);

      const message = screen.getByRole("status").textContent ?? "";
      expect(message).toContain("propose low");
      expect(message).toContain("apply minimal");
      // The agent that takes none, named — and distinguished from the
      // stage that has no agent at all.
      expect(message).toContain("review (gemini-cli)");
      expect(message).toContain("No agent is chosen for verify");
      // The sentence that used to be said here is a claim about the
      // agents, and it is false of these.
      expect(message).not.toContain("None of the agents on screen");
    });

    it("says no agent on screen accepts an effort only when that is so", async () => {
      const api = createApi({
        resolveGlobal: vi.fn().mockResolvedValue({
          stepAgents: { propose: "gemini-cli", review: "gemini-cli", apply: "local-llm", verify: "local-llm" },
          autonomyLevel: "assisted",
          reviewGate: { mode: "human-required" },
        }),
        readChangeOverride: vi.fn().mockResolvedValue(null),
      });
      await applyEconomyToChange(api);

      expect(screen.getByRole("status").textContent)
        .toContain("None of the agents on screen takes an effort setting");
    });
  });
});

describe("HarnessSettingsView — custom agents", () => {
  // custom-agent-picker. The path shipped without a way to pick one: a
  // person had to hand-edit `harness.json` with a name nothing on screen
  // had ever shown them.

  const withAgents = (): Partial<HarnessSettingsApi> => ({
    listCustomAgents: vi.fn().mockResolvedValue({
      agents: [
        { name: "reviewer", description: "Reviews against the spec", family: "claude", filePath: "/repo/.claude/agents/reviewer.md" },
        { name: "shipper", family: "copilot", filePath: "/repo/.github/agents/shipper.md" },
      ],
      directories: [
        { family: "claude", scope: "project", path: "/repo/.claude/agents" },
        { family: "copilot", scope: "project", path: "/repo/.github/agents" },
      ],
    }),
  });

  it("offers only the definitions the stage's own CLI accepts", async () => {
    // A definition written for one CLI is not a name the other takes,
    // and offering it would produce a configuration the validator
    // refuses.
    render(<HarnessSettingsView api={createApi(withAgents())} />);
    await screen.findByLabelText("propose agent");

    const select = await screen.findByLabelText("propose custom agent");
    const options = [...select.querySelectorAll("option")].map((option) => option.getAttribute("value"));
    expect(options).toEqual(["", "reviewer"]);
    // The description rides with the name: two names alone give no help
    // choosing between them.
    expect(select.textContent).toContain("Reviews against the spec");
  });

  it("says the CLI takes none rather than showing an empty control", async () => {
    render(<HarnessSettingsView api={createApi(withAgents())} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });

    expect(screen.queryByLabelText("apply custom agent")).toBeNull();
    expect(screen.getByTestId("custom-agent-none-apply").textContent).toContain("takes no custom agent");
  });

  it("says where definitions are read from when the workspace defines none", async () => {
    // "None defined" is only useful if it answers "then where would I
    // put one?".
    render(<HarnessSettingsView api={createApi()} />);
    await screen.findByLabelText("propose agent");

    const empty = await screen.findByTestId("custom-agent-empty-propose");
    expect(empty.textContent).toContain(".claude/agents");
  });

  it("keeps a configured name the discovery no longer finds, marked as such", async () => {
    // Replacing it silently would edit a configuration nobody asked to
    // change and hide that a file it depends on is gone.
    const api = createApi({
      ...withAgents(),
      resolveGlobal: vi.fn().mockResolvedValue({
        stepAgents: { propose: { agent: "claude-cli", customAgent: "deleted-one" } },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    });
    render(<HarnessSettingsView api={api} />);

    const select = await screen.findByLabelText("propose custom agent");
    expect(select).toHaveValue("deleted-one");
    expect(select.textContent).toContain("not found");
  });

  it("saves the chosen name as that stage's custom agent, keeping its other fields", async () => {
    const api = createApi({
      ...withAgents(),
      resolveGlobal: vi.fn().mockResolvedValue({
        // A model this form has no control for. Saving used to delete
        // it — the same defect as settings-save-what-was-shown, one
        // level down in the stage entry.
        stepAgents: { propose: { agent: "claude-cli", model: "some-model", effort: "high" } },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(await screen.findByLabelText("propose custom agent"), { target: { value: "reviewer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    await waitFor(() => expect(api.writeGlobal).toHaveBeenCalled());
    const saved = (api.writeGlobal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { stepAgents: Record<string, unknown> };
    expect(saved.stepAgents.propose).toEqual({
      agent: "claude-cli",
      model: "some-model",
      effort: "high",
      customAgent: "reviewer",
    });
  });
});

describe("HarnessSettingsView — a host that never answers", () => {
  // The bridge now rejects a request nobody replied to, after a stated
  // interval (see bridge-request.ts). This is what the form does with
  // that rejection: before it existed, the promise never settled and the
  // form sat on "Working..." with its save button disabled and nothing
  // said. See a-check-that-passes-checked-something.
  const noReply = () => new Error("the host did not reply within 10 seconds to harness/write-global");

  it("shows the reason a save got no answer, and re-enables the save button", async () => {
    const api = createApi({ writeGlobal: vi.fn().mockRejectedValue(noReply()) });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.click(screen.getByRole("button", { name: "Save global config" }));

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/write-global/u)).toBeInTheDocument();
    const button = await screen.findByRole("button", { name: "Save global config" });
    expect(button).toBeEnabled();
  });

  it("shows the reason a load got no answer rather than an empty form", async () => {
    const api = createApi({
      resolveGlobal: vi.fn().mockRejectedValue(
        new Error("the host did not reply within 10 seconds to harness/resolve-global"),
      ),
    });
    render(<HarnessSettingsView api={api} />);

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/resolve-global/u)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Save global config" })).toBeEnabled();
  });

  it("shows the reason a change override got no answer", async () => {
    const api = createApi({
      readChangeOverride: vi.fn().mockRejectedValue(
        new Error("the host did not reply within 10 seconds to harness/read-change-override"),
      ),
    });
    render(<HarnessSettingsView api={api} />);
    await screen.findByLabelText("propose agent");

    fireEvent.change(screen.getByTestId("change-override-name-input"), { target: { value: "demo" } });
    fireEvent.click(screen.getByRole("button", { name: "Load override" }));

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/read-change-override/u))
      .toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Load override" })).toBeEnabled();
  });
});
