import { useEffect, useState } from "react";
import {
  AGENT_REGISTRY,
  HARNESS_AGENT_CAPABILITIES,
  normalizeStepAgent,
  VSCODE_CHAT_STEP_AGENT_ID,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessEffort,
  type HarnessReviewGateMode,
  type HarnessStage,
  type HarnessStepAgent,
  type HarnessStepAgents,
} from "@openspec-ui/core/browser";

// Harness Settings — see openspec/changes/agentic-harness/. Two levels:
// a global default (this view's top section) and a per-change override
// (bottom section, only the explicitly-set fields are ever written —
// everything else stays inherited from the global config).

export interface HarnessSettingsApi {
  resolveGlobal(): Promise<HarnessConfig>;
  writeGlobal(config: Partial<HarnessConfig>): Promise<void>;
  readChangeOverride(changeName: string): Promise<Partial<HarnessConfig> | null>;
  writeChangeOverride(changeName: string, config: Partial<HarnessConfig>): Promise<void>;
}

const STAGES: readonly HarnessStage[] = ["propose", "review", "apply", "verify", "archive", "git"];
const INHERIT = "" as const;
const STAGE_RUNNER_OPTIONS = [
  ...AGENT_REGISTRY,
  { id: VSCODE_CHAT_STEP_AGENT_ID, label: "VS Code Chat (dispatch target)" },
];

const AUTONOMY_LEVEL_OPTIONS: ReadonlyArray<{ value: HarnessAutonomyLevel; label: string }> = [
  { value: "assisted", label: "assisted" },
  { value: "semi-autonomous", label: "semi-autonomous (not yet implemented)" },
  { value: "autonomous", label: "autonomous (not yet implemented)" },
];

type StepAgentsForm = Record<HarnessStage, string>;
// "" (INHERIT) means unset in both, same sentinel as StepAgentsForm.
type StepEffortForm = Record<HarnessStage, string>;
type StepBudgetForm = Record<HarnessStage, string>;

// This view only ever shows/writes the agent id — no model selector yet
// (see harness-step-models design.md, Non-Goals). A hand-edited config
// may still carry the object form for a stage; `normalizeStepAgent`
// reads its agent id for display, dropping the model rather than
// erroring — this form has no field to show it in.
function toForm(stepAgents: HarnessStepAgents | undefined): StepAgentsForm {
  const form = {} as StepAgentsForm;
  for (const stage of STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined ? INHERIT : normalizeStepAgent(entry).agent;
  }
  return form;
}

function toEffortForm(stepAgents: HarnessStepAgents | undefined): StepEffortForm {
  const form = {} as StepEffortForm;
  for (const stage of STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.effort ?? INHERIT;
  }
  return form;
}

function toBudgetForm(stepAgents: HarnessStepAgents | undefined): StepBudgetForm {
  const form = {} as StepBudgetForm;
  for (const stage of STAGES) {
    const entry = stepAgents?.[stage];
    if (entry === undefined || typeof entry === "string" || entry.budget === undefined) {
      form[stage] = INHERIT;
      continue;
    }
    const value = entry.budget.maxCostUsd ?? entry.budget.maxAiCredits;
    form[stage] = value === undefined ? INHERIT : String(value);
  }
  return form;
}

/** Combines all three per-stage forms back into `HarnessStepAgents`. A
 * stage whose effort/budget is unset (or whose value isn't accepted by
 * its currently-selected agent) writes the plain bare-string form,
 * exactly as before effort/budget existed — see tasks.md 3.6's
 * "byte-identical" guarantee, applied to this surface's own output. */
function toStepAgents(agentForm: StepAgentsForm, effortForm: StepEffortForm, budgetForm: StepBudgetForm): HarnessStepAgents {
  const result: HarnessStepAgents = {};
  for (const stage of STAGES) {
    if (agentForm[stage] === INHERIT) continue;
    const agentId = agentForm[stage];
    const capabilities = HARNESS_AGENT_CAPABILITIES[agentId];
    const effortValue = effortForm[stage];
    const budgetRaw = budgetForm[stage].trim();
    const hasEffort = effortValue !== INHERIT && (capabilities?.effort ?? []).includes(effortValue as HarnessEffort);
    const hasBudget = budgetRaw !== "" && capabilities?.budgetField !== undefined;

    if (!hasEffort && !hasBudget) {
      result[stage] = agentId;
      continue;
    }
    const entry: Exclude<HarnessStepAgent, string> = { agent: agentId };
    if (hasEffort) entry.effort = effortValue as HarnessEffort;
    if (hasBudget) {
      entry.budget = capabilities!.budgetField === "maxCostUsd"
        ? { maxCostUsd: Number(budgetRaw) }
        : { maxAiCredits: Number(budgetRaw) };
    }
    result[stage] = entry;
  }
  return result;
}

