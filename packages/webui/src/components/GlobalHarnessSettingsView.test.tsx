import { autonomyLevelsFor, templatesForScope } from "@openspec-ui/core/browser";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
// The key list is the point of the guard below, and it lives in
// harness-config.js, which imports node:fs and so is not in the browser
// entry. A test file is not bundled for the browser, so it reads it from
// the package root rather than the list being duplicated here.
import { TOP_LEVEL_CONFIG_KEYS } from "@openspec-ui/core";
import { AUTONOMOUS_IS_PER_CHANGE, GlobalHarnessSettingsView } from "./GlobalHarnessSettingsView.js";
import { autonomyLevelOptionsFor, type HarnessSettingsApi } from "./harness-settings-parts.js";

function createApi(overrides: Partial<HarnessSettingsApi> = {}): HarnessSettingsApi {
  return {
    // A workspace defining none is the ordinary case, so that is what the
    // default mock answers, and a test about the picker overrides it.
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

const saveButton = () => screen.getByRole("button", { name: "Save global settings" });

describe("GlobalHarnessSettingsView", () => {
  it("loads and shows the global stepAgents recommendation on mount", async () => {
    const api = createApi();
    render(<GlobalHarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));
    expect(api.resolveGlobal).toHaveBeenCalledOnce();
  });

  it("saves the global config with the edited stepAgents and autonomyLevel", async () => {
    const api = createApi();
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.change(screen.getByLabelText("Global autonomy level"), { target: { value: "semi-autonomous" } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(api.writeGlobal).toHaveBeenCalledWith({
        stepAgents: { propose: "claude-cli", apply: "gemini-cli" },
        autonomyLevel: "semi-autonomous",
        // Carried from the loaded config rather than dropped: the writer
        // replaces the file. See settings-save-what-was-shown.
        reviewGate: { mode: "human-required" },
      }),
    );
  });

  it("edits the global file only, and has no section for a change", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    expect(screen.queryByLabelText("Change autonomy level")).toBeNull();
    expect(screen.queryByTestId("change-override-name-input")).toBeNull();
    expect(screen.queryByText("Load override")).toBeNull();
    expect(screen.getByTestId("global-harness-fields").textContent).toContain("openspec/agent-harness.json");
  });

  it("offers two autonomy levels and says where the third is set", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    const levels = [...(screen.getByLabelText("Global autonomy level") as HTMLSelectElement).querySelectorAll("option")]
      .map((option) => option.value);
    expect(levels).toEqual(["assisted", "semi-autonomous"]);
    expect(screen.getByTestId("global-autonomy-note").textContent).toBe(AUTONOMOUS_IS_PER_CHANGE);
  });

  it("shows archive and git as mechanical rows with no agent picker", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    expect(screen.queryByLabelText("archive agent")).toBeNull();
    expect(screen.queryByLabelText("git agent")).toBeNull();
    expect(screen.getAllByText("runs mechanically — no agent")).toHaveLength(2);
  });

  it("global stepAgents select has no inherit option (there is nothing to inherit from)", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    const options = [...(screen.getByLabelText("propose agent") as HTMLSelectElement).querySelectorAll("option")]
      .map((option) => option.textContent ?? "");
    expect(options.some((text) => text.startsWith("(inherit"))).toBe(false);
    expect(options).toContain("(none)");
  });

  it("shows a load-failure message instead of silently showing nothing", async () => {
    render(<GlobalHarnessSettingsView api={createApi({ resolveGlobal: vi.fn().mockRejectedValue(new Error("network down")) })} />);

    expect(await screen.findByText("Load failed: network down")).toBeInTheDocument();
  });

  // the-web-ui-screens-wear-metro 1.3: the section is a Metro panel with its
  // name in the title, and every field it holds keeps its own name.
  it("draws the fields as a panel titled by the section, with the fields unchanged", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    const section = screen.getByTestId("global-harness-fields");
    expect(section).toHaveClass("panel");
    const title = section.querySelector(".panel-title");
    // Metro's title bar lays out an `.icon` slot and a `.caption`; the name
    // outside a caption gets none of its padding (7.2).
    expect(title?.querySelector(".caption")?.textContent).toBe("Global harness settings");
    // The icon carries no accessible name of its own: the title beside it
    // is what a screen reader reads.
    expect(title?.querySelector(".icon [aria-hidden='true']")).not.toBeNull();
    expect(section.querySelector(".panel-content")).not.toBeNull();

    expect(screen.getByLabelText("propose agent")).toBeInTheDocument();
    expect(screen.getByLabelText("Global autonomy level")).toBeInTheDocument();
    expect(saveButton()).toBeInTheDocument();
  });
});

