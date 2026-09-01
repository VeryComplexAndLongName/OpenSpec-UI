import { useEffect, useState } from "react";
import { AGENT_REGISTRY, normalizeStepAgent, type HarnessAutonomyLevel, type HarnessConfig, type HarnessReviewGateMode, type HarnessStage, type HarnessStepAgents } from "@openspec-ui/core/browser";

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

const AUTONOMY_LEVEL_OPTIONS: ReadonlyArray<{ value: HarnessAutonomyLevel; label: string }> = [
  { value: "assisted", label: "assisted" },
  { value: "semi-autonomous", label: "semi-autonomous (not yet implemented)" },
  { value: "autonomous", label: "autonomous (not yet implemented)" },
];

type StepAgentsForm = Record<HarnessStage, string>;

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

function toStepAgents(form: StepAgentsForm): Partial<Record<HarnessStage, string>> {
  const result: Partial<Record<HarnessStage, string>> = {};
  for (const stage of STAGES) {
    if (form[stage] !== INHERIT) result[stage] = form[stage];
  }
  return result;
}

function AgentSelect({ stage, value, onChange, includeInherit, ariaLabel }: { stage: string; value: string; onChange: (value: string) => void; includeInherit: boolean; ariaLabel: string }) {
  return (
    <label className="openspec-shell-field">
      {stage}
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        {includeInherit ? <option value={INHERIT}>(inherit)</option> : <option value={INHERIT}>(none)</option>}
        {AGENT_REGISTRY.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HarnessSettingsView({ api }: { api: HarnessSettingsApi }) {
  const [globalConfig, setGlobalConfig] = useState<HarnessConfig | null>(null);
  const [globalStepAgents, setGlobalStepAgents] = useState<StepAgentsForm>(toForm(undefined));
  const [globalAutonomyLevel, setGlobalAutonomyLevel] = useState<HarnessAutonomyLevel>("assisted");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [changeName, setChangeName] = useState("");
  const [changeOverride, setChangeOverride] = useState<Partial<HarnessConfig> | null | undefined>(undefined);
  const [changeStepAgents, setChangeStepAgents] = useState<StepAgentsForm>(toForm(undefined));
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
      await api.writeGlobal({ stepAgents: toStepAgents(globalStepAgents), autonomyLevel: globalAutonomyLevel });
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
      const config: Partial<HarnessConfig> = { stepAgents: toStepAgents(changeStepAgents) };
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
          <AgentSelect
            key={stage}
            stage={stage}
            ariaLabel={`${stage} agent`}
            value={globalStepAgents[stage]}
            onChange={(value) => setGlobalStepAgents((prev) => ({ ...prev, [stage]: value }))}
            includeInherit={false}
          />
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
              <AgentSelect
                key={stage}
                stage={stage}
                ariaLabel={`change ${stage} agent`}
                value={changeStepAgents[stage]}
                onChange={(value) => setChangeStepAgents((prev) => ({ ...prev, [stage]: value }))}
                includeInherit
              />
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
