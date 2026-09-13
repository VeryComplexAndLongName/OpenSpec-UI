import { useEffect, useMemo, useRef, useState } from "react";
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
import { NamedConfigurationPicker } from "./NamedConfigurationPicker.js";
import {
  AgentSelect,
  autonomyLevelOptionsFor,
  BudgetInput,
  changeConfigToSave,
  changeTemplateAppliedMessage,
  CONFIGURABLE_STAGES,
  CustomAgentSelect,
  describeFailure,
  EffortSelect,
  HarnessFindingsPanel,
  INHERIT,
  MechanicalStageRow,
  NO_GLOBAL_CONFIG,
  stageFormsFrom,
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

const FROM_GLOBAL = "from the global file";

type Loaded = { global: HarnessConfig; override: Partial<HarnessConfig> | null };

function snapshotOf(
  override: Partial<HarnessConfig> | null | undefined,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel | "",
  reviewGateMode: HarnessReviewGateMode | "",
): string {
  return JSON.stringify(changeConfigToSave(override, forms, autonomyLevel, reviewGateMode));
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
  const [customAgents, setCustomAgents] = useState<CustomAgentsResult | null>(null);
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
    setGlobal(base);
    setOverride(own);
    setForms(loadedForms);
    setAutonomyLevel(level);
    setReviewGateMode(gate);
    setSavedSnapshot(snapshotOf(own, loadedForms, level, gate));
    setApplyStatus(null);
  }

  async function read(name: string): Promise<Loaded> {
    const [base, own] = await Promise.all([api.resolveGlobal(), api.readChangeOverride(name)]);
    return { global: base, override: own };
  }

  useEffect(() => {
    const current = ++reading.current;
    setOverride(undefined);
    setMessage(null);
    setLoading(true);
    void (async () => {
      try {
        const loaded = await read(changeName);
        if (reading.current === current) show(loaded);
      } catch (error) {
        if (reading.current === current) setMessage(describeFailure("Load", error));
      } finally {
        if (reading.current === current) setLoading(false);
      }
    })();
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
    () => mergeStepAgents(base.stepAgents, stepAgentsFromForms(forms, override?.stepAgents)),
    [base, forms, override],
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
    && snapshotOf(override, forms, autonomyLevel, reviewGateMode) !== savedSnapshot;

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
    // The ceilings ride here, not in the form, and the save lays the form
    // over this rather than replacing it.
    setOverride(written);
    setApplyStatus(changeTemplateAppliedMessage(template, writtenForms.effort, resolvedAgents, reset));
  };

  async function save() {
    setLoading(true);
    try {
      await api.writeChangeOverride(changeName, changeConfigToSave(override, forms, autonomyLevel, reviewGateMode));
      show(await read(changeName));
      setMessage("Saved.");
    } catch (error) {
      setMessage(describeFailure("Save", error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="openspec-harness-settings" data-testid="change-harness-settings">
      <HarnessFindingsPanel findings={findings} />
      {message ? <p className="openspec-shell-note" role="status" data-testid="change-harness-message">{message}</p> : null}
      {override === undefined ? (
        loading ? <p className="openspec-shell-note" data-testid="change-harness-loading">Reading the settings of {changeName}…</p> : null
      ) : (
        <>
          <NamedConfigurationPicker
            scope="change"
            onApply={applyTemplate}
            status={applyStatus}
            note="Applying one fills the fields below; nothing is saved until you save."
            testIdPrefix="change-harness"
          />
          <section className="openspec-harness-section" data-testid="change-harness-fields">
            <p className="openspec-shell-note">
              What {changeName} sets for itself. A field left to inherit takes the value from the global file, and
              says which value that is.
            </p>
            <p className="openspec-shell-note">
              Saved to <code>{`openspec/changes/${changeName}/harness.json`}</code>, which stays hand-editable.
              {onEditGlobal ? (
                <>
                  {" "}
                  <button type="button" className="openspec-inline-action" onClick={onEditGlobal}>
                    Edit global defaults
                  </button>
                </>
              ) : null}
            </p>
            {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
              <MechanicalStageRow key={stage} stage={stage} />
            ) : (
              <div key={stage} className="openspec-harness-stage-row">
                <AgentSelect
                  stage={stage}
                  ariaLabel={`change ${stage} agent`}
                  value={forms.agents[stage]}
                  onChange={(value) => setStage("agents", stage, value)}
                  emptyLabel={inheritedAgent(stage)}
                />
                <EffortSelect
                  stage={stage}
                  agentId={forms.agents[stage]}
                  ariaLabel={`change ${stage} effort`}
                  value={forms.effort[stage]}
                  onChange={(value) => setStage("effort", stage, value)}
                  emptyLabel={inheritedField(stage, "effort")}
                />
                <BudgetInput
                  stage={stage}
                  agentId={forms.agents[stage]}
                  ariaLabel={`change ${stage} budget`}
                  value={forms.budget[stage]}
                  onChange={(value) => setStage("budget", stage, value)}
                  {...(inheritedBudget(stage) ? { placeholder: inheritedBudget(stage) } : {})}
                />
                <CustomAgentSelect
                  stage={stage}
                  agentId={forms.agents[stage]}
                  ariaLabel={`change ${stage} custom agent`}
                  value={forms.customAgent[stage]}
                  onChange={(value) => setStage("customAgent", stage, value)}
                  available={customAgents}
                  emptyLabel={inheritedField(stage, "customAgent")}
                />
              </div>
            )))}
            <label className="openspec-shell-field">
              Autonomy level
              <select
                aria-label="Change autonomy level"
                value={autonomyLevel}
                onChange={(e) => setAutonomyLevel(e.target.value as HarnessAutonomyLevel | "")}
              >
                <option value={INHERIT}>{`(inherit: ${base.autonomyLevel}, ${FROM_GLOBAL})`}</option>
                {autonomyLevelOptionsFor("change").map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="openspec-shell-field">
              Review gate
              <select
                aria-label="Change review gate mode"
                value={reviewGateMode}
                onChange={(e) => setReviewGateMode(e.target.value as HarnessReviewGateMode | "")}
              >
                <option value={INHERIT}>{`(inherit: ${base.reviewGate.mode}, ${FROM_GLOBAL})`}</option>
                <option value="human-required">human-required</option>
                <option value="agent-sufficient">agent-sufficient</option>
              </select>
            </label>
            <div className="openspec-ai-panel-controls">
              <button type="button" onClick={() => void save()} disabled={loading || !dirty}>
                {loading ? "Working..." : "Save change settings"}
              </button>
              {dirty ? <span className="openspec-shell-note" data-testid="change-harness-unsaved">Unsaved changes</span> : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