function AgentSelect({ stage, value, onChange, includeInherit, ariaLabel }: { stage: string; value: string; onChange: (value: string) => void; includeInherit: boolean; ariaLabel: string }) {
  return (
    <label className="openspec-shell-field">
      {stage}
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        {includeInherit ? <option value={INHERIT}>(inherit)</option> : <option value={INHERIT}>(none)</option>}
        {STAGE_RUNNER_OPTIONS.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Offers only the effort values `agentId` itself accepts (task 5.3 —
 * never a value the validator would reject). Renders nothing when
 * `agentId` is unset (per-change stage still inheriting) or has no
 * effort mechanism at all. */
function EffortSelect({ stage, agentId, value, onChange, ariaLabel }: { stage: string; agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string }) {
  const accepted = HARNESS_AGENT_CAPABILITIES[agentId]?.effort ?? [];
  if (agentId === INHERIT || accepted.length === 0) return null;
  return (
    <label className="openspec-shell-field">
      {stage} effort
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT}>(none)</option>
        {accepted.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Offers a numeric field in whichever unit `agentId` itself honours
 * (task 5.3). Renders nothing when `agentId` is unset or has no
 * spending-cap mechanism at all — see design.md, "Budget values are
 * agent-native and named for their unit": there is no portable "budget"
 * field to fall back to. */
function BudgetInput({ stage, agentId, value, onChange, ariaLabel }: { stage: string; agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string }) {
  const budgetField = HARNESS_AGENT_CAPABILITIES[agentId]?.budgetField;
  if (agentId === INHERIT || budgetField === undefined) return null;
  const label = budgetField === "maxCostUsd" ? "max cost (USD)" : "max AI credits";
  return (
    <label className="openspec-shell-field">
      {stage} {label}
      <input
        type="number"
        aria-label={ariaLabel}
        value={value}
        min={budgetField === "maxAiCredits" ? 30 : 0}
        step={budgetField === "maxAiCredits" ? 1 : "any"}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function HarnessSettingsView({ api }: { api: HarnessSettingsApi }) {
  const [globalConfig, setGlobalConfig] = useState<HarnessConfig | null>(null);
  const [globalStepAgents, setGlobalStepAgents] = useState<StepAgentsForm>(toForm(undefined));
  const [globalEffort, setGlobalEffort] = useState<StepEffortForm>(toEffortForm(undefined));
  const [globalBudget, setGlobalBudget] = useState<StepBudgetForm>(toBudgetForm(undefined));
  const [globalAutonomyLevel, setGlobalAutonomyLevel] = useState<HarnessAutonomyLevel>("assisted");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [changeName, setChangeName] = useState("");
  const [changeOverride, setChangeOverride] = useState<Partial<HarnessConfig> | null | undefined>(undefined);
  const [changeStepAgents, setChangeStepAgents] = useState<StepAgentsForm>(toForm(undefined));
  const [changeEffort, setChangeEffort] = useState<StepEffortForm>(toEffortForm(undefined));
  const [changeBudget, setChangeBudget] = useState<StepBudgetForm>(toBudgetForm(undefined));
  const [changeAutonomyLevel, setChangeAutonomyLevel] = useState<HarnessAutonomyLevel | "">(INHERIT);
  const [changeReviewGateMode, setChangeReviewGateMode] = useState<HarnessReviewGateMode | "">(INHERIT);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);

  async function loadGlobal() {
    setGlobalLoading(true);
    try {
      const config = await api.resolveGlobal();
      setGlobalConfig(config);
      setGlobalStepAgents(toForm(config.stepAgents));
      setGlobalEffort(toEffortForm(config.stepAgents));
      setGlobalBudget(toBudgetForm(config.stepAgents));
      setGlobalAutonomyLevel(config.autonomyLevel);
      setGlobalMessage(null);
    } catch (error) {
      setGlobalMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    void loadGlobal();
  }, [api]);

  async function saveGlobal() {
    setGlobalLoading(true);
    try {
      await api.writeGlobal({
        stepAgents: toStepAgents(globalStepAgents, globalEffort, globalBudget),
        autonomyLevel: globalAutonomyLevel,
      });
      setGlobalMessage("Saved.");
      await loadGlobal();
    } catch (error) {
      setGlobalMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGlobalLoading(false);
    }
  }

  async function loadChangeOverride() {
    if (changeName.trim().length === 0) return;
    setChangeLoading(true);
    try {
      const override = await api.readChangeOverride(changeName);
      setChangeOverride(override);
      setChangeStepAgents(toForm(override?.stepAgents));
      setChangeEffort(toEffortForm(override?.stepAgents));
      setChangeBudget(toBudgetForm(override?.stepAgents));
      setChangeAutonomyLevel(override?.autonomyLevel ?? INHERIT);
      setChangeReviewGateMode(override?.reviewGate?.mode ?? INHERIT);
      setChangeMessage(null);
    } catch (error) {
      setChangeMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setChangeLoading(false);
    }
  }

  async function saveChangeOverride() {
    if (changeName.trim().length === 0) return;
    setChangeLoading(true);
    try {
      const config: Partial<HarnessConfig> = { stepAgents: toStepAgents(changeStepAgents, changeEffort, changeBudget) };
      if (changeAutonomyLevel !== INHERIT) config.autonomyLevel = changeAutonomyLevel;
      if (changeReviewGateMode !== INHERIT) config.reviewGate = { mode: changeReviewGateMode };
      await api.writeChangeOverride(changeName, config);
      setChangeMessage("Saved.");
      await loadChangeOverride();
    } catch (error) {
      setChangeMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setChangeLoading(false);
    }
  }

  return (
    <div data-testid="harness-settings-view">
      <section>
        <h3>Global default</h3>
        <p className="openspec-shell-note">
          Applies to every change unless a change explicitly overrides it below. Recommends an agent per stage in
          the Agent Selection picker — never enforces one.
        </p>
        {globalMessage ? <p className="openspec-shell-note" role="status">{globalMessage}</p> : null}
        {STAGES.map((stage) => (
          <div key={stage} className="openspec-harness-stage-row">
            <AgentSelect
              stage={stage}
              ariaLabel={`${stage} agent`}
              value={globalStepAgents[stage]}
              onChange={(value) => setGlobalStepAgents((prev) => ({ ...prev, [stage]: value }))}
              includeInherit={false}
            />
            <EffortSelect
              stage={stage}
              agentId={globalStepAgents[stage]}
              ariaLabel={`${stage} effort`}
              value={globalEffort[stage]}
              onChange={(value) => setGlobalEffort((prev) => ({ ...prev, [stage]: value }))}
            />
            <BudgetInput
              stage={stage}
              agentId={globalStepAgents[stage]}
              ariaLabel={`${stage} budget`}
              value={globalBudget[stage]}
              onChange={(value) => setGlobalBudget((prev) => ({ ...prev, [stage]: value }))}
            />
          </div>
        ))}
        <label className="openspec-shell-field">
          Autonomy level
          <select
            aria-label="Global autonomy level"
            value={globalAutonomyLevel}
            onChange={(e) => setGlobalAutonomyLevel(e.target.value as HarnessAutonomyLevel)}
          >
            {AUTONOMY_LEVEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className="openspec-shell-note">
          Review gate: <strong>human-required</strong> (fixed at the global level — only a per-change override can
          relax it).
        </p>
        <div className="openspec-ai-panel-controls">
          <button type="button" onClick={() => void saveGlobal()} disabled={globalLoading}>
            {globalLoading ? "Working..." : "Save global config"}
          </button>
        </div>
        {globalConfig ? null : <p className="openspec-shell-note">No global config yet — using documented defaults.</p>}
      </section>

      <section>
        <h3>Per-change override</h3>
        <label className="openspec-shell-field">
          Change name
          <input
            type="text"
            data-testid="change-override-name-input"
            value={changeName}
            onChange={(e) => setChangeName(e.target.value)}
          />
        </label>
        <div className="openspec-ai-panel-controls">
          <button type="button" onClick={() => void loadChangeOverride()} disabled={changeLoading || changeName.trim().length === 0}>
            Load override
          </button>
        </div>
        {changeMessage ? <p className="openspec-shell-note" role="status">{changeMessage}</p> : null}
        {changeOverride !== undefined ? (
          <>
            {STAGES.map((stage) => (
              <div key={stage} className="openspec-harness-stage-row">
                <AgentSelect
                  stage={stage}
                  ariaLabel={`change ${stage} agent`}
                  value={changeStepAgents[stage]}
                  onChange={(value) => setChangeStepAgents((prev) => ({ ...prev, [stage]: value }))}
                  includeInherit
                />
                <EffortSelect
                  stage={stage}
                  agentId={changeStepAgents[stage]}
                  ariaLabel={`change ${stage} effort`}
                  value={changeEffort[stage]}
                  onChange={(value) => setChangeEffort((prev) => ({ ...prev, [stage]: value }))}
                />
                <BudgetInput
                  stage={stage}
                  agentId={changeStepAgents[stage]}
                  ariaLabel={`change ${stage} budget`}
                  value={changeBudget[stage]}
                  onChange={(value) => setChangeBudget((prev) => ({ ...prev, [stage]: value }))}
                />
              </div>
            ))}
            <label className="openspec-shell-field">
              Autonomy level
              <select
                aria-label="Change autonomy level"
                value={changeAutonomyLevel}
                onChange={(e) => setChangeAutonomyLevel(e.target.value as HarnessAutonomyLevel | "")}
              >
                <option value={INHERIT}>(inherit: {globalAutonomyLevel})</option>
                {AUTONOMY_LEVEL_OPTIONS.map((option) => (
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
                value={changeReviewGateMode}
                onChange={(e) => setChangeReviewGateMode(e.target.value as HarnessReviewGateMode | "")}
              >
                <option value={INHERIT}>(inherit: human-required)</option>
                <option value="human-required">human-required</option>
                <option value="agent-sufficient">agent-sufficient</option>
              </select>
            </label>
            <div className="openspec-ai-panel-controls">
              <button type="button" onClick={() => void saveChangeOverride()} disabled={changeLoading}>
                {changeLoading ? "Working..." : "Save override"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
