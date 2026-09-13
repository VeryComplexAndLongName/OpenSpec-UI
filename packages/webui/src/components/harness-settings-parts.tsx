import {
  AGENT_REGISTRY,
  autonomyLevelsFor,
  customAgentFamilyFor,
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
];

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

export type StepAgentsForm = Record<HarnessStepAgentStage, string>;
// "" (INHERIT) means unset in all four, the same sentinel throughout.
export type StepEffortForm = Record<HarnessStepAgentStage, string>;
export type StepBudgetForm = Record<HarnessStepAgentStage, string>;
export type StepCustomAgentForm = Record<HarnessStepAgentStage, string>;

/** The four per-stage fields a settings form holds, together. */
export interface StageForms {
  agents: StepAgentsForm;
  effort: StepEffortForm;
  budget: StepBudgetForm;
  customAgent: StepCustomAgentForm;
}

// A form only ever shows/writes the agent id — no model selector (see
// harness-step-models design.md, Non-Goals). A hand-edited config may
// still carry the object form for a stage; `normalizeStepAgent` reads its
// agent id for display, and the save keeps the model it cannot show.
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

export function stageFormsFrom(stepAgents: HarnessStepAgents | undefined): StageForms {
  return {
    agents: toForm(stepAgents),
    effort: toEffortForm(stepAgents),
    budget: toBudgetForm(stepAgents),
    customAgent: toCustomAgentForm(stepAgents),
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

/** Combines the four per-stage forms back into `HarnessStepAgents`. A
 * stage whose effort/budget is unset (or whose value isn't accepted by
 * its currently-selected agent) writes the plain bare-string form. What
 * the form has no control for — a stage's model — is kept from the file
 * it loaded, while the stage still names the same agent. See
 * settings-save-what-was-shown. */
export function stepAgentsFromForms(forms: StageForms, loaded?: HarnessStepAgents): HarnessStepAgents {
  const result: HarnessStepAgents = {};
  for (const stage of CONFIGURABLE_STAGES) {
    if (forms.agents[stage] === INHERIT) continue;
    const agentId = forms.agents[stage];
    const capabilities = HARNESS_AGENT_CAPABILITIES[agentId];
    const effortValue = forms.effort[stage];
    const budgetRaw = forms.budget[stage].trim();
    const customAgent = forms.customAgent[stage];
    const hasEffort = effortValue !== INHERIT && (capabilities?.effort ?? []).includes(effortValue as HarnessEffort);
    const hasBudget = budgetRaw !== "" && capabilities?.budgetField !== undefined;
    const hasCustomAgent = customAgent !== INHERIT && customAgentFamilyFor(agentId) !== undefined;
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

/** What saving the global view would write. Laid over what was loaded,
 * not built from the fields alone: the writer replaces the file, so a key
 * the view has no field for — `timeout`, `budget`, `gitStageAllowlist` —
 * would be deleted by pressing Save. See settings-save-what-was-shown. */
export function globalConfigToSave(
  loaded: HarnessConfig | null,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel,
): Partial<HarnessConfig> {
  return {
    ...(loaded ?? {}),
    stepAgents: stepAgentsFromForms(forms, loaded?.stepAgents),
    autonomyLevel,
  };
}

/** What saving a change's view would write. As with the global save,
 * layered over what was loaded. Inherit means "not set here", so the
 * autonomy level and review gate are removed rather than carried over. */
export function changeConfigToSave(
  loaded: Partial<HarnessConfig> | null | undefined,
  forms: StageForms,
  autonomyLevel: HarnessAutonomyLevel | "",
  reviewGateMode: HarnessReviewGateMode | "",
): Partial<HarnessConfig> {
  const config: Partial<HarnessConfig> = {
    ...(loaded ?? {}),
    stepAgents: stepAgentsFromForms(forms, loaded?.stepAgents ?? undefined),
  };
  if (autonomyLevel !== INHERIT) config.autonomyLevel = autonomyLevel;
  else delete config.autonomyLevel;
  if (reviewGateMode !== INHERIT) config.reviewGate = { mode: reviewGateMode };
  else delete config.reviewGate;
  return config;
}

/** `archive` and `git` are listed so the chain reads honestly, and carry
 * no pickers: neither invokes an agent, so an agent, effort or budget set
 * here would be a setting nothing reads. */
export function MechanicalStageRow({ stage }: { stage: HarnessStage }) {
  return (
    <div className="openspec-harness-stage-row">
      <span className="openspec-shell-field">
        {stage}
        <span className="openspec-shell-note">runs mechanically — no agent</span>
      </span>
    </div>
  );
}

/** A stage's agent. `emptyLabel` names what the empty value means where
 * it is offered: "(none)" in the global file, and in a change's own file
 * the agent the stage would inherit, and from where. */
export function AgentSelect(
  { stage, value, onChange, emptyLabel, ariaLabel }:
  { stage: string; value: string; onChange: (value: string) => void; emptyLabel: string; ariaLabel: string },
) {
  return (
    <label className="openspec-shell-field">
      {stage}
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT}>{emptyLabel}</option>
        {STAGE_RUNNER_OPTIONS.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Offers only the effort values `agentId` itself accepts — never a value
 * the validator would reject. Renders nothing when `agentId` is unset or
 * has no effort mechanism at all. */
export function EffortSelect(
  { stage, agentId, value, onChange, ariaLabel, emptyLabel = "(none)" }:
  { stage: string; agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; emptyLabel?: string },
) {
  const accepted = HARNESS_AGENT_CAPABILITIES[agentId]?.effort ?? [];
  if (agentId === INHERIT || accepted.length === 0) return null;
  return (
    <label className="openspec-shell-field">
      {stage} effort
      <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={INHERIT}>{emptyLabel}</option>
        {accepted.map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Offers a numeric field in whichever unit `agentId` itself honours.
 * Renders nothing when `agentId` is unset or has no spending-cap
 * mechanism at all — there is no portable "budget" field to fall back to. */
export function BudgetInput(
  { stage, agentId, value, onChange, ariaLabel, placeholder }:
  { stage: string; agentId: string; value: string; onChange: (value: string) => void; ariaLabel: string; placeholder?: string },
) {
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
        {...(placeholder ? { placeholder } : {})}
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
 * the two it is. See custom-agent-picker. */
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
  if (agentId === INHERIT) return null;
  const family = customAgentFamilyFor(agentId);
  if (family === undefined) {
    return (
      <p className="openspec-shell-note" data-testid={`custom-agent-none-${stage}`}>
        {stage}: {agentId} takes no custom agent.
      </p>
    );
  }
  if (available === null) return null;

  // A definition whose file name validation would refuse comes back
  // marked rather than dropped, so the discovery can say it exists. It
  // is still not offered. See a-name-is-checked-before-it-is-used.
  const forFamily = available.agents.filter((agent) => agent.family === family && agent.refused === undefined);
  const refused = available.agents.filter((agent) => agent.family === family && agent.refused !== undefined);
  // A configured name the discovery no longer finds stays selected and
  // is marked, rather than being replaced.
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
          <option value={INHERIT}>{emptyLabel}</option>
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

/** What the configuration on screen cannot do. Rendered above the
 * settings themselves rather than behind a command: a warning someone has
 * to ask for is read by someone who already suspects the problem.
 *
 * Nothing is rendered when there is nothing to say. A surface that warns
 * about a correct configuration becomes noise people learn to ignore. */
export function HarnessFindingsPanel({ findings }: { findings: readonly HarnessFinding[] }) {
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

/** The one form of a failure message both views use. */
export function describeFailure(verb: "Load" | "Save", error: unknown): string {
  return `${verb} failed: ${error instanceof Error ? error.message : String(error)}`;
}