describe("GlobalHarnessSettingsView — a save offered when there is something to save", () => {
  it("disables save until a field changes, says there are unsaved changes, and settles after saving", async () => {
    const api = createApi();
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    expect(saveButton()).toBeDisabled();
    expect(screen.queryByTestId("global-harness-unsaved")).toBeNull();

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    expect(saveButton()).toBeEnabled();
    expect(screen.getByTestId("global-harness-unsaved").textContent).toBe("Unsaved changes");

    fireEvent.click(saveButton());
    await waitFor(() => expect(api.writeGlobal).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId("global-harness-unsaved")).toBeNull());
    expect(saveButton()).toBeDisabled();
  });
});

describe("GlobalHarnessSettingsView — effort and budget", () => {
  it("offers VS Code chat as a stage runner and hides effort/budget controls for it", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "vscode-chat" } });

    expect(screen.queryByLabelText("apply effort")).toBeNull();
    expect(screen.queryByLabelText("apply budget")).toBeNull();
  });

  it("offers only claude-cli's accepted effort values, and the maxCostUsd budget field", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "claude-cli" } });

    const options = [...(screen.getByLabelText("apply effort") as HTMLSelectElement).querySelectorAll("option")].map((o) => o.value);
    expect(options).toEqual(["", "low", "medium", "high", "xhigh", "max"]);
    expect(screen.getByLabelText("apply budget")).toBeInTheDocument();
  });

  it("saves effort and budget set on a stage as the object form", async () => {
    const api = createApi();
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "claude-cli" } });
    fireEvent.change(screen.getByLabelText("apply effort"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("apply budget"), { target: { value: "5" } });
    fireEvent.click(saveButton());

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
});

describe("GlobalHarnessSettingsView — what the configuration cannot do", () => {
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
    render(<GlobalHarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByTestId("harness-findings")).toBeTruthy());
    expect(screen.getByTestId("harness-finding-apply").textContent).toContain("reports tokens and no cost");
    expect(screen.getByTestId("harness-findings").textContent).toContain("will be saved");
  });

  it("renders nothing when every configured ceiling can act", async () => {
    const api = createApi({
      resolveGlobal: vi.fn().mockResolvedValue({
        stepAgents: { apply: "claude-cli-acp" },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
        budget: { maxCostUsd: 10 },
        timeout: { maxStageSeconds: 600 },
      }),
    });
    render(<GlobalHarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByLabelText("apply agent")).toHaveValue("claude-cli-acp"));
    expect(screen.queryByTestId("harness-findings")).toBeNull();
  });
});

describe("GlobalHarnessSettingsView — a named configuration", () => {
  it("offers globally exactly what may be written globally", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    const offered = [...(screen.getByLabelText("Named configuration") as HTMLSelectElement).querySelectorAll("option")]
      .map((option) => option.value);
    expect(offered).toEqual(templatesForScope("global").map((template) => template.id));
  });

  it("fills the form without saving, and says so beside the Apply button", async () => {
    const api = createApi();
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("Named configuration"), { target: { value: "economy" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(screen.getByTestId("global-harness-named-configuration-status").textContent).toContain("Nothing is saved"),
    );
    expect(api.writeGlobal).not.toHaveBeenCalled();
    // Applying is a change to what is on screen, so it is a change to save.
    expect(saveButton()).toBeEnabled();
  });
});

describe("GlobalHarnessSettingsView — saving preserves what it cannot show", () => {
  // settings-save-what-was-shown. Both writers replace the file, so a key
  // this view has no field for is deleted by pressing Save. Asserted
  // against TOP_LEVEL_CONFIG_KEYS so the next key added is covered.
  it("keeps every accepted key when saving the global config", async () => {
    const everyKey = {
      stepAgents: { propose: "claude-cli" },
      autonomyLevel: "assisted",
      reviewGate: { mode: "human-required" },
      checkpoints: { requireConfirmationBetweenSteps: false },
      budget: { maxCostUsd: 25 },
      timeout: { maxRunSeconds: 14400, maxStageSeconds: 3600 },
      maxStageAttempts: 2,
      gitStageAllowlist: ["openspec/**"],
      taskAgents: { "5.4": { agent: "copilot-cli", customAgent: "reviewer" } },
      steps: [{ step: "await-change", before: "verify", param: "the-other-change" }],
      hints: { enabled: false },
    };
    const api = createApi({ resolveGlobal: vi.fn().mockResolvedValue(everyKey) });
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeGlobal).toHaveBeenCalled());
    const saved = (api.writeGlobal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Record<string, unknown>;
    expect(TOP_LEVEL_CONFIG_KEYS.filter((key) => !(key in saved))).toEqual([]);
    expect(saved.stepAgents).toMatchObject({ apply: "gemini-cli" });
    expect(saved.timeout).toEqual(everyKey.timeout);
    expect(saved.gitStageAllowlist).toEqual(everyKey.gitStageAllowlist);
  });
});

