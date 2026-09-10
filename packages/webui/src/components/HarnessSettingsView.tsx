import { useEffect, useMemo, useState } from "react";
import {
  AGENT_REGISTRY,
  customAgentFamilyFor,
  HARNESS_AGENT_CAPABILITIES,
  findHarnessConfigLimits,
  resolveEffortLevel,
  templatesForScope,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  VSCODE_CHAT_STEP_AGENT_ID,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessEffort,
  type HarnessEffortLevel,
  type HarnessReviewGateMode,
  type HarnessStage,
  type HarnessStepAgent,
  type HarnessStepAgentStage,
  type HarnessStepAgents,
  type HarnessFinding,
  type HarnessTemplate,
} from "@openspec-ui/core/browser";
import type { CustomAgentsResult } from "../custom-agents-client.js";

// Harness Settings — see openspec/changes/agentic-harness/. Two levels:
// a global default (this view's top section) and a per-change override
// (bottom section, only the explicitly-set fields are ever written —
// everything else stays inherited from the global config).

export interface HarnessSettingsApi {
  /** The custom agents this workspace defines, and the directories they
   * were looked for in. A host that cannot read them offers no picker
   * and says so, which is why the result carries the directories rather
   * than only the list. See custom-agent-picker. */
  listCustomAgents(): Promise<CustomAgentsResult>;
  resolveGlobal(): Promise<HarnessConfig>;
  writeGlobal(config: Partial<HarnessConfig>): Promise<void>;
  readChangeOverride(changeName: string): Promise<Partial<HarnessConfig> | null>;
  writeChangeOverride(changeName: string, config: Partial<HarnessConfig>): Promise<void>;
}

const STAGES: readonly HarnessStage[] = ["propose", "review", "apply", "verify", "archive", "git"];
/** Every stage is listed — each runs, and hiding one would misrepresent
 * the chain — but only these can carry an entry. `archive` (mechanical)
 * and `git` (its own push/PR/merge sequence) invoke no agent, so neither
 * has anything to configure and both are rendered without pickers rather
 * than with pickers that write a setting nothing reads. See
 * harness-mechanical-checks tasks.md 4.4 (`archive`) and
 * harness-git-stage-no-agent tasks.md 3.1 (`git`, added here later). */
const CONFIGURABLE_STAGES: readonly HarnessStepAgentStage[] = STAGES.filter(isHarnessStepAgentStage);
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

type StepAgentsForm = Record<HarnessStepAgentStage, string>;
// "" (INHERIT) means unset in both, same sentinel as StepAgentsForm.
type StepEffortForm = Record<HarnessStepAgentStage, string>;
type StepBudgetForm = Record<HarnessStepAgentStage, string>;
// "" (INHERIT) means "no custom agent", the same sentinel as the others.
type StepCustomAgentForm = Record<HarnessStepAgentStage, string>;

// This view only ever shows/writes the agent id — no model selector yet
// (see harness-step-models design.md, Non-Goals). A hand-edited config
// may still carry the object form for a stage; `normalizeStepAgent`
// reads its agent id for display, dropping the model rather than
// erroring — this form has no field to show it in.
function toForm(stepAgents: HarnessStepAgents | undefined): StepAgentsForm {
  const form = {} as StepAgentsForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined ? INHERIT : normalizeStepAgent(entry).agent;
  }
  return form;
}

function toEffortForm(stepAgents: HarnessStepAgents | undefined): StepEffortForm {
  const form = {} as StepEffortForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.effort ?? INHERIT;
  }
  return form;
}

/** The effort each stage gets from a named configuration, resolved
 * against the agent that stage has on screen.
 *
 * A configuration carries a level and not a value, so there is nothing to
 * copy across: `max` is a value `claude` accepts and `codex` does not.
 * A stage with no agent chosen, or one whose agent accepts no effort,
 * keeps its inherited setting rather than being given a value it would
 * be refused for. See presets-by-effort. */
