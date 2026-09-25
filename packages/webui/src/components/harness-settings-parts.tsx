import type { ReactNode } from "react";
import {
  AGENT_REGISTRY,
  autonomyLevelsFor,
  customAgentFamilyFor,
  groupHarnessFindings,
  HARNESS_AGENT_CAPABILITIES,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  resolveEffortLevel,
  VSCODE_CHAT_STEP_AGENT_ID,
  type HarnessAutonomyLevel,
  type HarnessConfig,
  type HarnessEffort,
  type HarnessEffortLevel,
  type HarnessFinding,
  type HarnessReviewGateMode,
  type HarnessStage,
  type HarnessStepAgent,
  type HarnessStepAgentStage,
  type HarnessStepAgents,
  type HarnessTemplate,
} from "@openspec-ui/core/browser";
import type { CustomAgentsResult } from "../custom-agents-client.js";
import { Icon } from "./Icon.js";

// The pieces the two harness settings views share. The global file and a
// change's own override were one view until a-change-is-configured-from-the-change:
// a command named "for this Change" opened a page about the whole
// workspace, and the change's name was lost on the way to the form. Each
// view now edits one file, and what they have in common lives here.

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

export const STAGES: readonly HarnessStage[] = ["propose", "review", "apply", "verify", "archive", "git"];
/** Every stage is listed — each runs, and hiding one would misrepresent
 * the chain — but only these can carry an entry. `archive` (mechanical)
 * and `git` (its own push/PR/merge sequence) invoke no agent, so neither
 * has anything to configure and both are rendered without pickers rather
 * than with pickers that write a setting nothing reads. See
 * harness-mechanical-checks tasks.md 4.4 (`archive`) and
 * harness-git-stage-no-agent tasks.md 3.1 (`git`). */
export const CONFIGURABLE_STAGES: readonly HarnessStepAgentStage[] = STAGES.filter(isHarnessStepAgentStage);
/** Stands in only while the global file has not been read yet — the
 * same shape `readGlobalHarnessConfig` returns for a workspace that has
 * no global file at all, so a configuration applied before the read
 * lands behaves as it would in that workspace rather than throwing. */
export const NO_GLOBAL_CONFIG: HarnessConfig = {
  stepAgents: {},
  autonomyLevel: "assisted",
  reviewGate: { mode: "human-required" },
};
export const INHERIT = "" as const;
const STAGE_RUNNER_OPTIONS = [
  ...AGENT_REGISTRY,
  { id: VSCODE_CHAT_STEP_AGENT_ID, label: "VS Code Chat (dispatch target)" },
].map((agent) => {
  // A registry label can carry a caveat after a dash — "Claude CLI (ACP) —
  // progress only, no permission gate". A select in a table column cuts it
  // off mid-word, so the option names the agent and the caveat is said
  // under the table (the-harness-settings-look-like-the-mockup).
  const [name, ...caveat] = agent.label.split(" — ");
  return { id: agent.id, label: agent.label, name: name!, caveat: caveat.length === 0 ? undefined : caveat.join(" — ") };
});

/** Named by what running under each one does.
 *
 * Two of these read "(not yet implemented)" until 2026-09-11, of levels
 * the chain runner has treated distinctly, and tested, for as long as
 * it has existed — so the only difference the surface offered between
 * three choices was a claim about which ones worked, and it was false.
 *
 * `autonomous` is absent from the global scope because
 * `writeGlobalHarnessConfig` refuses it: it is reachable only from a
 * change's own `harness.json`. See an-autonomy-level-says-what-it-does. */
const AUTONOMY_LEVEL_LABELS: Readonly<Record<HarnessAutonomyLevel, string>> = {
  "assisted": "assisted — one stage at a time, a chain is refused",
  "semi-autonomous": "semi-autonomous — a chain, confirming between stages",
  "autonomous": "autonomous — a chain with no confirmations, this change only",
};

/** Which levels a scope offers is core's answer, not a view's: the
 * writer already refuses `autonomous` in a workspace-level file, and a
 * second list here is how the two came to disagree. */
