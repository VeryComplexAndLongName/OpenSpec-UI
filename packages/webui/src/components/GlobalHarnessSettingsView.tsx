import { useEffect, useId, useMemo, useState } from "react";
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
import { SegmentedChoice } from "./SegmentedChoice.js";
import {
  AgentSelect,
  autonomyLevelOptionsFor,
  autonomyLevelParts,
  BudgetInput,
  StageNotes,
  CustomAgentSelect,
  describeFailure,
  EffortSelect,
  effortFormFor,
  globalConfigToSave,
  HarnessFindingsPanel,
  MechanicalStageRow,
  ModelInput,
  runBudgetFrom,
  SettingsFoot,
  StageRow,
  stageFormsFrom,
  StageTable,
  STAGES,
  templateAppliedMessage,
  type HarnessSettingsApi,
  type StageForms,
} from "./harness-settings-parts.js";

// The global file, `openspec/agent-harness.json`, and nothing else. A
// change's own settings are edited from that change — see
// ChangeHarnessSettingsView and a-change-is-configured-from-the-change.
//
// Laid out as ADR 0033's mockup draws Harness Settings
// (the-harness-settings-look-like-the-mockup): the named configuration, what
// the configuration cannot do, then one panel holding a row per stage, the
// autonomy level, review gate and run budget side by side, and Save and
// Discard at its foot.

/** Said beside the autonomy level, because the level this file cannot
 * carry is the one a person is most likely to be looking for. */
export const AUTONOMOUS_IS_PER_CHANGE =
  "Autonomous — a chain with no confirmations — is set for a single change, in that change's harness settings.";

function snapshotOf(config: HarnessConfig | null, forms: StageForms, autonomyLevel: HarnessAutonomyLevel, runBudget: string): string {
  return JSON.stringify(globalConfigToSave(config, forms, autonomyLevel, runBudget));
}