function effortFormFor(level: HarnessEffortLevel, agents: StepAgentsForm): StepEffortForm {
  const form = {} as StepEffortForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const agent = agents[stage];
    form[stage] = (agent === INHERIT ? undefined : resolveEffortLevel(agent, level).effort) ?? INHERIT;
  }
  return form;
}

/** What applying one just did, said rather than left to be noticed.
 *
 * Where no stage on screen accepts an effort setting the configurations
 * differ only in their ceilings, and saying so is the difference between
 * a dial that does nothing and a dial that does nothing silently. */
function templateAppliedMessage(template: HarnessTemplate, effort: StepEffortForm): string {
  const set = CONFIGURABLE_STAGES.filter((stage) => effort[stage] !== INHERIT);
  const effortNote = set.length === 0
    ? "None of the agents on screen takes an effort setting, so only the ceilings changed."
    : `Effort set to ${template.effortLevel} of what each agent accepts: `
      + `${set.map((stage) => `${stage} ${effort[stage]}`).join(", ")}.`;
  return `Filled from "${template.title}". ${effortNote} The agents and models on screen are unchanged.`
    + " Nothing is saved until you save.";
}

function toBudgetForm(stepAgents: HarnessStepAgents | undefined): StepBudgetForm {
  const form = {} as StepBudgetForm;
  for (const stage of CONFIGURABLE_STAGES) {
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

function toCustomAgentForm(stepAgents: HarnessStepAgents | undefined): StepCustomAgentForm {
  const form = {} as StepCustomAgentForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.customAgent ?? INHERIT;
  }
  return form;
}

/** Combines all four per-stage forms back into `HarnessStepAgents`. A
 * stage whose effort/budget is unset (or whose value isn't accepted by
 * its currently-selected agent) writes the plain bare-string form,
 * exactly as before effort/budget existed — see tasks.md 3.6's
 * "byte-identical" guarantee, applied to this surface's own output. */
function toStepAgents(
  agentForm: StepAgentsForm,
  effortForm: StepEffortForm,
  budgetForm: StepBudgetForm,
  customAgentForm: StepCustomAgentForm,
  loaded?: HarnessStepAgents,
): HarnessStepAgents {
  const result: HarnessStepAgents = {};
  for (const stage of CONFIGURABLE_STAGES) {
    if (agentForm[stage] === INHERIT) continue;
    const agentId = agentForm[stage];
    const capabilities = HARNESS_AGENT_CAPABILITIES[agentId];
    const effortValue = effortForm[stage];
    const budgetRaw = budgetForm[stage].trim();
    const customAgent = customAgentForm[stage];
    const hasEffort = effortValue !== INHERIT && (capabilities?.effort ?? []).includes(effortValue as HarnessEffort);
    const hasBudget = budgetRaw !== "" && capabilities?.budgetField !== undefined;
    const hasCustomAgent = customAgent !== INHERIT && customAgentFamilyFor(agentId) !== undefined;
    // What this form has no control for, kept from the file it loaded —
    // and only while the stage still names the same agent, since a model
    // belongs to the agent it was written for. Without this, saving
    // deleted a hand-written `model`: the same defect as
    // settings-save-what-was-shown, one level down in the entry.
    const previous = loaded?.[stage];
    const keptModel = previous !== undefined && typeof previous !== "string" && previous.agent === agentId
      ? previous.model
      : undefined;

    if (!hasEffort && !hasBudget && !hasCustomAgent && keptModel === undefined) {
      result[stage] = agentId;
      continue;
    }
    const entry: Exclude<HarnessStepAgent, string> = { agent: agentId };
    if (keptModel !== undefined) entry.model = keptModel;
    if (hasEffort) entry.effort = effortValue as HarnessEffort;
    if (hasBudget) {
      entry.budget = capabilities!.budgetField === "maxCostUsd"
        ? { maxCostUsd: Number(budgetRaw) }
        : { maxAiCredits: Number(budgetRaw) };
    }
    if (hasCustomAgent) entry.customAgent = customAgent;
    result[stage] = entry;
  }
  return result;
}

/** `archive` and `git` are listed so the chain reads honestly, and carry
 * no pickers: neither invokes an agent, so an agent, effort or budget set
 * here would be a setting nothing reads. */
function MechanicalStageRow({ stage }: { stage: HarnessStage }) {
  return (
    <div className="openspec-harness-stage-row">
      <span className="openspec-shell-field">
        {stage}
        <span className="openspec-shell-note">runs mechanically — no agent</span>
      </span>
    </div>
  );
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

/** Offers the custom agents this workspace defines for the stage's own
 * CLI — `claude --agent <name>`, `copilot --agent <name>`.
 *
 * A select rather than a text field: a field accepts any name, including
 * one no definition matches, and the CLI's complaint about an unknown
 * agent arrives when the stage runs, long after the mistake.
 *
 * Nothing is rendered as an empty control. Where the stage's agent takes
 * none, or the workspace defines none for that CLI, the row says which of
 * the two it is — an empty dropdown is a promise of a choice that is not
 * there. See custom-agent-picker. */
function CustomAgentSelect(
  { stage, agentId, value, onChange, ariaLabel, available }:
  { stage: string; agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; available: CustomAgentsResult | null },
) {
  if (agentId === INHERIT) return null;
  const family = customAgentFamilyFor(agentId);
  if (family === undefined) {
    // Said rather than left blank: "this CLI takes none" and "we found
    // none" are different facts, and only one of them is worth looking
    // for a file about.
    return (
      <p className="openspec-shell-note" data-testid={`custom-agent-none-${stage}`}>
        {stage}: {agentId} takes no custom agent.
      </p>
    );
  }
  if (available === null) return null;

  // A definition whose file name validation would refuse comes back
  // marked rather than dropped, so the discovery can say it exists. It
  // is still not offered: a choice that is refused the moment it is
  // saved is not a choice. See a-name-is-checked-before-it-is-used.
  const forFamily = available.agents.filter((agent) => agent.family === family && agent.refused === undefined);
  const refused = available.agents.filter((agent) => agent.family === family && agent.refused !== undefined);
  // A configured name the discovery no longer finds stays selected and
  // is marked, rather than being replaced. Silently resetting it would
  // edit a configuration nobody asked to change and hide that a file it
  // depends on is gone.
  const missing = value !== INHERIT && !forFamily.some((agent) => agent.name === value);

  const refusedNote = refused.length === 0 ? null : (
    <p className="openspec-shell-note" data-testid={`custom-agent-refused-${stage}`}>
      {stage}: found but not offered — {refused.map((agent) => agent.refused).join("; ")}
    </p>
  );

  if (forFamily.length === 0 && !missing) {
    const directories = available.directories
      .filter((entry) => entry.family === family)
      .map((entry) => entry.path);
    return (
      <>
        <p className="openspec-shell-note" data-testid={`custom-agent-empty-${stage}`}>
          {stage}: no custom agents defined for {family}. Read from {directories.join(" and ")}.
        </p>
        {refusedNote}
      </>
    );
  }

  return (
    <>
      <label className="openspec-shell-field">
        {stage} custom agent
        <select
          aria-label={ariaLabel}
          data-testid={`custom-agent-select-${stage}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value={INHERIT}>(none)</option>
          {missing ? <option value={value}>{value} (not found)</option> : null}
          {forFamily.map((agent) => (
            <option key={agent.name} value={agent.name}>
              {agent.description === undefined ? agent.name : `${agent.name} — ${agent.description}`}
            </option>
          ))}
        </select>
      </label>
      {refusedNote}
    </>
  );
}

/** Named configurations, offered by intent. Both sentences are shown
 * before applying — the "not for" one is what actually helps someone
 * choose, since a list of options carrying only advantages gives no help
 * choosing between them.
 *
 * Applying fills the form rather than writing the file, so the diagnostic
 * below updates and the choice can be adjusted before saving. */
function HarnessTemplatePicker(
  { scope, onApply }: { scope: "global" | "change"; onApply: (template: HarnessTemplate) => void },
) {
  const templates = templatesForScope(scope);
  if (templates.length === 0) return null;
  return (
    <div className="openspec-harness-templates" data-testid={`harness-templates-${scope}`}>
      <p className="openspec-shell-note">
        Start from a named configuration, then adjust. Applying one fills the fields below; nothing is
        saved until you save.
      </p>
      <ul>
        {templates.map((template) => (
           /* Qualified by scope: both pickers can be on screen at once,
             and two elements with one id is a trap rather than a
             convenience. */
          <li key={template.id} data-testid={`harness-template-${scope}-${template.id}`}>
            <button type="button" onClick={() => onApply(template)}>{template.title}</button>
            {/* The level, said in the list rather than only after
                applying: it is what separates these four from each
                other, and a list that hides its axis asks the reader to
                apply one to find out. */}
            <p className="openspec-shell-note">
              <strong>Effort:</strong> {template.effortLevel} of what each agent accepts
            </p>
            <p className="openspec-shell-note">{template.intent}</p>
            <p className="openspec-shell-note"><strong>Not for:</strong> {template.notFor}</p>
            <p className="openspec-shell-note">{template.basis}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What the configuration on screen cannot do. Rendered above the
 * settings themselves rather than behind a command: a warning someone has
 * to ask for is read by someone who already suspects the problem, which
 * is exactly the reader who did not need it.
 *
 * Nothing is rendered when there is nothing to say. A surface that warns
 * about a correct configuration becomes noise people learn to ignore. */
function HarnessFindingsPanel({ findings }: { findings: readonly HarnessFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <section className="openspec-harness-findings" data-testid="harness-findings">
      <h3>What this configuration cannot do</h3>
      <p className="openspec-shell-note">
        These settings are valid and will be saved. A ceiling that cannot act is otherwise
        indistinguishable from one that has not acted yet.
      </p>
      <ul>
        {findings.map((finding) => (
          <li key={`${finding.kind}:${finding.stage}`} data-testid={`harness-finding-${finding.stage}`}>
            {finding.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HarnessSettingsView(
  { api, initialChangeName }: {
    api: HarnessSettingsApi;
    /** The change to load on mount, when the view was opened from one —
     * the editor host opens it from a change in the tree, and asking a
     * person to type back the name they just right-clicked is asking
     * them to repeat what the host already knows. */
    initialChangeName?: string;
  },
) {
  const [globalConfig, setGlobalConfig] = useState<HarnessConfig | null>(null);
  const [globalStepAgents, setGlobalStepAgents] = useState<StepAgentsForm>(toForm(undefined));
  const [globalEffort, setGlobalEffort] = useState<StepEffortForm>(toEffortForm(undefined));
  const [globalBudget, setGlobalBudget] = useState<StepBudgetForm>(toBudgetForm(undefined));
  const [globalCustomAgent, setGlobalCustomAgent] = useState<StepCustomAgentForm>(toCustomAgentForm(undefined));
  /** What the workspace defines, or `null` while it has not been read.
   * Null renders no picker at all rather than an empty one — "not read
   * yet" is not "none defined". */
  const [customAgents, setCustomAgents] = useState<CustomAgentsResult | null>(null);
  const [globalAutonomyLevel, setGlobalAutonomyLevel] = useState<HarnessAutonomyLevel>("assisted");
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  // Recomputed as the operator changes an agent, not only on load: the
  // warning has to appear while the choice is being made.
  /** Fills the form from a template rather than writing the file, so the
   * findings above recompute and the choice can be adjusted before it is
   * saved. The ceilings ride on `globalConfig`, which is what the
   * findings read. */
  const applyTemplate = (template: HarnessTemplate): void => {
    // The agents on screen are left alone. A named configuration chooses
    // an effort, not who runs the stage, and clearing the agents would
    // discard a choice nobody asked it to make.
    const effort = effortFormFor(template.effortLevel, globalStepAgents);
    setGlobalEffort(effort);
    if (template.config.autonomyLevel) setGlobalAutonomyLevel(template.config.autonomyLevel);
    setGlobalConfig((previous) => ({
      ...(previous ?? { stepAgents: {}, autonomyLevel: "assisted", reviewGate: { mode: "human-required" } }),
      ...template.config,
    }));
    setGlobalMessage(templateAppliedMessage(template, effort));
  };

  const findings = useMemo<HarnessFinding[]>(() => {
    if (!globalConfig) return [];
    const stepAgents: HarnessStepAgents = {};
    for (const stage of STAGES) {
      if (!isHarnessStepAgentStage(stage)) continue;
      const agent = globalStepAgents[stage];
      if (agent) stepAgents[stage] = agent;
    }
    return findHarnessConfigLimits({ ...globalConfig, stepAgents });
  }, [globalConfig, globalStepAgents]);
  const [globalLoading, setGlobalLoading] = useState(false);

  const [changeName, setChangeName] = useState(initialChangeName ?? "");
  const [changeOverride, setChangeOverride] = useState<Partial<HarnessConfig> | null | undefined>(undefined);
  const [changeStepAgents, setChangeStepAgents] = useState<StepAgentsForm>(toForm(undefined));
  const [changeEffort, setChangeEffort] = useState<StepEffortForm>(toEffortForm(undefined));
  const [changeBudget, setChangeBudget] = useState<StepBudgetForm>(toBudgetForm(undefined));
  const [changeCustomAgent, setChangeCustomAgent] = useState<StepCustomAgentForm>(toCustomAgentForm(undefined));
  const [changeAutonomyLevel, setChangeAutonomyLevel] = useState<HarnessAutonomyLevel | "">(INHERIT);
  const [changeReviewGateMode, setChangeReviewGateMode] = useState<HarnessReviewGateMode | "">(INHERIT);
  const [changeMessage, setChangeMessage] = useState<string | null>(null);
  const [changeLoading, setChangeLoading] = useState(false);

  /** The per-change twin of `applyTemplate`. It is also the only place a
   * per-change-only configuration could be applied from, which is why it
   * exists separately from the global picker above. */
  const applyChangeTemplate = (template: HarnessTemplate): void => {
    // Same as the global twin: the agents, models and per-stage budgets
    // on screen are the operator's, and only the effort is the
    // configuration's.
    const effort = effortFormFor(template.effortLevel, changeStepAgents);
    setChangeEffort(effort);
    if (template.config.autonomyLevel) setChangeAutonomyLevel(template.config.autonomyLevel);
    if (template.config.reviewGate) setChangeReviewGateMode(template.config.reviewGate.mode);
    // The ceilings ride here, not in the form, and the save lays the form
    // over this rather than replacing it.
    setChangeOverride((previous) => ({ ...(previous ?? {}), ...template.config }));
    setChangeMessage(templateAppliedMessage(template, effort));
  };

  async function loadGlobal() {
    setGlobalLoading(true);
    try {
      const config = await api.resolveGlobal();
      setGlobalConfig(config);
      setGlobalStepAgents(toForm(config.stepAgents));
      setGlobalEffort(toEffortForm(config.stepAgents));
      setGlobalBudget(toBudgetForm(config.stepAgents));
      setGlobalCustomAgent(toCustomAgentForm(config.stepAgents));
      setGlobalAutonomyLevel(config.autonomyLevel);
      setGlobalMessage(null);
    } catch (error) {
      setGlobalMessage(`Load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setGlobalLoading(false);
    }
  }

  useEffect(() => {
    // Read once, beside the config. A definition is a file on disk; it
    // does not change while a form is open, and re-reading it per stage
    // would be a request per select.
    let cancelled = false;
    void (async () => {
      try {
        const found = await api.listCustomAgents();
        if (!cancelled) setCustomAgents(found);
      } catch {
        // A host that cannot read them offers no picker rather than an
        // empty one. Not surfaced as a failure of the settings form,
        // which loaded fine.
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  useEffect(() => {
    // Loaded on mount when the host opened this from a change. Not on
    // every `changeName` keystroke: typing a name is not asking for it.
    if (initialChangeName) void loadChangeOverride();
  }, [initialChangeName]);

  useEffect(() => {
    void loadGlobal();
  }, [api]);

  async function saveGlobal() {
    setGlobalLoading(true);
    try {
      // Laid over what was loaded, not built from the fields alone. The
      // writer replaces the file, so a key this view has no field for —
      // `timeout`, `budget`, `gitStageAllowlist` — would be deleted by
      // pressing Save. See settings-save-what-was-shown.
      await api.writeGlobal({
        ...(globalConfig ?? {}),
        stepAgents: toStepAgents(
          globalStepAgents,
          globalEffort,
          globalBudget,
          globalCustomAgent,
          globalConfig?.stepAgents,
        ),
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
      setChangeCustomAgent(toCustomAgentForm(override?.stepAgents));
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
      // As with the global save: layered over what was loaded, because
      // the writer replaces the file.
      const config: Partial<HarnessConfig> = {
        ...(changeOverride ?? {}),
        stepAgents: toStepAgents(
          changeStepAgents,
          changeEffort,
          changeBudget,
          changeCustomAgent,
          changeOverride?.stepAgents,
        ),
      };
      // Inherit means "not set here", so these two are removed rather
      // than carried over from the loaded file.
      if (changeAutonomyLevel !== INHERIT) config.autonomyLevel = changeAutonomyLevel;
      else delete config.autonomyLevel;
      if (changeReviewGateMode !== INHERIT) config.reviewGate = { mode: changeReviewGateMode };
      else delete config.reviewGate;
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
      <HarnessFindingsPanel findings={findings} />
      <section>
        <h3>Global default</h3>
        <HarnessTemplatePicker scope="global" onApply={applyTemplate} />
        <p className="openspec-shell-note">
          Applies to every change unless a change explicitly overrides it below. Recommends an agent per stage in
          the Agent Selection picker — never enforces one.
        </p>
        {/* Named, because this view is a way to edit the file and not a
            replacement for it: whoever wants the JSON should not have to
            hunt for it. */}
        <p className="openspec-shell-note">
          Saved to <code>openspec/agent-harness.json</code>, which stays hand-editable.
        </p>
        {globalMessage ? <p className="openspec-shell-note" role="status">{globalMessage}</p> : null}
        {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
          <MechanicalStageRow key={stage} stage={stage} />
        ) : (
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
            <CustomAgentSelect
              stage={stage}
              agentId={globalStepAgents[stage]}
              ariaLabel={`${stage} custom agent`}
              value={globalCustomAgent[stage]}
              onChange={(value) => setGlobalCustomAgent((prev) => ({ ...prev, [stage]: value }))}
              available={customAgents}
            />
          </div>
        )))}
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
        <p className="openspec-shell-note">
          Saved to <code>openspec/changes/&lt;change&gt;/harness.json</code>, which stays hand-editable.
        </p>
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
            <HarnessTemplatePicker scope="change" onApply={applyChangeTemplate} />
            {STAGES.map((stage) => (!isHarnessStepAgentStage(stage) ? (
              <MechanicalStageRow key={stage} stage={stage} />
            ) : (
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
                <CustomAgentSelect
                  stage={stage}
                  agentId={changeStepAgents[stage]}
                  ariaLabel={`change ${stage} custom agent`}
                  value={changeCustomAgent[stage]}
                  onChange={(value) => setChangeCustomAgent((prev) => ({ ...prev, [stage]: value }))}
                  available={customAgents}
                />
              </div>
            )))}
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