export function autonomyLevelOptionsFor(scope: "global" | "change"): ReadonlyArray<{ value: HarnessAutonomyLevel; label: string }> {
  return autonomyLevelsFor(scope).map((value) => ({ value, label: AUTONOMY_LEVEL_LABELS[value] }));
}

/** A level's label in its two parts, for a segment that names the level and
 * a line under it that says what the level does. */
export function autonomyLevelParts(level: HarnessAutonomyLevel): { name: string; does: string } {
  const [name, ...rest] = AUTONOMY_LEVEL_LABELS[level].split(" — ");
  const title = name!.charAt(0).toUpperCase() + name!.slice(1);
  const does = rest.join(" — ");
  return { name: title, does: does.charAt(0).toUpperCase() + does.slice(1) };
}

export type StepAgentsForm = Record<HarnessStepAgentStage, string>;
// "" (INHERIT) means unset in all five, the same sentinel throughout.
export type StepEffortForm = Record<HarnessStepAgentStage, string>;
export type StepBudgetForm = Record<HarnessStepAgentStage, string>;
export type StepCustomAgentForm = Record<HarnessStepAgentStage, string>;
export type StepModelForm = Record<HarnessStepAgentStage, string>;

/** The five per-stage fields a settings form holds, together. */
export interface StageForms {
  agents: StepAgentsForm;
  effort: StepEffortForm;
  budget: StepBudgetForm;
  customAgent: StepCustomAgentForm;
  model: StepModelForm;
}

/** Whether an agent's registry entry says its CLI takes a model. */
export function acceptsModel(agentId: string): boolean {
  return AGENT_REGISTRY.some((agent) => agent.id === agentId && agent.modelFlag !== undefined);
}

// A hand-edited config may carry the object form for a stage;
// `normalizeStepAgent` reads its agent id for display. The model has its own
// field since the-harness-settings-look-like-the-mockup; until then the form
// kept a model it could not show (harness-step-models design.md, Non-Goals).
export function toForm(stepAgents: HarnessStepAgents | undefined): StepAgentsForm {
  const form = {} as StepAgentsForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined ? INHERIT : normalizeStepAgent(entry).agent;
  }
  return form;
}

export function toEffortForm(stepAgents: HarnessStepAgents | undefined): StepEffortForm {
  const form = {} as StepEffortForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.effort ?? INHERIT;
  }
  return form;
}

export function toBudgetForm(stepAgents: HarnessStepAgents | undefined): StepBudgetForm {
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

export function toCustomAgentForm(stepAgents: HarnessStepAgents | undefined): StepCustomAgentForm {
  const form = {} as StepCustomAgentForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.customAgent ?? INHERIT;
  }
  return form;
}

export function toModelForm(stepAgents: HarnessStepAgents | undefined): StepModelForm {
  const form = {} as StepModelForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const entry = stepAgents?.[stage];
    form[stage] = entry === undefined || typeof entry === "string" ? INHERIT : entry.model ?? INHERIT;
  }
  return form;
}

export function stageFormsFrom(stepAgents: HarnessStepAgents | undefined): StageForms {
  return {
    agents: toForm(stepAgents),
    effort: toEffortForm(stepAgents),
    budget: toBudgetForm(stepAgents),
    customAgent: toCustomAgentForm(stepAgents),
    model: toModelForm(stepAgents),
  };
}

/** The effort each stage gets from a named configuration, resolved
 * against the agent that stage has on screen.
 *
 * A configuration carries a level and not a value, so there is nothing to
 * copy across: `max` is a value `claude` accepts and `codex` does not.
 * A stage with no agent chosen, or one whose agent accepts no effort,
 * keeps its inherited setting rather than being given a value it would
 * be refused for. See presets-by-effort. */
export function effortFormFor(level: HarnessEffortLevel, agents: StepAgentsForm): StepEffortForm {
  const form = {} as StepEffortForm;
  for (const stage of CONFIGURABLE_STAGES) {
    const agent = agents[stage];
    form[stage] = (agent === INHERIT ? undefined : resolveEffortLevel(agent, level).effort) ?? INHERIT;
  }
  return form;
}

