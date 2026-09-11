// Everything that can stop a chain before it starts, answered in one
// place — see docs/adr/0020-cli-runs-a-change.md decision 5 and
// openspec/changes/a-change-runs-from-the-terminal/design.md, "Every
// refusal happens before anything is spent".
//
// The interactive hosts can afford to discover a missing agent when the
// chain reaches that stage: a person is watching, and the two stages
// already paid for were paid for in front of them. An unattended run
// cannot — a chain that dies at `apply` has spent `propose` and `review`
// on a change that was never going to finish. So this resolves the whole
// run's preconditions first, and any one of them refuses the run without
// invoking anything.
//
// In core rather than in the CLI because the answer is not a terminal's
// business: a host that wanted to grey out its own "Run" button, or say
// why it is greyed, should read it from here instead of re-deriving the
// same six conditions.

import { access } from "node:fs/promises";
import path from "node:path";
import type { AgentRunner } from "./agent-runner.js";
import { isValidChangeName } from "./change-name.js";
import {
  type HarnessConfig,
  type HarnessStepAgentStage,
  isHarnessStepAgentStage,
  normalizeStepAgent,
  resolveHarnessConfig,
  resolveRunWithHarnessTarget,
} from "./harness-config.js";
import { CHAIN_STAGES } from "./harness-chain-runner.js";

/** Why a chain will not be started, and where the decision lives.
 *
 * `configKey` is the point of this being a structure rather than a
 * string: a refusal a reader can act on names the setting that governs
 * it, and the setting is in a file they can edit and commit — not in a
 * flag they would have to remember to pass again. Absent where no setting
 * governs the refusal (a change that does not exist, an agent this build
 * does not ship). */
export interface ChainStartRefusal {
  reason: string;
  configKey?: string;
}

export type ChainStartResolution =
  | { ok: true; config: HarnessConfig; changeDir: string }
  | { ok: false; refusal: ChainStartRefusal };

export interface ChainStartRequest {
  workspaceRoot: string;
  changeName: string;
  /** Whether a confirmation this change's configuration asks for can
   * actually be put to somebody. `false` for a process whose input is not
   * a terminal — a CI job, a cron entry, a run with its stdin closed.
   *
   * A `false` here is not a way to skip the confirmation: it refuses the
   * run. Nothing in this module can make a configured checkpoint go
   * away. */
  canAnswerCheckpoints: boolean;
  /** The same resolver the chain runner is given, so the agent this
   * checks for is the agent that stage would actually get, including the
   * fallback to the default agent for a stage with no `stepAgents`
   * entry. */
  resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
}

async function exists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/** The stages that invoke an agent, in the order the chain runs them.
 * `archive` and `git` are mechanical and resolve no runner, so a missing
 * agent cannot stop them. */
function agentStages(): HarnessStepAgentStage[] {
  return CHAIN_STAGES.filter((stage): stage is HarnessStepAgentStage => isHarnessStepAgentStage(stage));
}

/** Resolves everything a chain needs before its first stage, and returns
 * either the configuration to run it with or the one reason it will not
 * run.
 *
 * The order is deliberate: cheapest and most likely first, so a typo in a
 * change name never reaches a filesystem read of a configuration, and no
 * refusal is reported behind a different one. Only the last check touches
 * the agent registry. */
export async function resolveChainStart(request: ChainStartRequest): Promise<ChainStartResolution> {
  const { workspaceRoot, changeName, canAnswerCheckpoints, resolveRunner } = request;

  if (!isValidChangeName(changeName)) {
    return {
      ok: false,
      refusal: { reason: `"${changeName}" is not a valid change name` },
    };
  }

  const changeDir = path.resolve(workspaceRoot, "openspec", "changes", changeName);
  if (!(await exists(changeDir))) {
    return {
      ok: false,
      refusal: {
        reason: `no active change named "${changeName}" in ${path.join("openspec", "changes")}`
          + " — an archived change is finished and is not re-run",
      },
    };
  }

  let config: HarnessConfig;
  try {
    config = await resolveHarnessConfig(workspaceRoot, changeName);
  } catch (error) {
    return {
      ok: false,
      refusal: {
        reason: `this change's harness configuration could not be read: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }

  if (resolveRunWithHarnessTarget(config) !== "chain") {
    return {
      ok: false,
      refusal: {
        reason: `this change's autonomyLevel is "${config.autonomyLevel}", which starts one stage at a time`
          + " through a picker rather than running a chain. There is nothing to open here;"
          + " start the stage from the standalone shell or the VS Code command, or set a"
          + " chain-running autonomy level for this change.",
        configKey: "autonomyLevel",
      },
    };
  }

  // Absent means confirmation required — the same reading the chain
  // runner applies, and the reason this is `!== false` rather than a
  // truthiness test.
  const wantsCheckpoints = config.checkpoints?.requireConfirmationBetweenSteps !== false;
  if (wantsCheckpoints && !canAnswerCheckpoints) {
    return {
      ok: false,
      refusal: {
        reason: "this change's configuration pauses between stages for a confirmation, and there is"
          + " no terminal here to put that choice to. Run it where somebody can answer, or set"
          + ` checkpoints.requireConfirmationBetweenSteps to false in openspec/changes/${changeName}/harness.json`
          + " to say that this change may run unattended.",
        configKey: "checkpoints.requireConfirmationBetweenSteps",
      },
    };
  }

  for (const stage of agentStages()) {
    const entry = config.stepAgents[stage];
    const agentId = entry === undefined ? undefined : normalizeStepAgent(entry).agent;
    if (resolveRunner(agentId) !== undefined) continue;
    return {
      ok: false,
      refusal: {
        reason: agentId
          ? `the "${stage}" stage names agent "${agentId}", which this build has no runner for`
          : `the "${stage}" stage has no agent configured and this build has no default runner`,
        configKey: `stepAgents.${stage}`,
      },
    };
  }

  return { ok: true, config, changeDir };
}
