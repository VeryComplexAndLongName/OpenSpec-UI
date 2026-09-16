import { useEffect, useMemo, useState } from "react";
import {
  findHarnessConfigLimits,
  isHarnessStepAgentStage,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessFinding,
  type HarnessStepAgents,
  type HarnessTemplate,
} from "@openspec-ui/core/browser";
import type { CustomAgentsResult } from "../custom-agents-client.js";
import { Icon } from "./Icon.js";
import { NamedConfigurationPicker } from "./NamedConfigurationPicker.js";
import {
  AgentSelect,
  autonomyLevelOptionsFor,
  BudgetInput,
  CustomAgentSelect,
  describeFailure,
  EffortSelect,
  effortFormFor,
  globalConfigToSave,
  HarnessFindingsPanel,
  MechanicalStageRow,
  stageFormsFrom,
  STAGES,
  templateAppliedMessage,
  type HarnessSettingsApi,
  type StageForms,
} from "./harness-settings-parts.js";

// The global file, `openspec/agent-harness.json`, and nothing else. A
// change's own settings are edited from that change — see
// ChangeHarnessSettingsView and a-change-is-configured-from-the-change.

/** Said beside the autonomy level, because the level this file cannot
 * carry is the one a person is most likely to be looking for. */
export const AUTONOMOUS_IS_PER_CHANGE =
  "autonomous — a chain with no confirmations — is set for a single change, in that change's harness settings.";

function snapshotOf(config: HarnessConfig | null, forms: StageForms, autonomyLevel: HarnessAutonomyLevel): string {
  return JSON.stringify(globalConfigToSave(config, forms, autonomyLevel));
}