/** What applying one just did, said rather than left to be noticed.
 *
 * Three facts, each said only where it is true: which stages were given
 * an effort, which stages have an agent that takes none, and which
 * stages have no agent at all. See a-stage-override-keeps-its-custom-agent. */
function templateEffortNote(
  template: HarnessTemplate,
  effort: StepEffortForm,
  agents: StepAgentsForm,
): string {
  const set = CONFIGURABLE_STAGES.filter((stage) => effort[stage] !== INHERIT);
  const takesNone = CONFIGURABLE_STAGES.filter((stage) => agents[stage] !== INHERIT && effort[stage] === INHERIT);
  const noAgent = CONFIGURABLE_STAGES.filter((stage) => agents[stage] === INHERIT);
  // Where every stage has an agent and none of those agents takes an
  // effort, the configurations differ only in their ceilings — and
  // saying so is the difference between a dial that does nothing and a
  // dial that does nothing silently.
  if (set.length === 0 && noAgent.length === 0 && takesNone.length > 0) {
    return "None of the agents on screen takes an effort setting, so only the ceilings changed.";
  }
  const notes: string[] = [];
  if (set.length > 0) {
    notes.push(
      `Effort set to ${template.effortLevel} of what each agent accepts: `
      + `${set.map((stage) => `${stage} ${effort[stage]}`).join(", ")}.`,
    );
  }
  if (takesNone.length > 0) {
    notes.push(
      `No effort for ${takesNone.map((stage) => `${stage} (${agents[stage]})`).join(", ")}: `
      + `${takesNone.length === 1 ? "that agent takes" : "those agents take"} none.`,
    );
  }
  if (noAgent.length > 0) {
    notes.push(`No agent is chosen for ${noAgent.join(", ")}, so nothing was set there.`);
  }
  return notes.join(" ");
}

export function templateAppliedMessage(
  template: HarnessTemplate,
  effort: StepEffortForm,
  agents: StepAgentsForm,
): string {
  return `Filled from "${template.title}". ${templateEffortNote(template, effort, agents)}`
    + " The agents and models on screen are unchanged. Nothing is saved until you save.";
}

/** The per-change twin. Applying a configuration to a change writes the
 * agent beside the effort for a stage that was inheriting one, so this
 * one cannot claim, as the global one truthfully can, that the agents on
 * screen are unchanged. It names the stages whose agent it did change. */
export function changeTemplateAppliedMessage(
  template: HarnessTemplate,
  effort: StepEffortForm,
  agents: StepAgentsForm,
  reset: readonly HarnessStepAgentStage[],
): string {
  const agentNote = reset.length === 0
    ? " The agents and models on screen are unchanged."
    : ` ${reset.join(", ")} now name${reset.length === 1 ? "s" : ""} the agent the change resolves to,`
      + " because an effort without its agent means nothing.";
  return `Filled from "${template.title}". ${templateEffortNote(template, effort, agents)}${agentNote}`
    + " Nothing is saved until you save.";
}

/** Combines the five per-stage forms back into `HarnessStepAgents`. A
 * stage whose fields are unset (or whose values aren't accepted by its
 * currently-selected agent) writes the plain bare-string form. The model is
 * the form's own field, written only for an agent that takes one. See
 * settings-save-what-was-shown. */