export function GlobalHarnessSettingsView({
  api,
  onReadingChange,
  showFile = false,
}: {
  api: HarnessSettingsApi;
  /** What this view is reading or saving, or `null` once it has settled, for
   * the shell's status line and tab spinner (a-screen-says-what-it-is-doing). */
  onReadingChange?: (reading: string | null) => void;
  /** Shows the JSON Save would write, under the settings. */
  showFile?: boolean;
}) {
  const [config, setConfig] = useState<HarnessConfig | null>(null);
  const [forms, setForms] = useState<StageForms>(stageFormsFrom(undefined));
  const [autonomyLevel, setAutonomyLevel] = useState<HarnessAutonomyLevel>("assisted");
  const [runBudget, setRunBudget] = useState("");
  /** What the workspace defines, or `null` while it has not been read.
   * Null renders no picker at all rather than an empty one. */
  const [customAgents, setCustomAgents] = useState<CustomAgentsResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const loading = reading !== null;
  /** What was last loaded or saved, in the shape a save would write. The
   * save is offered only when the form differs from it. */
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const runBudgetId = useId();

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

  const dirty = savedSnapshot !== null && snapshotOf(config, forms, autonomyLevel, runBudget) !== savedSnapshot;

  useEffect(() => { onReadingChange?.(reading); }, [reading, onReadingChange]);

  async function load() {
    setReading("Reading the harness settings…");
    try {
      const loaded = await api.resolveGlobal();
      const loadedForms = stageFormsFrom(loaded.stepAgents);
      const loadedBudget = runBudgetFrom(loaded);
      setConfig(loaded);
      setForms(loadedForms);
      setAutonomyLevel(loaded.autonomyLevel);
      setRunBudget(loadedBudget);
      setSavedSnapshot(snapshotOf(loaded, loadedForms, loaded.autonomyLevel, loadedBudget));
      setApplyStatus(null);
      setMessage(null);
    } catch (error) {
      setMessage(describeFailure("Load", error));
    } finally {
      setReading(null);
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
    if (template.config.budget?.maxCostUsd !== undefined) setRunBudget(String(template.config.budget.maxCostUsd));
    // The ceilings ride on the loaded config, which is what the findings
    // read and what the save lays the form over.
    setConfig((previous) => ({ ...(previous ?? { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } }), ...template.config }));
    setApplyStatus(templateAppliedMessage(template, effort, forms.agents));
  };

  async function save() {
    setReading("Saving the harness settings…");
    try {
      await api.writeGlobal(globalConfigToSave(config, forms, autonomyLevel, runBudget));
      await load();
      setMessage("Saved.");
    } catch (error) {
      setMessage(describeFailure("Save", error));
      setReading(null);
    }
  }

  const level = autonomyLevelParts(autonomyLevel);
  const gate = config?.reviewGate.mode ?? "human-required";

  return (
    <div className="openspec-harness-settings" data-testid="global-harness-settings">
      <NamedConfigurationPicker
        scope="global"
        onApply={applyTemplate}
        status={applyStatus}
        note="Nothing is saved until you save."
        testIdPrefix="global-harness"
        applyLabel="Apply to the form"
      />
      <HarnessFindingsPanel findings={findings} />
      <section className="openspec-panel openspec-harness-section" data-testid="global-harness-fields">
        <div className="openspec-panel-head openspec-panel-head--icon">
          <span className="openspec-panel-head-icon"><Icon meaning="settings" /></span>
          <h2>Global harness settings</h2>
          <span className="openspec-panel-head-note">Recommends an agent per stage — never enforces one</span>
        </div>
        <StageTable>
          {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
            <MechanicalStageRow key={stage} stage={stage} />
          ) : (
            <StageRow key={stage} stage={stage}>
              <AgentSelect
                ariaLabel={`${stage} agent`}
                value={forms.agents[stage]}
                onChange={(value) => setStage("agents", stage, value)}
                emptyLabel="(none)"
              >
                <CustomAgentSelect
                  stage={stage}
                  agentId={forms.agents[stage]}
                  ariaLabel={`${stage} custom agent`}
                  value={forms.customAgent[stage]}
                  onChange={(value) => setStage("customAgent", stage, value)}
                  available={customAgents}
                />
              </AgentSelect>
              <ModelInput
                agentId={forms.agents[stage]}
                ariaLabel={`${stage} model`}
                value={forms.model[stage]}
                onChange={(value) => setStage("model", stage, value)}
              />
              <EffortSelect
                agentId={forms.agents[stage]}
                ariaLabel={`${stage} effort`}
                value={forms.effort[stage]}
                onChange={(value) => setStage("effort", stage, value)}
              />
              <BudgetInput
                agentId={forms.agents[stage]}
                ariaLabel={`${stage} budget`}
                value={forms.budget[stage]}
                onChange={(value) => setStage("budget", stage, value)}
              />
            </StageRow>
          )))}
        </StageTable>
        <StageNotes agents={forms.agents} available={customAgents} />
        <div className="openspec-harness-band">
          <div className="openspec-harness-band-item">
            <span className="openspec-harness-band-label" aria-hidden="true">Autonomy level</span>
            <SegmentedChoice
              label="Global autonomy level"
              value={autonomyLevel}
              onChange={setAutonomyLevel}
              options={autonomyLevelOptionsFor("global").map((option) => ({
                value: option.value,
                label: autonomyLevelParts(option.value).name,
              }))}
            />
            <p className="openspec-harness-band-note">
              {`${level.does}. `}
              <span data-testid="global-autonomy-note">{AUTONOMOUS_IS_PER_CHANGE}</span>
            </p>
          </div>
          <div className="openspec-harness-band-item">
            <span className="openspec-harness-band-label">Review gate</span>
            <span className="badge openspec-harness-gate" data-testid="global-review-gate">{gate.replace("-", " ")}</span>
            <p className="openspec-harness-band-note">
              Fixed for the whole workspace — only a change's own settings can relax it.
            </p>
          </div>
          <div className="openspec-harness-band-item">
            <label className="openspec-harness-band-label" htmlFor={runBudgetId}>Run budget, in dollars</label>
            <span className="openspec-amount openspec-amount--dollars">
              <span className="openspec-amount-unit" aria-hidden="true">$</span>
              <input
                id={runBudgetId}
                type="number"
                min={0}
                step="any"
                aria-label="Global run budget"
                placeholder="no ceiling"
                value={runBudget}
                onChange={(e) => setRunBudget(e.target.value)}
              />
            </span>
            {/* The unit is in the label and the reason is here: an agent
                billed in credits is bounded by a ceiling in credits, and
                that one is set in the file (a-run-budget-has-a-unit). */}
            <p className="openspec-harness-band-note">
              A chain stops when its reported cost in dollars reaches this. An agent billed in
              another unit takes a ceiling in that unit, set as `budget.maxCost` in the
              configuration file.
            </p>
          </div>
        </div>
        <SettingsFoot
          saveLabel="Save global settings"
          onSave={() => void save()}
          onDiscard={() => void load()}
          loading={loading}
          dirty={dirty}
          message={message}
          testIdPrefix="global-harness"
        >
          {/* Named, because this view is a way to edit the file and not a
              replacement for it: whoever wants the JSON should not have to
              hunt for it. */}
          Saved to <code>openspec/agent-harness.json</code>, which stays hand-editable
          {config ? null : <span data-testid="global-harness-defaults"> — no global config yet, so the documented defaults apply</span>}
        </SettingsFoot>
      </section>
      {showFile ? (
        <section className="openspec-panel openspec-harness-file" data-testid="global-harness-file">
          <div className="openspec-panel-head">
            <h2>openspec/agent-harness.json</h2>
            <span className="openspec-panel-head-note">As Save would write it</span>
          </div>
          <pre>{JSON.stringify(globalConfigToSave(config, forms, autonomyLevel, runBudget), null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