export function GlobalHarnessSettingsView({ api }: { api: HarnessSettingsApi }) {
  const [config, setConfig] = useState<HarnessConfig | null>(null);
  const [forms, setForms] = useState<StageForms>(stageFormsFrom(undefined));
  const [autonomyLevel, setAutonomyLevel] = useState<HarnessAutonomyLevel>("assisted");
  /** What the workspace defines, or `null` while it has not been read.
   * Null renders no picker at all rather than an empty one. */
  const [customAgents, setCustomAgents] = useState<CustomAgentsResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** What was last loaded or saved, in the shape a save would write. The
   * save is offered only when the form differs from it. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  const setStage = (field: keyof StageForms, stage: string, value: string) =>
    setForms((previous) => ({ ...previous, [field]: { ...previous[field], [stage]: value } }));

  // Recomputed as the operator changes an agent, not only on load: the
  // warning has to appear while the choice is being made.
  const findings = useMemo<HarnessFinding[]>(() => {
    if (!config) return [];
    const stepAgents: HarnessStepAgents = {};
    for (const stage of STAGES) {
      if (!isHarnessStepAgentStage(stage)) continue;
      const agent = forms.agents[stage];
      if (agent) stepAgents[stage] = agent;
    }
    return findHarnessConfigLimits({ ...config, stepAgents });
  }, [config, forms.agents]);

  const dirty = savedSnapshot !== null && snapshotOf(config, forms, autonomyLevel) !== savedSnapshot;

  async function load() {
    setLoading(true);
    try {
      const loaded = await api.resolveGlobal();
      const loadedForms = stageFormsFrom(loaded.stepAgents);
      setConfig(loaded);
      setForms(loadedForms);
      setAutonomyLevel(loaded.autonomyLevel);
      setSavedSnapshot(snapshotOf(loaded, loadedForms, loaded.autonomyLevel));
      setMessage(null);
    } catch (error) {
      setMessage(describeFailure("Load", error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  useEffect(() => {
    // Read once, beside the config. A definition is a file on disk; it
    // does not change while a form is open.
    let cancelled = false;
    void (async () => {
      try {
        const found = await api.listCustomAgents();
        if (!cancelled) setCustomAgents(found);
      } catch {
        // A host that cannot read them offers no picker rather than an
        // empty one. Not a failure of the settings form, which loaded.
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  /** Fills the form from a named configuration rather than writing the
   * file, so the findings recompute and the choice can be adjusted before
   * it is saved. The agents on screen are left alone: a named
   * configuration chooses an effort, not who runs the stage. */
  const applyTemplate = (template: HarnessTemplate): void => {
    const effort = effortFormFor(template.effortLevel, forms.agents);
    setForms((previous) => ({ ...previous, effort }));
    if (template.config.autonomyLevel) setAutonomyLevel(template.config.autonomyLevel);
    // The ceilings ride on the loaded config, which is what the findings
    // read and what the save lays the form over.
    setConfig((previous) => ({ ...(previous ?? { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } }), ...template.config }));
    setApplyStatus(templateAppliedMessage(template, effort, forms.agents));
  };

  async function save() {
    setLoading(true);
    try {
      await api.writeGlobal(globalConfigToSave(config, forms, autonomyLevel));
      await load();
      setMessage("Saved.");
    } catch (error) {
      setMessage(describeFailure("Save", error));
      setLoading(false);
    }
  }

  return (
    <div className="openspec-harness-settings" data-testid="global-harness-settings">
      <HarnessFindingsPanel findings={findings} />
      {message ? <p className="openspec-shell-note" role="status" data-testid="global-harness-message">{message}</p> : null}
      <NamedConfigurationPicker
        scope="global"
        onApply={applyTemplate}
        status={applyStatus}
        note="Applying one fills the fields below; nothing is saved until you save."
        testIdPrefix="global-harness"
      />
      <section className="panel openspec-harness-section" data-testid="global-harness-fields">
        <div className="panel-title">
          <span className="icon"><Icon meaning="settings" /></span>
          <span className="caption">Global harness settings</span>
        </div>
        <div className="panel-content">
        <p className="openspec-shell-note">
          Applies to every change that does not set its own. Recommends an agent per stage — never enforces one.
        </p>
        {/* Named, because this view is a way to edit the file and not a
            replacement for it: whoever wants the JSON should not have to
            hunt for it. */}
        <p className="openspec-shell-note">
          Saved to <code>openspec/agent-harness.json</code>, which stays hand-editable.
        </p>
        {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
          <MechanicalStageRow key={stage} stage={stage} />
        ) : (
          <div key={stage} className="openspec-harness-stage-row">
            <AgentSelect
              stage={stage}
              ariaLabel={`${stage} agent`}
              value={forms.agents[stage]}
              onChange={(value) => setStage("agents", stage, value)}
              emptyLabel="(none)"
            />
            <EffortSelect
              stage={stage}
              agentId={forms.agents[stage]}
              ariaLabel={`${stage} effort`}
              value={forms.effort[stage]}
              onChange={(value) => setStage("effort", stage, value)}
            />
            <BudgetInput
              stage={stage}
              agentId={forms.agents[stage]}
              ariaLabel={`${stage} budget`}
              value={forms.budget[stage]}
              onChange={(value) => setStage("budget", stage, value)}
            />
            <CustomAgentSelect
              stage={stage}
              agentId={forms.agents[stage]}
              ariaLabel={`${stage} custom agent`}
              value={forms.customAgent[stage]}
              onChange={(value) => setStage("customAgent", stage, value)}
              available={customAgents}
            />
          </div>
        )))}
        <label className="openspec-shell-field">
          Autonomy level
          <select
            aria-label="Global autonomy level"
            value={autonomyLevel}
            onChange={(e) => setAutonomyLevel(e.target.value as HarnessAutonomyLevel)}
          >
            {autonomyLevelOptionsFor("global").map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="openspec-shell-note" data-testid="global-autonomy-note">{AUTONOMOUS_IS_PER_CHANGE}</p>
        <p className="openspec-shell-note">
          Review gate: <strong>human-required</strong> (fixed for the whole workspace — only a change's own settings
          can relax it).
        </p>
        <div className="openspec-ai-panel-controls">
          <button type="button" className="button primary" onClick={() => void save()} disabled={loading || !dirty}>
            {loading ? "Working..." : "Save global settings"}
          </button>
          {dirty ? <span className="openspec-shell-note" data-testid="global-harness-unsaved">Unsaved changes</span> : null}
        </div>
        {config ? null : <p className="openspec-shell-note">No global config yet — using documented defaults.</p>}
        </div>
      </section>
    </div>
  );
}
