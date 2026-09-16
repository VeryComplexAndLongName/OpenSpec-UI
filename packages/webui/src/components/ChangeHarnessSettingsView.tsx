import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  changeTemplateConfigToWrite,
  findHarnessConfigLimits,
  isHarnessStepAgentStage,
  mergeStepAgents,
  normalizeStepAgent,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessFinding,
  type HarnessReviewGateMode,
  type HarnessStepAgentStage,
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
  changeConfigToSave,
  changeTemplateAppliedMessage,
  CONFIGURABLE_STAGES,
  StageNotes,
  CustomAgentSelect,
  describeFailure,
  EffortSelect,
  HarnessFindingsPanel,
  INHERIT,
  MechanicalStageRow,
  ModelInput,
  NO_GLOBAL_CONFIG,
  runBudgetFrom,
  SettingsFoot,
  StageRow,
  stageFormsFrom,
  StageTable,
  stepAgentsFromForms,
  STAGES,
  toForm,
  type HarnessSettingsApi,
  type StageForms,
} from "./harness-settings-parts.js";

// One change's own `harness.json`, opened from that change.
//
// Its name is a prop and is read as the prop. The view this replaces
// copied the name into state once, when it mounted, and then read the
// copy: a panel that learned the name a moment after mounting loaded
// nothing, and showed an empty field and no settings to the person who
// had just right-clicked the change. See a-change-is-configured-from-the-change.
//
// Laid out as the global view is (the-harness-settings-look-like-the-
// mockup), with every choice able to inherit and saying what it inherits.

const FROM_GLOBAL = "from the global file";

const REVIEW_GATE_NAMES: Readonly<Record<HarnessReviewGateMode, string>> = {
  "human-required": "Human required",
  "agent-sufficient": "Agent sufficient",
};

type Loaded = { global: HarnessConfig; override: Partial<HarnessConfig> | null };

function snapshotOf(
  override: Partial<HarnessConfig> | null | undefined,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel | "",
  reviewGateMode: HarnessReviewGateMode | "",
  runBudget: string,
): string {
  return JSON.stringify(changeConfigToSave(override, forms, autonomyLevel, reviewGateMode, runBudget));
}

