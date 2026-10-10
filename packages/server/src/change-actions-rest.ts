// A change's actions, for the standalone app's cards (ADR 0044,
// a-change-is-acted-on-from-its-card). Every action a card offers in the
// editor runs here too, so neither host has one the other lacks.
//
// The route takes the workspace (`cwd`, checked as every route checks it), a
// change's name and the action; the directory the action runs in is the
// server's to find - the change's own worktree where it is worked in one -
// never a path from the request. A writing action is refused where that
// directory's records do not check out.

import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  CHANGE_RELATION_KEYS,
  PAGE_CHANGE_ACTIONS,
  archiveChange,
  askLiveRunToStop,
  buildChangeCostReport,
  changeAction,
  changeActionRoot,
  changeAncestry,
  commitChange,
  createGitWrapper,
  deleteChange,
  editChangeRelation,
  findHarnessConfigLimits,
  getChangeTimeline,
  isChangeActionId,
  isTaskNumber,
  isValidChangeName,
  openTaskCount,
  readAgentStatuses,
  readChangeDiff,
  readChangeGraph,
  readRepositoryAuditEntries,
  readTaskChecklist,
  recommendTemplate,
  renderChangeCostReport,
  resolveAgentStatusDirectory,
  resolveHarnessConfig,
  sayCommitChange,
  sayToLiveRun,
  validateChange,
  withMessageCode,
  type ChangeActionAnswer,
  type ChangeActionId,
  type ChangeActionInput,
  type ChangeActionRoot,
  type ChangeGraphNode,
  type ChangeRelationKey,
  type WorkbenchRecoveryService,
} from "@openspec-ui/core";
import { authorizeCwd, readJsonBody, sendBodyError, sendJson, type RestRequestPolicy } from "./rest.js";

export interface ChangeActionSeams {
  /** The recovery service of a working directory, which a rollback asks. */
  resolveRecoveryService: (cwd: string) => Promise<WorkbenchRecoveryService>;
  /** Opens a folder in the system's file manager. */
  openFolder?: (folder: string) => void;
  /** Test seam for where the action runs. */
  root?: (workspaceRoot: string, changeName: string) => Promise<ChangeActionRoot>;
}

interface ChangeActionRequest {
  cwd: string;
  changeName: string;
  action: ChangeActionId;
  input?: ChangeActionInput;
}

function isChangeActionRequest(value: unknown): value is ChangeActionRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.cwd === "string" && record.cwd.trim().length > 0
    && isValidChangeName(record.changeName)
    && isChangeActionId(record.action)
    && (record.input === undefined || (typeof record.input === "object" && record.input !== null));
}

/** The system's own way to show a folder. Detached: the server does not
 * wait on a file manager. */
function openFolderInSystem(folder: string): void {
  const command = process.platform === "win32" ? "explorer" : process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [folder], { detached: true, stdio: "ignore" }).unref();
}

async function liveRunOf(workspaceRoot: string, changeName: string): Promise<{ statusDirectory: string; instanceId: string } | undefined> {
  let statusDirectory: string;
  let reports: Awaited<ReturnType<typeof readAgentStatuses>>["reports"];
  try {
    statusDirectory = await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot);
    ({ reports } = await readAgentStatuses(statusDirectory));
  } catch {
    // No status records to read - not a repository git can answer for: no
    // run reports itself, so nothing is running.
    return undefined;
  }
  const live = reports.find((report) => report.changeName === changeName && !report.gone && report.signature !== "does-not-check-out");
  return live === undefined ? undefined : { statusDirectory, instanceId: live.instanceId };
}

/** The changes a node names under one relation key: the file says
 * `blocked_by`, and the node reads it as `blockedBy`. */
function named(node: ChangeGraphNode | undefined, key: ChangeRelationKey): readonly string[] {
  if (node === undefined) return [];
  return key === "blocked_by" ? node.blockedBy : node[key];
}

function report(title: string, markdown: string): ChangeActionAnswer {
  return { kind: "report", title, markdown };
}

function done(message: string): ChangeActionAnswer {
  return { kind: "done", message };
}

/** A refusal is an answer, not a transport failure. */
class Refused extends Error {}