describe("GlobalHarnessSettingsView — custom agents", () => {
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
    render(<GlobalHarnessSettingsView api={createApi(withAgents())} />);

    const select = await screen.findByLabelText("propose custom agent");
    expect([...select.querySelectorAll("option")].map((option) => option.getAttribute("value"))).toEqual(["", "reviewer"]);
    expect(select.textContent).toContain("Reviews against the spec");
  });

  it("says the CLI takes none rather than showing an empty control", async () => {
    render(<GlobalHarnessSettingsView api={createApi(withAgents())} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });

    expect(screen.queryByLabelText("apply custom agent")).toBeNull();
    expect(screen.getByTestId("custom-agent-none-apply").textContent).toContain("takes no custom agent");
  });

  it("says where definitions are read from when the workspace defines none", async () => {
    render(<GlobalHarnessSettingsView api={createApi()} />);

    const empty = await screen.findByTestId("custom-agent-empty-propose");
    expect(empty.textContent).toContain(".claude/agents");
  });

  it("keeps a configured name the discovery no longer finds, marked as such", async () => {
    const api = createApi({
      ...withAgents(),
      resolveGlobal: vi.fn().mockResolvedValue({
        stepAgents: { propose: { agent: "claude-cli", customAgent: "deleted-one" } },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    });
    render(<GlobalHarnessSettingsView api={api} />);

    await waitFor(() => expect(screen.getByLabelText("propose custom agent")).toHaveValue("deleted-one"));
    expect(screen.getByLabelText("propose custom agent").textContent).toContain("not found");
  });

  it("saves the chosen name as that stage's custom agent, keeping its other fields", async () => {
    const api = createApi({
      ...withAgents(),
      resolveGlobal: vi.fn().mockResolvedValue({
        // A model this form has no control for. Saving used to delete it.
        stepAgents: { propose: { agent: "claude-cli", model: "some-model", effort: "high" } },
        autonomyLevel: "assisted",
        reviewGate: { mode: "human-required" },
      }),
    });
    render(<GlobalHarnessSettingsView api={api} />);

    fireEvent.change(await screen.findByLabelText("propose custom agent"), { target: { value: "reviewer" } });
    fireEvent.click(saveButton());

    await waitFor(() => expect(api.writeGlobal).toHaveBeenCalled());
    const saved = (api.writeGlobal as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { stepAgents: Record<string, unknown> };
    expect(saved.stepAgents.propose).toEqual({ agent: "claude-cli", model: "some-model", effort: "high", customAgent: "reviewer" });
  });
});

describe("GlobalHarnessSettingsView — a host that never answers", () => {
  // The bridge rejects a request nobody replied to, after a stated
  // interval (see bridge-request.ts). See a-check-that-passes-checked-something.
  it("shows the reason a save got no answer, and re-enables the save button", async () => {
    const api = createApi({
      writeGlobal: vi.fn().mockRejectedValue(new Error("the host did not reply within 10 seconds to harness/write-global")),
    });
    render(<GlobalHarnessSettingsView api={api} />);
    await waitFor(() => expect(screen.getByLabelText("propose agent")).toHaveValue("claude-cli"));

    fireEvent.change(screen.getByLabelText("apply agent"), { target: { value: "gemini-cli" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/write-global/u)).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it("shows the reason a load got no answer rather than an empty form", async () => {
    const api = createApi({
      resolveGlobal: vi.fn().mockRejectedValue(new Error("the host did not reply within 10 seconds to harness/resolve-global")),
    });
    render(<GlobalHarnessSettingsView api={api} />);

    expect(await screen.findByText(/did not reply within 10 seconds to harness\/resolve-global/u)).toBeInTheDocument();
  });
});

describe("autonomy level options", () => {
  it("names every level by what it does, and claims nothing about implementation", () => {
    for (const scope of ["global", "change"] as const) {
      for (const option of autonomyLevelOptionsFor(scope)) {
        expect(option.label).not.toContain("not yet implemented");
        expect(option.label).toContain("—");
      }
    }
  });

  it("offers exactly what core says the scope accepts, so the two cannot drift", () => {
    for (const scope of ["global", "change"] as const) {
      expect(autonomyLevelOptionsFor(scope).map((option) => option.value)).toEqual([...autonomyLevelsFor(scope)]);
    }
  });
});