export function ChangeHarnessSettingsView(
  { api, changeName, onEditGlobal }: {
    api: HarnessSettingsApi;
    changeName: string;
    /** Where the global defaults are edited, in this host. Absent, no
     * control is offered for it. */
    onEditGlobal?: () => void;
  },
) {
  const [global, setGlobal] = useState<HarnessConfig | null>(null);
  /** `undefined` while nothing has been read for this change; `null` when
   * the change has no file of its own. */
  const [override, setOverride] = useState<Partial<HarnessConfig> | null | undefined>(undefined);
  const [forms, setForms] = useState<StageForms>(stageFormsFrom(undefined));
  const [autonomyLevel, setAutonomyLevel] = useState<HarnessAutonomyLevel | "">(INHERIT);
  const [reviewGateMode, setReviewGateMode] = useState<HarnessReviewGateMode | "">(INHERIT);
  const [runBudget, setRunBudget] = useState("");
  const [customAgents, setCustomAgents] = useState<CustomAgentsResult | null>(null);
  const runBudgetId = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  /** Which reading is current. A reply for a change this view has since
   * moved away from sets nothing. */
  const reading = useRef(0);

  const setStage = (field: keyof StageForms, stage: string, value: string) =>
    setForms((previous) => ({ ...previous, [field]: { ...previous[field], [stage]: value } }));

  function show({ global: base, override: own }: Loaded) {
    const loadedForms = stageFormsFrom(own?.stepAgents);
    const level = own?.autonomyLevel ?? INHERIT;
    const gate = own?.reviewGate?.mode ?? INHERIT;
    const budget = runBudgetFrom(own);
    setGlobal(base);
    setOverride(own);
    setForms(loadedForms);
    setAutonomyLevel(level);
    setReviewGateMode(gate);
    setRunBudget(budget);
    setSavedSnapshot(snapshotOf(own, loadedForms, level, gate, budget));
    setApplyStatus(null);
  }

  /** Reads the change again, for the first time or to discard what is on
   * screen. A reply for a change this view has since moved away from sets
   * nothing. */
  async function reload(name: string) {
    const current = ++reading.current;
    setMessage(null);
    setLoading(true);
    try {
      const loaded = await read(name);
      if (reading.current === current) show(loaded);
    } catch (error) {
      if (reading.current === current) setMessage(describeFailure("Load", error));
    } finally {
      if (reading.current === current) setLoading(false);
    }
  }

  async function read(name: string): Promise<Loaded> {
    const [base, own] = await Promise.all([api.resolveGlobal(), api.readChangeOverride(name)]);
    return { global: base, override: own };
  }

  useEffect(() => {
    setOverride(undefined);
    void reload(changeName);
  }, [api, changeName]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await api.listCustomAgents();
        if (!cancelled) setCustomAgents(found);
      } catch {
        // No picker rather than an empty one; the form itself loaded.
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const base = global ?? NO_GLOBAL_CONFIG;
  /** What each stage runs once this change's own entries are laid over
   * the global file — what "inherit" resolves to, said on each field. */
  const resolvedStepAgents = useMemo(
    () => mergeStepAgents(base.stepAgents, stepAgentsFromForms(forms)),
    [base, forms],
  );
  const inheritedAgent = (stage: HarnessStepAgentStage): string => {
    const entry = base.stepAgents[stage];
    return entry === undefined
      ? "(inherit: no agent set in the global file)"
      : `(inherit: ${normalizeStepAgent(entry).agent}, ${FROM_GLOBAL})`;
  };
  const inheritedField = (stage: HarnessStepAgentStage, field: "effort" | "customAgent"): string => {
    const entry = resolvedStepAgents[stage];
    const value = entry === undefined ? undefined : normalizeStepAgent(entry)[field];
    return value === undefined ? "(none)" : `(inherit: ${value}, ${FROM_GLOBAL})`;
  };
  const inheritedModel = (stage: HarnessStepAgentStage): string | undefined => {
    const entry = resolvedStepAgents[stage];
    const value = entry === undefined ? undefined : normalizeStepAgent(entry).model;
    return value === undefined ? undefined : `inherits ${value}`;
  };
  const globalRunBudget = runBudgetFrom(base);
  const inheritedBudget = (stage: HarnessStepAgentStage): string | undefined => {
    const entry = resolvedStepAgents[stage];
    const budget = entry === undefined ? undefined : normalizeStepAgent(entry).budget;
    const value = budget?.maxCostUsd ?? budget?.maxAiCredits;
    return value === undefined ? undefined : `inherits ${value}`;
  };

  const findings = useMemo<HarnessFinding[]>(() => {
    if (!global || override === undefined) return [];
    const { stepAgents: _own, ...ownRest } = override ?? {};
    return findHarnessConfigLimits({ ...global, ...ownRest, stepAgents: resolvedStepAgents });
  }, [global, override, resolvedStepAgents]);

  const dirty = savedSnapshot !== null && override !== undefined
    && snapshotOf(override, forms, autonomyLevel, reviewGateMode, runBudget) !== savedSnapshot;

  /** Applies a named configuration against what the change resolves to,
   * through the one core function every surface applies one through, and
   * fills the form. Nothing is written until the save. See
   * a-stage-override-keeps-its-custom-agent. */
  const applyTemplate = (template: HarnessTemplate): void => {
    const written = changeTemplateConfigToWrite(template, base, override ?? undefined);
    const writtenForms = stageFormsFrom(written.stepAgents);
    const resolvedAgents = toForm(mergeStepAgents(base.stepAgents, override?.stepAgents));
    const reset = CONFIGURABLE_STAGES.filter((stage) => forms.agents[stage] !== writtenForms.agents[stage]);
    setForms(writtenForms);
    if (written.autonomyLevel) setAutonomyLevel(written.autonomyLevel);
    if (written.reviewGate) setReviewGateMode(written.reviewGate.mode);
    if (written.budget?.maxCostUsd !== undefined) setRunBudget(String(written.budget.maxCostUsd));
    // The ceilings ride here, not in the form, and the save lays the form
    // over this rather than replacing it.
    setOverride(written);
    setApplyStatus(changeTemplateAppliedMessage(template, writtenForms.effort, resolvedAgents, reset));
  };

  async function save() {
    setLoading(true);
    try {
      await api.writeChangeOverride(changeName, changeConfigToSave(override, forms, autonomyLevel, reviewGateMode, runBudget));
      show(await read(changeName));
      setMessage("Saved.");
    } catch (error) {
      setMessage(describeFailure("Save", error));
    } finally {
      setLoading(false);
    }
  }

  const inheritedLevel = autonomyLevelParts(base.autonomyLevel);
  const shownLevel = autonomyLevel === INHERIT ? inheritedLevel : autonomyLevelParts(autonomyLevel);

  return (
    <div className="openspec-harness-settings" data-testid="change-harness-settings">
      {override === undefined ? (
        <>
          {loading ? <p className="openspec-shell-note" data-testid="change-harness-loading">Reading the settings of {changeName}…</p> : null}
          {message ? <p className="openspec-shell-note" role="status" data-testid="change-harness-message">{message}</p> : null}
        </>
      ) : (
        <>
          <NamedConfigurationPicker
            scope="change"
            onApply={applyTemplate}
            status={applyStatus}
            note="Nothing is saved until you save."
            testIdPrefix="change-harness"
            applyLabel="Apply to the form"
          />
          <HarnessFindingsPanel findings={findings} />
          <section className="openspec-panel openspec-harness-section" data-testid="change-harness-fields">
            <div className="openspec-panel-head openspec-panel-head--icon">
              <span className="openspec-panel-head-icon"><Icon meaning="settings" /></span>
              <h2>{changeName}</h2>
              <span className="openspec-panel-head-note">
                What this change sets for itself; a field left to inherit says what it takes from the global file
              </span>
            </div>
            <StageTable>
              {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
                <MechanicalStageRow key={stage} stage={stage} />
              ) : (
                <StageRow key={stage} stage={stage}>
                  <AgentSelect
                    ariaLabel={`change ${stage} agent`}
                    value={forms.agents[stage]}
                    onChange={(value) => setStage("agents", stage, value)}
                    emptyLabel={inheritedAgent(stage)}
                  >
                    <CustomAgentSelect
                      stage={stage}
                      agentId={forms.agents[stage]}
                      ariaLabel={`change ${stage} custom agent`}
                      value={forms.customAgent[stage]}
                      onChange={(value) => setStage("customAgent", stage, value)}
                      available={customAgents}
                      emptyLabel={inheritedField(stage, "customAgent")}
                    />
                  </AgentSelect>
                  <ModelInput
                    agentId={forms.agents[stage]}
                    ariaLabel={`change ${stage} model`}
                    value={forms.model[stage]}
                    onChange={(value) => setStage("model", stage, value)}
                    inherits
                    {...(inheritedModel(stage) ? { placeholder: inheritedModel(stage) } : {})}
                  />
                  <EffortSelect
                    agentId={forms.agents[stage]}
                    ariaLabel={`change ${stage} effort`}
                    value={forms.effort[stage]}
                    onChange={(value) => setStage("effort", stage, value)}
                    emptyLabel={inheritedField(stage, "effort")}
                    inherits
                  />
                  <BudgetInput
                    agentId={forms.agents[stage]}
                    ariaLabel={`change ${stage} budget`}
                    value={forms.budget[stage]}
                    onChange={(value) => setStage("budget", stage, value)}
                    inherits
                    {...(inheritedBudget(stage) ? { placeholder: inheritedBudget(stage) } : {})}
                  />
                </StageRow>
              )))}
            </StageTable>
            <StageNotes agents={forms.agents} available={customAgents} />
            <div className="openspec-harness-band">
              <div className="openspec-harness-band-item">
                <span className="openspec-harness-band-label" aria-hidden="true">Autonomy level</span>
                <SegmentedChoice
                  label="Change autonomy level"
                  value={autonomyLevel}
                  onChange={setAutonomyLevel}
                  options={[
                    // What is inherited is said in the note under the choice,
                    // where it has room; the segment names the choice.
                    { value: INHERIT, label: "Inherit", title: `${base.autonomyLevel}, ${FROM_GLOBAL}` },
                    ...autonomyLevelOptionsFor("change").map((option) => ({
                      value: option.value,
                      label: autonomyLevelParts(option.value).name,
                    })),
                  ]}
                />
                <p className="openspec-harness-band-note" data-testid="change-autonomy-note">
                  {autonomyLevel === INHERIT
                    ? `${inheritedLevel.name}, ${FROM_GLOBAL}: ${inheritedLevel.does.charAt(0).toLowerCase()}${inheritedLevel.does.slice(1)}.`
                    : `${shownLevel.does}.`}
                </p>
              </div>
              <div className="openspec-harness-band-item">
                <span className="openspec-harness-band-label" aria-hidden="true">Review gate</span>
                <SegmentedChoice
                  label="Change review gate mode"
                  value={reviewGateMode}
                  onChange={setReviewGateMode}
                  options={[
                    { value: INHERIT, label: "Inherit", title: `${base.reviewGate.mode}, ${FROM_GLOBAL}` },
                    { value: "human-required", label: REVIEW_GATE_NAMES["human-required"] },
                    { value: "agent-sufficient", label: REVIEW_GATE_NAMES["agent-sufficient"] },
                  ]}
                />
                <p className="openspec-harness-band-note" data-testid="change-review-gate-note">
                  {reviewGateMode === INHERIT
                    ? `${base.reviewGate.mode}, ${FROM_GLOBAL}.`
                    : "Only a change's own settings can relax the gate."}
                </p>
              </div>
              <div className="openspec-harness-band-item">
                <label className="openspec-harness-band-label" htmlFor={runBudgetId}>Run budget</label>
                <span className="openspec-amount openspec-amount--dollars">
                  <span className="openspec-amount-unit" aria-hidden="true">$</span>
                  <input
                    id={runBudgetId}
                    type="number"
                    min={0}
                    step="any"
                    aria-label="Change run budget"
                    placeholder={globalRunBudget === INHERIT ? "no ceiling" : `inherits ${globalRunBudget}`}
                    value={runBudget}
                    onChange={(e) => setRunBudget(e.target.value)}
                  />
                </span>
                <p className="openspec-harness-band-note" data-testid="change-run-budget-note">
                  {runBudget.trim() === ""
                    ? (globalRunBudget === INHERIT ? `No ceiling is set, here or ${FROM_GLOBAL}.` : `$${globalRunBudget}, ${FROM_GLOBAL}.`)
                    : "A chain stops when its reported cost reaches this."}
                </p>
              </div>
            </div>
            <SettingsFoot
              saveLabel="Save change settings"
              onSave={() => void save()}
              onDiscard={() => void reload(changeName)}
              loading={loading}
              dirty={dirty}
              message={message}
              testIdPrefix="change-harness"
            >
              Saved to <code>{`openspec/changes/${changeName}/harness.json`}</code>, which stays hand-editable
              {onEditGlobal ? (
                <>
                  {" "}
                  <button type="button" className="openspec-link-button" onClick={onEditGlobal}>
                    Edit global defaults
                  </button>
                </>
              ) : null}
            </SettingsFoot>
          </section>
        </>
      )}
    </div>
  );
}