async function perform(request: ChangeActionRequest, at: ChangeActionRoot, seams: ChangeActionSeams): Promise<ChangeActionAnswer> {
  const { changeName, cwd } = request;
  const name = changeName;
  switch (request.action) {
    case "validateChange": {
      const result = await validateChange(name, { cwd: at.root });
      const failed = result.items.filter((item) => !item.valid);
      return report(`Validate Change ${name}`, failed.length === 0
        ? `**${name} is valid** under \`openspec validate --strict\`.`
        : [`**${name} is not valid** under \`openspec validate --strict\`.`, "", ...failed.flatMap((item) => [`- ${item.type} ${item.id}`, ...item.issues.map((issue) => `  - ${issue.message}`)])].join("\n"));
    }
    case "showDiff": {
      const diff = await readChangeDiff(at.root, name);
      if (diff.kind !== "diff") throw new Refused(diff.message);
      return report(`Show Diff ${name}`, diff.diff.trim().length === 0
        ? "Nothing in this change differs from HEAD."
        : ["```diff", diff.diff, "```", ...(diff.truncated ? ["", `Cut at ${diff.maxBytes} bytes.`] : [])].join("\n"));
    }
    case "showTimeline": {
      const timeline = await getChangeTimeline(at.root, name, false);
      const day = (fact: { day: string | null }) => fact.day ?? "not known";
      return report(`Show Timeline ${name}`, [
        `- Proposed: ${day(timeline.dates.proposed)}`,
        `- First worked on: ${day(timeline.dates.firstWorked)}`,
        `- Last worked on: ${day(timeline.dates.lastWorked)}`,
        "",
        ...timeline.tasks.map((task) => `- [${task.done ? "x" : " "}] ${task.text}${task.done && task.date !== null ? ` (${task.date.slice(0, 10)})` : ""}`),
      ].join("\n"));
    }
    case "showAncestry": {
      const nodes = await readChangeGraph(at.root, { changes: "all" });
      const ancestors = changeAncestry(nodes, name);
      return report(`Show Ancestry ${name}`, ancestors.length === 0
        ? `${name} follows nothing. An absent relation is not a defect.`
        : ancestors.map((node) => `- ${node.id}${node.archived ? " (archived)" : ""}`).join("\n"));
    }
    case "showGraph": {
      const nodes = await readChangeGraph(at.root, { changes: "all" });
      const node = nodes.get(name);
      const lines: string[] = [];
      for (const key of CHANGE_RELATION_KEYS) {
        for (const id of named(node, key)) lines.push(`- ${name} ${key} ${id}`);
      }
      for (const other of nodes.values()) {
        for (const key of CHANGE_RELATION_KEYS) {
          if (other.id !== name && named(other, key).includes(name)) lines.push(`- ${other.id} ${key} ${name}`);
        }
      }
      return report(`Show Graph ${name}`, lines.length === 0 ? `${name} states no relation, and none names it.` : lines.join("\n"));
    }
    case "showCost": {
      const entries = await readRepositoryAuditEntries({ git: createGitWrapper({ cwd }), workspaceRoot: cwd });
      return report(`Show Cost ${name}`, renderChangeCostReport(name, buildChangeCostReport(entries, at.changeDir)));
    }
    case "explainChangeHarness": {
      const findings = findHarnessConfigLimits(await resolveHarnessConfig(at.root, name));
      return report(`Explain Change Harness ${name}`, findings.length === 0
        ? `Every ceiling configured for ${name} can act on the agent chosen for its stage.`
        : findings.map((finding) => `- **${finding.stage}** (${finding.agent}): ${finding.message}`).join("\n"));
    }
    case "recommendChangeHarness": {
      const tasks = await readTaskChecklist(at.root, name, false);
      const entries = await readRepositoryAuditEntries({ git: createGitWrapper({ cwd }), workspaceRoot: cwd });
      const recommendation = recommendTemplate({ openTaskCount: openTaskCount(tasks), history: buildChangeCostReport(entries, at.changeDir) });
      return report(`Recommend Change Harness ${name}`, [
        recommendation.needsPerson
          ? `**${name}: this needs a person, not a bigger ceiling.**`
          : `**${name}: try "${recommendation.template?.title ?? "no template"}".**`,
        "",
        ...recommendation.grounds.map((line) => `- ${line}`),
      ].join("\n"));
    }
    case "commitChange": {
      // Everything its own worktree holds, committed on its branch and
      // pushed (a-change-is-committed-where-it-is-made).
      const result = await commitChange({ repositoryRoot: cwd, changeName: name });
      const said = sayCommitChange(name, result);
      if (!result.ok) throw new Refused(withMessageCode(said.text, said.code));
      return done(withMessageCode(said.text, said.code));
    }
    case "openWorktree": {
      if (at.root === cwd) throw new Refused(`${name} is worked in this checkout.`);
      (seams.openFolder ?? openFolderInSystem)(at.root);
      return done(`Opened ${at.root}.`);
    }
    case "addRelation":
    case "removeRelation": {
      const graph = await readChangeGraph(at.root, { changes: "all" });
      const node = graph.get(name);
      const relation = request.input?.relation;
      if (relation === undefined) {
        return {
          kind: "relations",
          keys: CHANGE_RELATION_KEYS,
          changes: [...graph.keys()].filter((id) => id !== name).sort(),
          stated: CHANGE_RELATION_KEYS.flatMap((key) => named(node, key).map((id) => ({ key, id }))),
        };
      }
      if (!(CHANGE_RELATION_KEYS as readonly string[]).includes(relation.key)) throw new Refused(`"${relation.key}" is not a relation`);
      const key = relation.key as ChangeRelationKey;
      const result = await editChangeRelation(at.root, request.action === "addRelation"
        ? { change: name, key, add: relation.id }
        : { change: name, key, remove: relation.id });
      if (!result.ok) throw new Refused(result.message);
      return done(request.action === "addRelation" ? `${name} now states ${key} ${relation.id}.` : `${name} no longer states ${key} ${relation.id}.`);
    }
    case "sendMessage": {
      const message = request.input?.message;
      if (message === undefined || message.words.trim().length === 0) throw new Refused("a message needs words");
      const live = await liveRunOf(cwd, name);
      if (live === undefined) throw new Refused(`nothing is running on ${name}, so there is nobody to say it to`);
      const result = await sayToLiveRun({ ...live, workspaceRoot: cwd, kind: message.kind, words: message.words });
      if (!result.sent) throw new Refused(result.why);
      return done(message.kind === "ask"
        ? `Asked the run on ${name}; the answer arrives when its stage ends.`
        : `The run on ${name} will read this when its next stage starts.`);
    }
    case "stopRun": {
      const stop = request.input?.stop;
      if (stop === undefined || stop.reason.trim().length === 0) throw new Refused("a stop needs a reason");
      if (stop.afterTask !== undefined && stop.afterTask.trim().length > 0 && !isTaskNumber(stop.afterTask)) throw new Refused("a task number, such as 4.6");
      const live = await liveRunOf(cwd, name);
      if (live === undefined) throw new Refused(`nothing is running on ${name}, so there is nothing to ask`);
      const afterTask = stop.afterTask?.trim();
      const result = await askLiveRunToStop({ ...live, workspaceRoot: cwd, reason: stop.reason, ...(afterTask ? { afterTask } : {}) });
      if (!result.asked) throw new Refused(result.why);
      return done(afterTask ? `${name} will stop after ${afterTask}.` : `${name} was asked to stop.`);
    }
    case "archiveChange": {
      const result = await archiveChange(name, { cwd: at.root }) as Record<string, unknown>;
      if (result.ok === false) throw new Refused(typeof result.report === "string" ? result.report : JSON.stringify(result));
      return done(`Archived ${name}${at.root === cwd ? "" : ` in ${at.root}`}.`);
    }
    case "rollbackChange": {
      const service = await seams.resolveRecoveryService(at.root);
      const result = await service.rollbackChange(name);
      if (result.conflicts.length > 0) throw new Refused(`rollback blocked by later changes: ${result.conflicts.join(", ")}`);
      return done(`Restored ${result.restored.length} file(s).`);
    }
    case "deleteChange": {
      await deleteChange(at.root, name, "active");
      return done(`Deleted ${name}${at.root === cwd ? "" : ` in ${at.root}`}.`);
    }
    default:
      throw new Refused(`${request.action} is done in the page`);
  }
}