export function stepAgentsFromForms(forms: StageForms): HarnessStepAgents {
  const result: HarnessStepAgents = {};
  for (const stage of CONFIGURABLE_STAGES) {
    if (forms.agents[stage] === INHERIT) continue;
    const agentId = forms.agents[stage];
    const capabilities = HARNESS_AGENT_CAPABILITIES[agentId];
    const effortValue = forms.effort[stage];
    const budgetRaw = forms.budget[stage].trim();
    const customAgent = forms.customAgent[stage];
    const modelValue = forms.model[stage].trim();
    const hasEffort = effortValue !== INHERIT && (capabilities?.effort ?? []).includes(effortValue as HarnessEffort);
    const hasBudget = budgetRaw !== "" && capabilities?.budgetField !== undefined;
    const hasCustomAgent = customAgent !== INHERIT && customAgentFamilyFor(agentId) !== undefined;
    const hasModel = modelValue !== "" && acceptsModel(agentId);

    if (!hasEffort && !hasBudget && !hasCustomAgent && !hasModel) {
      result[stage] = agentId;
      continue;
    }
    const entry: Exclude<HarnessStepAgent, string> = { agent: agentId };
    if (hasModel) entry.model = modelValue;
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

/** What saving the global view would write. Laid over what was loaded,
 * not built from the fields alone: the writer replaces the file, so a key
 * the view has no field for — `timeout`, `budget`, `gitStageAllowlist` —
 * would be deleted by pressing Save. See settings-save-what-was-shown. */
export function globalConfigToSave(
  loaded: HarnessConfig | null,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel,
  runBudget: string,
): Partial<HarnessConfig> {
  return withRunBudget({
    ...(loaded ?? {}),
    stepAgents: stepAgentsFromForms(forms),
    autonomyLevel,
  }, runBudget);
}

/** What saving a change's view would write. As with the global save,
 * layered over what was loaded. Inherit means "not set here", so the
 * autonomy level, review gate and run budget are removed rather than
 * carried over. */
export function changeConfigToSave(
  loaded: Partial<HarnessConfig> | null | undefined,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel | "",
  reviewGateMode: HarnessReviewGateMode | "",
  runBudget: string,
): Partial<HarnessConfig> {
  const config: Partial<HarnessConfig> = {
    ...(loaded ?? {}),
    stepAgents: stepAgentsFromForms(forms),
  };
  if (autonomyLevel !== INHERIT) config.autonomyLevel = autonomyLevel;
  else delete config.autonomyLevel;
  if (reviewGateMode !== INHERIT) config.reviewGate = { mode: reviewGateMode };
  else delete config.reviewGate;
  return withRunBudget(config, runBudget);
}

/** The run budget as the field shows it: the chain's cost ceiling, or empty. */
export function runBudgetFrom(config: Partial<HarnessConfig> | null | undefined): string {
  const value = config?.budget?.maxCostUsd;
  return value === undefined ? INHERIT : String(value);
}

/** Lays the run budget field over a configuration's `budget`, keeping its
 * other ceilings. Empty removes `maxCostUsd`, and a budget left with nothing
 * in it is removed. */
function withRunBudget(config: Partial<HarnessConfig>, runBudget: string): Partial<HarnessConfig> {
  const { maxCostUsd: _replaced, ...others } = config.budget ?? {};
  const raw = runBudget.trim();
  const budget = raw === "" ? others : { ...others, maxCostUsd: Number(raw) };
  const result = { ...config };
  if (Object.keys(budget).length === 0) delete result.budget;
  else result.budget = budget;
  return result;
}

/** The columns of the stage table, in order. Each cell carries its column's
 * name, which the narrow layout draws above the field. */
export const STAGE_COLUMNS = ["Stage", "Agent", "Model", "Effort", "Max cost"] as const;

/** The stages as ADR 0033's mockup draws them: a header, then one grid row
 * per stage (the-harness-settings-look-like-the-mockup). */
export function StageTable({ children }: { children: ReactNode }) {
  return (
    <div className="openspec-stage-table">
      <div className="openspec-stage-grid openspec-stage-head" aria-hidden="true">
        {STAGE_COLUMNS.map((column) => <span key={column}>{column}</span>)}
      </div>
      {children}
    </div>
  );
}

function StageName({ stage }: { stage: HarnessStage }) {
  return (
    <span className="openspec-stage-name">
      <span className="openspec-stage-number" aria-hidden="true">{STAGES.indexOf(stage) + 1}</span>
      {stage}
    </span>
  );
}

/** One configurable stage: its number and name, then its fields' cells. */
export function StageRow({ stage, children }: { stage: HarnessStage; children: ReactNode }) {
  return (
    <div className="openspec-stage-grid openspec-harness-stage-row" data-testid={`stage-row-${stage}`}>
      <StageName stage={stage} />
      {children}
    </div>
  );
}

/** `archive` and `git` are listed so the chain reads honestly, and carry
 * no pickers: neither invokes an agent, so an agent, effort or budget set
 * here would be a setting nothing reads. */
export function MechanicalStageRow({ stage }: { stage: HarnessStage }) {
  return (
    <div className="openspec-stage-grid openspec-harness-stage-row openspec-stage-row--mechanical" data-testid={`stage-row-${stage}`}>
      <StageName stage={stage} />
      <span className="openspec-stage-mechanical">Runs mechanically — no agent</span>
    </div>
  );
}

/** A cell whose field the stage's agent does not take: a dash, and the
 * reason, which a screen reader reads and a pointer shows. The cell stays so
 * the row keeps its columns. */
function NotTaken({ column, reason }: { column: string; reason: string }) {
  return (
    <span className="openspec-stage-cell" data-label={column}>
      <span className="openspec-stage-none" title={reason}>
        <span aria-hidden="true">—</span>
        <span className="openspec-visually-hidden">{reason}</span>
      </span>
    </span>
  );
}

/** Why a field is not offered for a stage with no agent of its own. */
function noAgentReason(field: string, inherits: boolean): string {
  return inherits
    ? `Inherited with the stage's agent; choose an agent here to set its ${field}`
    : `No agent is chosen for this stage, so there is no ${field} to set`;
}

/** A stage's agent, with what belongs under it — the custom agent picker.
 * `emptyLabel` names what the empty value means where it is offered:
 * "(none)" in the global file, and in a change's own file the agent the
 * stage would inherit, and from where. */
export function AgentSelect(
  { value, onChange, emptyLabel, ariaLabel, children }:
  { value: string; onChange: (value: string) => void; emptyLabel: string; ariaLabel: string; children?: ReactNode },
) {
  const chosen = STAGE_RUNNER_OPTIONS.find((agent) => agent.id === value);
  return (
    <span className="openspec-stage-cell openspec-stage-cell--agent" data-label="Agent">
      <select aria-label={ariaLabel} value={value} title={chosen?.label ?? emptyLabel} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT}>{emptyLabel}</option>
        {STAGE_RUNNER_OPTIONS.map((agent) => (
          <option key={agent.id} value={agent.id} title={agent.label}>
            {agent.name}
          </option>
        ))}
      </select>
      {children}
    </span>
  );
}

/** A stage's model, as its CLI names it. A text field: this product keeps
 * no list of vendor model ids (ADR 0015), and core's validator refuses a
 * malformed one when the file is written. Offered only for an agent whose
 * CLI takes a model. */
export function ModelInput(
  { agentId, value, onChange, ariaLabel, placeholder, inherits = false }:
  { agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string; inherits?: boolean },
) {
  if (agentId === INHERIT) return <NotTaken column="Model" reason={noAgentReason("model", inherits)} />;
  if (!acceptsModel(agentId)) return <NotTaken column="Model" reason={`${agentId} takes no model`} />;
  return (
    <span className="openspec-stage-cell" data-label="Model">
      <input
        type="text"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder ?? "the agent's default"}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

/** Offers only the effort values `agentId` itself accepts — never a value
 * the validator would reject. A dash where `agentId` is unset or has no
 * effort mechanism at all. */
export function EffortSelect(
  { agentId, value, onChange, ariaLabel, emptyLabel = "(none)", inherits = false }:
  { agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; emptyLabel?: string; inherits?: boolean },
) {
  const accepted = HARNESS_AGENT_CAPABILITIES[agentId]?.effort ?? [];
  if (agentId === INHERIT) return <NotTaken column="Effort" reason={noAgentReason("effort", inherits)} />;
  if (accepted.length === 0) return <NotTaken column="Effort" reason={`${agentId} takes no effort setting`} />;
  return (
    <span className="openspec-stage-cell" data-label="Effort">
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT}>{emptyLabel}</option>
        {accepted.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </span>
  );
}

/** Offers a numeric field in whichever unit `agentId` itself honours. A
 * dash where `agentId` is unset or has no spending-cap mechanism at all —
 * there is no portable "budget" field to fall back to. */
export function BudgetInput(
  { agentId, value, onChange, ariaLabel, placeholder, inherits = false }:
  { agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string; inherits?: boolean },
) {
  const budgetField = HARNESS_AGENT_CAPABILITIES[agentId]?.budgetField;
  if (agentId === INHERIT) return <NotTaken column="Max cost" reason={noAgentReason("spending cap", inherits)} />;
  if (budgetField === undefined) return <NotTaken column="Max cost" reason={`${agentId} takes no spending cap`} />;
  const dollars = budgetField === "maxCostUsd";
  return (
    <span className="openspec-stage-cell" data-label={dollars ? "Max cost" : "Max AI credits"}>
      <span className={dollars ? "openspec-amount openspec-amount--dollars" : "openspec-amount openspec-amount--credits"}>
        {dollars ? <span className="openspec-amount-unit" aria-hidden="true">$</span> : null}
        <input
          type="number"
          aria-label={ariaLabel}
          value={value}
          min={dollars ? 0 : 30}
          step={dollars ? "any" : 1}
          placeholder={placeholder ?? "—"}
          onChange={(e) => onChange(e.target.value)}
        />
        {dollars ? null : <span className="openspec-amount-unit" aria-hidden="true">credits</span>}
      </span>
    </span>
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
 * none, or the workspace defines none for that CLI, `CustomAgentNotes` says
 * which of the two it is, once per CLI under the stage table. See
 * custom-agent-picker. */
export function CustomAgentSelect(
  { stage, agentId, value, onChange, ariaLabel, available, emptyLabel = "(none)" }:
  {
    stage: string;
    agentId: string;
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    available: CustomAgentsResult | null;
    emptyLabel?: string;
  },
) {
  if (agentId === INHERIT || available === null) return null;
  const family = customAgentFamilyFor(agentId);
  if (family === undefined) return null;

  const forFamily = offeredFor(available, family);
  // A configured name the discovery no longer finds stays selected and
  // is marked, rather than being replaced.
  const missing = value !== INHERIT && !forFamily.some((agent) => agent.name === value);
  if (forFamily.length === 0 && !missing) return null;

  return (
    <select
      aria-label={ariaLabel}
      className="openspec-stage-custom-agent"
      data-testid={`custom-agent-select-${stage}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value={INHERIT}>{emptyLabel === "(none)" ? "(no custom agent)" : emptyLabel}</option>
      {missing ? <option value={value}>{value} (not found)</option> : null}
      {forFamily.map((agent) => (
        <option key={agent.name} value={agent.name}>
          {agent.description === undefined ? agent.name : `${agent.name} — ${agent.description}`}
        </option>
      ))}
    </select>
  );
}

// A definition whose file name validation would refuse comes back marked
// rather than dropped, so the discovery can say it exists. It is still not
// offered. See a-name-is-checked-before-it-is-used.
function offeredFor(available: CustomAgentsResult, family: string) {
  return available.agents.filter((agent) => agent.family === family && agent.refused === undefined);
}

/** What the stage table does not show, said once per agent or CLI rather
 * than under every stage: the caveat an agent's name carries, which chosen
 * agents take no custom agent, which CLIs the workspace defines none for and
 * where it looked, and which definitions were found and refused. */
export function StageNotes({ agents, available }: { agents: StepAgentsForm; available: CustomAgentsResult | null }) {
  const byAgent = new Map<string, HarnessStepAgentStage[]>();
  const takesNone = new Map<string, HarnessStepAgentStage[]>();
  const byFamily = new Map<string, HarnessStepAgentStage[]>();
  for (const stage of CONFIGURABLE_STAGES) {
    const agentId = agents[stage];
    if (agentId === INHERIT) continue;
    byAgent.set(agentId, [...(byAgent.get(agentId) ?? []), stage]);
    const family = customAgentFamilyFor(agentId);
    const group = family === undefined ? takesNone : byFamily;
    const key = family ?? agentId;
    group.set(key, [...(group.get(key) ?? []), stage]);
  }

  const notes: ReactNode[] = [];
  for (const [agentId, stages] of byAgent) {
    const agent = STAGE_RUNNER_OPTIONS.find((option) => option.id === agentId);
    if (agent?.caveat === undefined) continue;
    notes.push(
      <p key={`caveat-${agentId}`} data-testid={`agent-caveat-${agentId}`}>
        {agent.name}: {agent.caveat} ({stages.join(", ")}).
      </p>,
    );
  }
  for (const [agentId, stages] of takesNone) {
    notes.push(
      <p key={`none-${agentId}`} data-testid={`custom-agent-none-${agentId}`}>
        {agentId} takes no custom agent ({stages.join(", ")}).
      </p>,
    );
  }
  if (available !== null) {
    for (const [family, stages] of byFamily) {
      if (offeredFor(available, family).length === 0) {
        const directories = available.directories.filter((entry) => entry.family === family).map((entry) => entry.path);
        notes.push(
          <p key={`empty-${family}`} data-testid={`custom-agent-empty-${family}`}>
            No custom agents are defined for {family} ({stages.join(", ")}). Read from {directories.join(" and ")}.
          </p>,
        );
      }
      const refused = available.agents.filter((agent) => agent.family === family && agent.refused !== undefined);
      if (refused.length > 0) {
        notes.push(
          <p key={`refused-${family}`} data-testid={`custom-agent-refused-${family}`}>
            Found for {family} but not offered — {refused.map((agent) => agent.refused).join("; ")}
          </p>,
        );
      }
    }
  }
  return notes.length === 0 ? null : <div className="openspec-harness-notes" data-testid="stage-notes">{notes}</div>;
}

/** What the configuration on screen cannot do. Rendered above the
 * settings themselves rather than behind a command: a warning someone has
 * to ask for is read by someone who already suspects the problem. Drawn as
 * the mockup's warning callout.
 *
 * Nothing is rendered when there is nothing to say. A surface that warns
 * about a correct configuration becomes noise people learn to ignore. */
export function HarnessFindingsPanel({ findings }: { findings: readonly HarnessFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <section className="openspec-callout openspec-harness-findings" data-testid="harness-findings">
      <span className="openspec-callout-icon"><Icon meaning="warning" /></span>
      <div className="openspec-callout-body">
        <h3>What this configuration cannot do</h3>
        <ul>
          {/* Said once each, naming every stage it holds on: four lines that
              differed in one word read as four problems (a-warning-is-said-once). */}
          {groupHarnessFindings(findings).map((group) => (
            <li key={`${group.kind}:${group.agent}:${group.stages.join("-")}`} data-testid={`harness-finding-${group.stages.join("-")}`}>
              {group.message}
            </li>
          ))}
        </ul>
        <p className="openspec-callout-fine">
          These settings are valid and will be saved. A ceiling that cannot act is otherwise
          indistinguishable from one that has not acted yet.
        </p>
      </div>
    </section>
  );
}

/** The foot of a settings panel: Save, Discard, what is unsaved, what the
 * last load or save said, and where the file is. */
export function SettingsFoot(
  { saveLabel, onSave, onDiscard, loading, dirty, message, testIdPrefix, children }: {
    saveLabel: string;
    onSave: () => void;
    onDiscard: () => void;
    loading: boolean;
    dirty: boolean;
    message: string | null;
    testIdPrefix: string;
    /** Where the file is saved, and anything else said at the right. */
    children: ReactNode;
  },
) {
  return (
    <div className="openspec-harness-foot">
      <button type="button" className="button primary" onClick={onSave} disabled={loading || !dirty}>
        <Icon meaning="ok" />
        {loading ? "Working..." : saveLabel}
      </button>
      <button type="button" className="button openspec-button-quiet" data-testid={`${testIdPrefix}-discard`} onClick={onDiscard} disabled={loading || !dirty}>
        Discard
      </button>
      {dirty ? <span className="openspec-harness-foot-unsaved" data-testid={`${testIdPrefix}-unsaved`}>Unsaved changes</span> : null}
      {message ? <span className="openspec-harness-foot-message" role="status" data-testid={`${testIdPrefix}-message`}>{message}</span> : null}
      <span className="openspec-harness-foot-file">{children}</span>
    </div>
  );
}

/** The one form of a failure message both views use. */
export function describeFailure(verb: "Load" | "Save", error: unknown): string {
  return `${verb} failed: ${error instanceof Error ? error.message : String(error)}`;
}