/** POST /api/change-action - one of a change's actions, where the change is
 * worked. */
export async function handleChangeActionRequest(req: IncomingMessage, res: ServerResponse, policy: RestRequestPolicy, seams: ChangeActionSeams): Promise<void> {
  let parsed: unknown;
  try {
    parsed = await readJsonBody(req, policy.maxPayloadBytes);
  } catch (error) {
    sendBodyError(res, error);
    return;
  }
  if (!isChangeActionRequest(parsed)) {
    sendJson(res, 400, { error: "body must contain a non-empty cwd, a change name and one of the change's actions" });
    return;
  }
  if (!authorizeCwd(res, policy, parsed.cwd)) return;
  if (PAGE_CHANGE_ACTIONS.has(parsed.action)) {
    sendJson(res, 400, { error: `${parsed.action} is done in the page, not by the server` });
    return;
  }
  try {
    const at = await (seams.root ?? changeActionRoot)(parsed.cwd, parsed.changeName);
    if (changeAction(parsed.action)?.writes === true && at.refusal !== undefined) {
      sendJson(res, 409, { error: at.refusal });
      return;
    }
    sendJson(res, 200, await perform(parsed, at, seams));
  } catch (error) {
    sendJson(res, error instanceof Refused ? 409 : 500, { error: error instanceof Error ? error.message : String(error) });
  }
}
