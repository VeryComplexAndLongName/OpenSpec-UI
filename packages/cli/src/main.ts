// Argv parsing, output formatting, and the 0/1/2 exit-code contract (see
// docs/adr/0007-ci-cli-third-delivery-target.md decision #3, extended by
// docs/adr/0020-cli-runs-a-change.md decision 7). Kept separate from
// cli.ts so it can be unit-tested without spawning a real process —
// cli.ts is just this function wired to process.argv/exit.

import { personOfThisMachine, readChangeGraph, type HistoryRequest } from "@openspec-ui/core";

/** The handle this machine's key is filed under, where it is. */
async function handleOfThisMachine(workspaceRoot: string): Promise<string | undefined> {
  return (await personOfThisMachine(workspaceRoot))?.handle;
}
import { renderChangeAncestry, renderChangeTree } from "./change-graph-render.js";
import { checkChange } from "./check-change.js";
import { leaseCommand } from "./lease-command.js";
import { runChange, type CheckpointPrompt } from "./run-change.js";
import { updatePlan } from "./update-plan.js";
import { adviseCommand } from "./advise-command.js";
import { doctorCommand } from "./doctor-command.js";
import { enrolCommand } from "./enrol-command.js";
import { joinCommand, peopleCommand } from "./team-command.js";
import { historyCommand, isSendBackStage, parseReopen, recordCommand } from "./history-command.js";
import { stagesCommand } from "./stages-command.js";
import { readyCommand } from "./ready-command.js";
import { statusCommand } from "./status-command.js";
import { claimCommand, presentCommand, rootOf, untilInterrupted } from "./coordination-commands.js";
import { stopCommand } from "./stop-command.js";
import { taskCommand } from "./task-command.js";
import { answerCommand } from "./answer-command.js";
import { publicNameOf, routeSubcommand, subcommandNames } from "./subcommands.js";
import { worktreeCommand } from "./worktree-command.js";
import { runValidateAll, type ValidateAllResult } from "./openspec-validate.js";
import {
  type ReleaseAssets,
  type ReleaseManifest,
  buildReleaseManifest,
  versionFingerprint,
} from "./release-manifest.js";

const USAGE = `openspec-ui-cli — OpenSpec changes from a terminal: validate them, run them, check them.

Every subcommand is a verb and a noun (ADR 0045).

Usage:
  openspec-ui-cli validate changes [--cwd <path>] [--format json|text]
  openspec-ui-cli run change <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli update plan <change> [--note <text>] [--agent <id>] [--cwd <path>]
                              [--format text|json]
  openspec-ui-cli run checks <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli show readiness [--cwd <path>] [--base <ref>] [--format text|json]
  openspec-ui-cli diagnose workspace [--cwd <path>] [--change <id>] [--format text|json]
  openspec-ui-cli show advice [--cwd <path>] [--base <ref>] [--format text|json]
  openspec-ui-cli show lease [--cwd <path>] [--format text|json]
  openspec-ui-cli remove lease [--cwd <path>] [--format text|json]
  openspec-ui-cli show status [--cwd <path>] [--format text|json]
  openspec-ui-cli set presence [--change <id>] [--activity <text>] [--cwd <path>]
  openspec-ui-cli set lock <resource> [--wait <seconds>] [--cwd <path>]
  openspec-ui-cli stop run <instanceId> --reason <text> [--after <task>] [--cwd <path>]
                           [--format text|json]
  openspec-ui-cli confirm key [<keyId>] [--label <text>] [--cwd <path>]
                              [--format text|json]
  openspec-ui-cli join team --handle <handle> --name <text> [--email <address>]
                            [--cwd <path>] [--format text|json]
  openspec-ui-cli show people [--cwd <path>] [--format text|json]
  openspec-ui-cli show history <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli show stages [<change>] [--cwd <path>] [--format text|json]
  openspec-ui-cli set owner <change> [--to <handle>] [--agent <id>] [--cwd <path>]
  openspec-ui-cli set implementer <change> [--to <handle> | --none] [--agent <id>]
                                  [--cwd <path>]
  openspec-ui-cli reopen change <change> --stage <stage> --reason <text>
                                [--reopen <task>:<why>]... [--agent <id>]
                                [--cwd <path>]
  openspec-ui-cli complete task <change> <number> [--note <text>] [--cwd <path>]
                                [--format text|json]
  openspec-ui-cli reopen task <change> <number> [--note <text>] [--cwd <path>]
                              [--format text|json]
  openspec-ui-cli commit tasks <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli show questions <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli answer question <change> <Q-id> "<answer>" [--cwd <path>]
                                  [--format text|json]
  openspec-ui-cli create worktree <change> [--cwd <path>] [--path <dir>]
                                  [--base <ref>]
  openspec-ui-cli show worktrees [--cwd <path>] [--format text|json]
  openspec-ui-cli move worktree <change> [--cwd <path>]
  openspec-ui-cli delete worktree <change> [--cwd <path>]
  openspec-ui-cli show graph [--cwd <path>] [--change <id>] [--all]
  openspec-ui-cli write manifest [--cwd <path>] [--repository <owner/name>]
                                 [--ref <ref>] [--commit <sha>]
                                 [--releases <file>] [--fingerprint]
                                 [--from <file>]

A subcommand by its former name (validate, run, doctor, answer, ...) is
refused with OSW-CLI-001, naming the pair that replaced it.

Options:
  --cwd <path>        Repository root (default: current directory)
  --format json|text  Output format. Default json for 'validate changes',
                      whose output is one document made at the end;
                      default text for 'run change' and 'run checks',
                      which are watched. For 'run change', json is one
                      event per line, as it happens.
  --path <dir>        Where a working directory goes (default: under one
                      root, <root>/<repo>/<change>; the root comes from
                      OPENSPEC_UI_WORKTREE_ROOT, then ~/.openspec-ui/
                      settings.json, then <repo's parent>/.worktrees)
  --base <ref>        The ref a working directory is cut from
                      (default: main)
  --change <id>       Print one change's ancestry instead of the whole
                      graph: what it follows, and what those follow
  --all               Include changes that state no relation
  --label <text>      The name an enrolled key's person is known by
                      (default: the run's git author)
  --handle <handle>   The name 'join team' files a person under:
                      lower-case letters, digits and single hyphens
  --name <text>       A person's name as the team reads it
  --email <address>   A git e-mail address of the person's; optional
  --to <handle>       Who 'set owner' or 'set implementer' names
                      (default: you, as this machine's key says)
  --none              'set implementer': leave the change with nobody on it
  --stage <stage>     Where 'reopen change' returns a change: proposed,
                      planned, in-progress or in-review
  --reopen <task>:<why>  An item 'reopen change' reopens, and why; repeatable
  --agent <id>        The agent acting for you. Without it, the
                      environment says (OPENSPEC_UI_AGENT, AI_AGENT). For
                      'update plan', the agent that runs it; without it,
                      the change's review agent
  --reason <text>     Why a run is asked to stop; the run records it
  --note <text>       What 'complete task' or 'reopen task' writes under
                      the task; required to close a Human-only or
                      delegated task. For 'update plan', the operator's
                      notes the update answers
  --after <task>      Let the run finish this task first, as tasks.md numbers
                      it (for example 4.6), then stop where the work is sound
  --repository        owner/name for the manifest's links
                      (default: VeryComplexAndLongName/OpenSpec-UI)
  --ref <ref>         Ref the manifest's links point at (default: main)
  --commit <sha>      Commit the manifest records as its source
  --releases <file>   JSON file of releases to attach; see the
                      ReleaseAssets type in release-manifest.ts
  --fingerprint       Print only the id@version set, for deciding whether
                      a publish is needed at all
  --from <file>       Read an already-published manifest instead of
                      building one, so its fingerprint can be compared
                      with a freshly built one by the same code

Exit codes:
  0  every active change passed strict validation / the chain completed /
     every declared check passed / the manifest was built
  1  the change did not pass or did not complete — a change failed strict
     validation, a stage failed, a declared check failed, or a run was
     cancelled
  2  the CLI itself could not complete the check, or declined to start
     (bad arguments, a former subcommand's name, the openspec CLI missing,
     a filesystem error, an unreadable package.json, a change whose
     configuration this terminal cannot honour, another host holding the
     workspace)

'show lease' exits 0 whether or not the workspace is held: it answered
the question either way. 'remove lease' exits 0 when it cleared a lease
and 1 when it refused. It clears one only where the holder can be shown to
be gone — its heartbeat is already stale, or it is on this machine and its
process is not running. A live holder is refused: taking its lease would
let a second mutating run start against files it still has open, which is
what the lease exists to prevent.

'show advice' prints what the readiness report suggests — which changes
can be started alongside each other, which is ready with nowhere to run —
each with the fact it came from and the commands that act on it. It exits
0 whether or not there is anything to suggest, and creates nothing: the
commands are printed, not run. A workspace that set hints.enabled to false
computes none.

'show status' prints what every run of this repository last said it was
doing, and how long ago it said it — never whether a run is stuck or
healthy, which is a person's judgement a silent agent and a hung one look
identical to. It exits 0 whether or not anything is running. Each run
says whose it is only as far as its signature shows: signed by an enrolled
person, not verified, or a signature that does not check out.

'complete task', 'reopen task' and 'commit tasks' do what a Pipeline card
does for a change in the worktree made for it, and only there: the first
two tick or untick one task in that worktree's tasks.md, with the note
written under it; 'commit tasks' commits that tasks.md alone and pushes
the worktree's branch. Each exits 1 when it is refused, saying why: no
worktree of the change's own, a run working in it, or a Human-only or
delegated task closed without a note.

'stop run' asks a live run to stop where its work is sound, through a
request signed with this machine's key. The run reads it at its next
renewal and acts on it only if the request is verified and fresh. It
prints the request's message id, and exits 1 when no live run reports
itself under that instance id.

'set presence' reports this agent into the status directory beside the
repository and keeps the record alive until it is interrupted, so other
agents on this machine - and the Pipeline - can see that somebody is
working here and on what. It is not a run: no run id, nothing in the
audit.

'set lock <resource>' holds something this machine has one of - the
browser capture suite, a port, the editor under test - and releases it
when it ends. Where somebody already holds it, it says who and waits,
saying so while it waits, and exits 1 rather than proceeding when the wait
runs out. Advisory: an agent that never asks holds nothing back.

'confirm key' lists the keys that sign a live run's record and are not
enrolled, with where the run is, its machine and git author. 'confirm key
<keyId>' says a listed run was yours: its key is enrolled, and its runs
read as signed by you. It exits 1 when the confirmation is refused.

'join team' writes openspec/people/<handle>.json with this machine's
public key, or adds the key to the file the person already has. Nothing is
committed: joining the team is the pull request that carries the file
(ADR 0037). It exits 1 when the key is already somebody else's or the
handle is not one. 'show people' lists the people of the repository and
what is wrong with their files; it exits 1 when anything is.

'show history <change>' prints who holds a change and every event of its
history, with any that break a rule. 'set owner', 'set implementer' and
'reopen change' record an event, signed with this machine's key: only the
Owner hands the ownership on, the Owner sets the Implementer, the
Implementer may hand the work back with --none, and the Owner or the
Implementer sends a change back, reopening the items it names in tasks.md
with the reason under each. Nothing is committed. They exit 1 when the
rules refuse the event.

'show stages' prints where each active change is - Proposed, Planned, In
progress, In review, Landed or Archived - with its Owner and Implementer
and how long it has been there. 'show stages <change>' prints every stay
in every stage, with the fact that began it, and the time in each stage
over all its visits. A stage is derived from dated facts: commits, closed
task lines, runs, the pull request's times, commits on the change's
branch, and the change's history, whose send-backs move it back.

'diagnose workspace' exits 0 when nothing it found would stop a run, 1
when something would, and 2 when it could not look. A workspace held by a
live run is reported and exits 0: being busy is not being broken.
'--change <id>' adds the preflight's own answer for that change, from the
same resolution a run would use.

A run does only what the change's own harness configuration already
permits. There is no flag that starts a chain for a change configured to
run one stage at a time, and none that answers a confirmation the change
asked for — see docs/adr/0020-cli-runs-a-change.md.`;

export interface MainOptions {
  cwd?: string;
  format?: "json" | "text";
  repository?: string;
  ref?: string;
  commit?: string;
  releases?: string;
  from?: string;
  fingerprint?: boolean;
  change?: string;
  all?: boolean;
  /** The change `run`/`check` was given, as a second positional rather
   * than a flag — it is the subject of the command, not an option on it.
   * Distinct from `--change`, which selects a subtree of `change-graph`'s
   * output. */
  changeName?: string;
  /** `worktree`'s own subject: `worktree add <change>` puts the action
   * in the first positional and the change in the second. */
  worktreeChange?: string;
  /** Where a working directory goes, and the ref it is cut from. */
  path?: string;
  base?: string;
  /** `enrol`'s name for the person a key is enrolled for. */
  label?: string;
  /** `join`'s person: the handle, the name and an optional address. */
  handle?: string;
  name?: string;
  email?: string;
  /** A change's history: who is named, where it is sent back to, what is
   * reopened, and which agent acts. */
  to?: string;
  none?: boolean;
  stage?: string;
  reopen?: string[];
  agent?: string;
  /** `stop`'s reason for asking a run to stop. */
  reason?: string;
  /** The task a stop should let the run finish first. */
  after?: string;
  /** What `present` says this agent is doing, and how long `claim` waits
   * for a resource somebody else holds, in seconds
   * (an-agent-says-where-it-is-working). */
  activity?: string;
  wait?: string;
  /** `task done|reopen`'s third positional, the task's number, and the note
   * written under it (a-card-works-its-own-tasks). */
  taskNumber?: string;
  note?: string;
}

export interface MainDeps {
  validateAll?: (cwd: string, options?: { change?: string; archivedSince?: string }) => Promise<ValidateAllResult>;
  buildManifest?: typeof buildReleaseManifest;
  readReleasesFile?: (filePath: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  /** `run` and `check`, injected so a unit test never spawns an agent or
   * runs `npm` — the same seam `validateAll` already is. */
  runChange?: typeof runChange;
  updatePlan?: typeof updatePlan;
  worktreeCommand?: typeof worktreeCommand;
  readyCommand?: typeof readyCommand;
  doctorCommand?: typeof doctorCommand;
  adviseCommand?: typeof adviseCommand;
  checkChange?: typeof checkChange;
  leaseCommand?: typeof leaseCommand;
  statusCommand?: typeof statusCommand;
  stopCommand?: typeof stopCommand;
  taskCommand?: typeof taskCommand;
  answerCommand?: typeof answerCommand;
  enrolCommand?: typeof enrolCommand;
  joinCommand?: typeof joinCommand;
  peopleCommand?: typeof peopleCommand;
  historyCommand?: typeof historyCommand;
  stagesCommand?: typeof stagesCommand;
  recordCommand?: typeof recordCommand;
  /** How a checkpoint is put to a person, and how their answer comes
   * back. Absent `ask` means nobody is there, which is what makes a
   * change configured to pause refuse to start rather than hang.
   * Production derives it from whether standard input is a TTY. */
  checkpoint?: CheckpointPrompt;
  presentCommand?: typeof presentCommand;
  claimCommand?: typeof claimCommand;
  /** Resolves when a command that holds something should let go. In
   * production a signal; in a test, the test's own promise
   * (an-agent-says-where-it-is-working). */
  untilStopped?: () => Promise<void>;
  /** Writes without adding a newline — `run`'s text output joins the
   * slices of a streamed reply, so it cannot go through a line-oriented
   * writer. Defaults to `process.stdout.write`. */
  writeOut?: (text: string) => void;
}

/** The repository the manifest describes. A default rather than a
 * required flag so a local run needs no arguments, and overridable so a
 * fork publishes its own links rather than this repository's. */
const DEFAULT_REPOSITORY = "VeryComplexAndLongName/OpenSpec-UI";

function parseArgs(argv: string[]): {
  command: string | undefined;
  options: MainOptions;
  error?: string;
  renamed?: { former: string; replacement: string };
} {
  const options: MainOptions = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--cwd") {
      const value = argv[i + 1];
      if (!value) return { command: undefined, options, error: "--cwd requires a value" };
      options.cwd = value;
      i += 1;
    } else if (
      arg === "--repository" ||
      arg === "--ref" ||
      arg === "--commit" ||
      arg === "--releases" ||
      arg === "--from" ||
      arg === "--path" ||
      arg === "--base" ||
      arg === "--change" ||
      arg === "--label" ||
      arg === "--reason" ||
      arg === "--after" ||
      arg === "--activity" ||
      arg === "--wait" ||
      arg === "--handle" ||
      arg === "--name" ||
      arg === "--email" ||
      arg === "--to" ||
      arg === "--stage" ||
      arg === "--agent" ||
      arg === "--note"
    ) {
      const value = argv[i + 1];
      if (!value) return { command: undefined, options, error: `${arg} requires a value` };
      const key = arg.slice(2) as "repository" | "ref" | "commit" | "releases" | "from" | "path" | "base" | "change" | "label" | "reason" | "after" | "activity" | "wait" | "handle" | "name" | "email" | "to" | "stage" | "agent" | "note";
      options[key] = value;
      i += 1;
    } else if (arg === "--reopen") {
      const value = argv[i + 1];
      if (!value) return { command: undefined, options, error: "--reopen requires a value" };
      options.reopen = [...(options.reopen ?? []), value];
      i += 1;
    } else if (arg === "--none") {
      options.none = true;
    } else if (arg === "--fingerprint") {
      options.fingerprint = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg === "--format") {
      const value = argv[i + 1];
      if (value !== "json" && value !== "text") {
        return { command: undefined, options, error: "--format must be 'json' or 'text'" };
      }
      options.format = value;
      i += 1;
    } else {
      positional.push(arg as string);
    }
  }

  // A verb and a noun name the handler; a former subcommand is refused,
  // naming its replacement (ADR 0045).
  const routed = routeSubcommand(positional);
  if (routed.kind === "renamed") {
    return { command: undefined, options, renamed: { former: routed.former, replacement: routed.replacement } };
  }
  const handler = routed.kind === "handler" ? routed.positionals : [positional.slice(0, 2).join(" ")];
  if (handler[1] !== undefined) options.changeName = handler[1];
  if (handler[2] !== undefined) options.worktreeChange = handler[2];
  if (handler[3] !== undefined) options.taskNumber = handler[3];
  return { command: routed.kind === "handler" ? handler[0] : positional.length > 0 ? handler[0] : undefined, options };
}

/** Whether a confirmation can actually be put to somebody, and how.
 *
 * An absent `ask` is not "assume yes" — it is what makes a change
 * configured to pause between stages refuse to start at all (ADR 0020
 * decision 4). A process whose input is not a terminal has nobody to ask,
 * and there is deliberately no flag that answers on their behalf. */
function defaultCheckpointPrompt(): CheckpointPrompt {
  if (!process.stdin.isTTY) return {};
  return {
    ask: (question: string) =>
      new Promise<boolean>((resolve) => {
        process.stdout.write(`${question} [y/N] `);
        const onData = (data: Buffer): void => {
          process.stdin.off("data", onData);
          process.stdin.pause();
          const answer = data.toString("utf8").trim().toLowerCase();
          resolve(answer === "y" || answer === "yes");
        };
        process.stdin.resume();
        process.stdin.on("data", onData);
      }),
  };
}

function formatText(result: ValidateAllResult): string {
  const lines = result.results.map((r) => {
    const status = r.valid ? "OK" : "FAIL";
    const detail = r.error ? ` — ${r.error}` : r.totalItems > 0 ? ` (${r.failedItems}/${r.totalItems} failed)` : "";
    const owed = [
      ...(r.openItems ?? []).map((item) => `    still open: ${item}`),
      ...(r.unrecordedItems ?? []).map((item) => `    closed with nothing written under it: ${item}`),
    ];
    return [`${status}  ${r.id}${detail}`, ...owed].join(String.fromCharCode(10));
  });
  for (const archived of result.archived ?? []) {
    lines.push(`FAIL  archived ${archived.archiveName}`);
    for (const item of archived.openItems ?? []) lines.push(`    still open: ${item}`);
    for (const item of archived.unrecordedItems ?? []) lines.push(`    closed with nothing written under it: ${item}`);
  }
  if (result.archiveCheckFailed !== undefined) {
    lines.push(`FAIL  could not compare the archive with the base: ${result.archiveCheckFailed}`);
  }
  for (const problem of result.peopleProblems ?? []) {
    lines.push(`FAIL  ${problem.file}: ${problem.problem}`);
  }
  for (const problem of result.historyProblems ?? []) {
    lines.push(`FAIL  ${problem.file}: ${problem.problem}`);
  }
  lines.push(result.ok ? "\nAll changes valid." : "\nOne or more changes failed validation.");
  return lines.join("\n");
}

/** Returns the process exit code (0/1/2) — see design.md for the contract. */
export async function runMain(argv: string[], deps: MainDeps = {}): Promise<number> {
  const validateAll = deps.validateAll ?? runValidateAll;
  const stdout = deps.stdout ?? console.log;
  const stderr = deps.stderr ?? console.error;

  if (argv.includes("--help") || argv.includes("-h")) {
    stdout(USAGE);
    return 0;
  }

  const { command, options, error, renamed } = parseArgs(argv);
  if (error) {
    stderr(`openspec-ui-cli: ${error}`);
    stderr(USAGE);
    return 2;
  }
  if (renamed) {
    stderr(`error OSW-CLI-001: '${renamed.former}' was renamed: use 'openspec-ui-cli ${renamed.replacement}' (ADR 0045)`);
    return 2;
  }
  if (command === "change-graph") {
    const cwd = options.cwd ?? process.cwd();
    const nodes = await readChangeGraph(cwd);
    stdout(options.change ? renderChangeAncestry(nodes, options.change) : renderChangeTree(nodes, { all: options.all }));
    return 0;
  }

  if (command === "ready") {
    return await (deps.readyCommand ?? readyCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        ...(options.base !== undefined ? { base: options.base } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "doctor") {
    return await (deps.doctorCommand ?? doctorCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        ...(options.change !== undefined ? { changeName: options.change } : {}),
        // The same fact `run` refuses on, read once here rather than
        // twice and possibly differently.
        canAnswerCheckpoints: (deps.checkpoint ?? {}).ask !== undefined,
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "advise") {
    return await (deps.adviseCommand ?? adviseCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        ...(options.base !== undefined ? { base: options.base } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "lease") {
    return await (deps.leaseCommand ?? leaseCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        // `lease release` puts the action where `run <change>` puts its
        // subject, so it arrives as the same positional.
        ...(options.changeName !== undefined ? { action: options.changeName } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  // Two agents on one machine see each other, and hold what there is one
   // of (an-agent-says-where-it-is-working).
  if (command === "present") {
    return await (deps.presentCommand ?? presentCommand)(
      {
        workspaceRoot: rootOf(options.cwd),
        ...(options.changeName !== undefined ? { changeName: options.changeName } : {}),
        ...(options.activity !== undefined ? { activity: options.activity } : {}),
      },
      { stdout, stderr, untilStopped: deps.untilStopped ?? untilInterrupted() },
    );
  }

  if (command === "claim") {
    const resource = options.changeName;
    if (!resource) {
      stderr("openspec-ui-cli: set lock requires a resource name");
      stderr(USAGE);
      return 2;
    }
    const waitSeconds = options.wait === undefined ? undefined : Number.parseInt(options.wait, 10);
    if (waitSeconds !== undefined && !Number.isFinite(waitSeconds)) {
      stderr("openspec-ui-cli: --wait takes a number of seconds");
      return 2;
    }
    return await (deps.claimCommand ?? claimCommand)(
      {
        workspaceRoot: rootOf(options.cwd),
        resource,
        ...(waitSeconds !== undefined ? { waitSeconds } : {}),
      },
      { stdout, stderr, untilStopped: deps.untilStopped ?? untilInterrupted() },
    );
  }

  if (command === "stop") {
    return await (deps.stopCommand ?? stopCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        // The run to ask arrives where `run <change>` puts its subject.
        instanceId: options.changeName,
        reason: options.reason,
        // The task the run may finish before it stops
        // (a-run-is-told-where-to-stop).
        ...(options.after !== undefined ? { afterTask: options.after } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "status") {
    return await (deps.statusCommand ?? statusCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "enrol") {
    return await (deps.enrolCommand ?? enrolCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        // The key comes where `run <change>` puts its subject.
        ...(options.changeName !== undefined ? { keyId: options.changeName } : {}),
        ...(options.label !== undefined ? { label: options.label } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "join") {
    if (options.handle === undefined || options.name === undefined) {
      stderr("openspec-ui-cli: join team requires --handle and --name");
      stderr(USAGE);
      return 2;
    }
    return await (deps.joinCommand ?? joinCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        handle: options.handle,
        name: options.name,
        ...(options.email !== undefined ? { email: options.email } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "people") {
    return await (deps.peopleCommand ?? peopleCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "stages") {
    return await (deps.stagesCommand ?? stagesCommand)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        ...(options.changeName !== undefined ? { changeName: options.changeName } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "history" || command === "owner" || command === "implementer" || command === "send-back") {
    const changeName = options.changeName;
    if (!changeName) {
      stderr(`openspec-ui-cli: ${publicNameOf(command)} requires a change name`);
      stderr(USAGE);
      return 2;
    }
    const workspaceRoot = options.cwd ?? process.cwd();
    const format = options.format === "json" ? "json" : "text";
    if (command === "history") {
      return await (deps.historyCommand ?? historyCommand)({ workspaceRoot, changeName, format }, { stdout, stderr });
    }
    const actor = options.agent !== undefined ? { kind: "agent" as const, agent: options.agent } : undefined;
    let request: HistoryRequest;
    if (command === "send-back") {
      if (!isSendBackStage(options.stage) || options.reason === undefined) {
        stderr("openspec-ui-cli: reopen change requires --stage proposed|planned|in-progress|in-review and --reason <text>");
        return 2;
      }
      const reopened = parseReopen(options.reopen ?? []);
      if (typeof reopened === "string") {
        stderr(`openspec-ui-cli: ${reopened}`);
        return 2;
      }
      request = { type: "sent-back", toStage: options.stage, reason: options.reason, reopened };
    } else {
      // Nobody named means the person this machine's key belongs to.
      const to = options.to ?? (command === "implementer" && options.none === true ? null : await handleOfThisMachine(workspaceRoot));
      if (to === undefined) {
        stderr("openspec-ui-cli: this machine's key is in nobody's file in openspec/people: join the team first, or name someone with --to");
        return 1;
      }
      request = command === "owner" ? { type: "owner-set", to: to as string } : { type: "implementer-set", to };
    }
    return await (deps.recordCommand ?? recordCommand)(
      { workspaceRoot, changeName, request, ...(actor !== undefined ? { actor } : {}), format },
      { stdout, stderr },
    );
  }

  // `answer <change> [<Q-id> <answer>]`: an agent's question, answered from a
  // terminal (the-agent-asks-the-operator, ADR 0042).
  if (command === "answer") {
    return await (deps.answerCommand ?? answerCommand)(
      {
        repositoryRoot: options.cwd ?? process.cwd(),
        ...(options.changeName !== undefined ? { changeName: options.changeName } : {}),
        ...(options.worktreeChange !== undefined ? { questionId: options.worktreeChange } : {}),
        ...(options.taskNumber !== undefined ? { answer: options.taskNumber } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "task") {
    // `task <action> <change> [<number>]`: the action in the first
    // positional, as `worktree` has it.
    return await (deps.taskCommand ?? taskCommand)(
      {
        repositoryRoot: options.cwd ?? process.cwd(),
        action: options.changeName,
        changeName: options.worktreeChange,
        number: options.taskNumber,
        ...(options.note !== undefined ? { note: options.note } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "worktree") {
    const action = options.changeName;
    if (action !== "add" && action !== "list" && action !== "move" && action !== "remove") {
      stderr();
      stderr(USAGE);
      return 2;
    }
    return await (deps.worktreeCommand ?? worktreeCommand)(
      {
        repositoryRoot: options.cwd ?? process.cwd(),
        action,
        ...(options.worktreeChange !== undefined ? { changeName: options.worktreeChange } : {}),
        ...(options.path !== undefined ? { path: options.path } : {}),
        ...(options.base !== undefined ? { base: options.base } : {}),
        format: options.format === "json" ? "json" : "text",
      },
      { stdout, stderr },
    );
  }

  if (command === "run" || command === "check") {
    const changeName = options.changeName;
    if (!changeName) {
      stderr(`openspec-ui-cli: ${publicNameOf(command)} requires a change name`);
      stderr(USAGE);
      return 2;
    }
    const cwd = options.cwd ?? process.cwd();
    // `run` and `check` are watched rather than collected, so their
    // default is the readable one — the opposite of `validate`, whose
    // output is a single document produced at the end.
    const format = options.format ?? "text";

    if (command === "check") {
      return await (deps.checkChange ?? checkChange)({ workspaceRoot: cwd, changeName, format }, { stdout, stderr });
    }

    const writeOut = deps.writeOut ?? ((text: string) => void process.stdout.write(text));
    return await (deps.runChange ?? runChange)(
      { workspaceRoot: cwd, changeName, format },
      { stdout: writeOut, stderr, checkpoint: deps.checkpoint ?? defaultCheckpointPrompt() },
    );
  }

  // Revises a change's plan from its last review and the note (ADR 0041).
  if (command === "update") {
    const changeName = options.changeName;
    if (!changeName) {
      stderr("openspec-ui-cli: update plan requires a change name");
      stderr(USAGE);
      return 2;
    }
    const writeOut = deps.writeOut ?? ((text: string) => void process.stdout.write(text));
    return await (deps.updatePlan ?? updatePlan)(
      {
        workspaceRoot: options.cwd ?? process.cwd(),
        changeName,
        format: options.format === "json" ? "json" : "text",
        ...(options.note !== undefined ? { note: options.note } : {}),
        ...(options.agent !== undefined ? { agent: options.agent } : {}),
      },
      { stdout: writeOut, stderr, permission: deps.checkpoint ?? defaultCheckpointPrompt() },
    );
  }

  if (command === "release-manifest") {
    return await runReleaseManifest(options, { ...deps, stdout, stderr });
  }

  if (command !== "validate") {
    stderr(
      `openspec-ui-cli: unknown command '${command ?? ""}'`
      + ` (supported: ${subcommandNames().join(", ")})`,
    );
    stderr(USAGE);
    return 2;
  }

  const cwd = options.cwd ?? process.cwd();
  const format = options.format ?? "json";

  let result: ValidateAllResult;
  try {
    // The change this pull request is for, where the caller says: the
    // open-item rule applies to it and to no other change
    // (a-change-lands-with-nothing-open).
    // `--base` is the ref the pull request merges into: every change it
    // archives is held to the same rule as the change it is for
    // (a-change-is-archived-with-nothing-open).
    result = await validateAll(cwd, {
      ...(options.change !== undefined ? { change: options.change } : {}),
      ...(options.base !== undefined ? { archivedSince: options.base } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stderr(`openspec-ui-cli: could not complete validation: ${message}`);
    return 2;
  }

  stdout(format === "text" ? formatText(result) : JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

/** Builds the manifest and prints it. Exit 2 for any failure to produce
 * a complete document: a manifest missing a product would read to the
 * site as that product having been withdrawn, so a partial result is
 * never printed. */
async function runReleaseManifest(
  options: MainOptions,
  deps: MainDeps & { stdout: (line: string) => void; stderr: (line: string) => void },
): Promise<number> {
  const build = deps.buildManifest ?? buildReleaseManifest;
  const readReleasesFile =
    deps.readReleasesFile ?? (async (filePath: string) => (await import("node:fs/promises")).readFile(filePath, "utf8"));

  let releases: ReleaseAssets[] | undefined;
  if (options.releases !== undefined) {
    try {
      const parsed: unknown = JSON.parse(await readReleasesFile(options.releases));
      if (!Array.isArray(parsed)) throw new Error("expected an array of releases");
      releases = parsed as ReleaseAssets[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.stderr(`openspec-ui-cli: could not read ${options.releases}: ${message}`);
      return 2;
    }
  }

  // `--from` reads an already-published manifest rather than building
  // one, so the publish step can compare two fingerprints with the same
  // code that produces them. Computing the old one separately in YAML
  // would be a second implementation of the same rule, free to drift.
  if (options.from !== undefined) {
    try {
      const existing: unknown = JSON.parse(await readReleasesFile(options.from));
      const parsed = existing as ReleaseManifest;
      if (!Array.isArray(parsed.products)) throw new Error("no products array");
      deps.stdout(options.fingerprint ? versionFingerprint(parsed) : JSON.stringify(parsed, null, 2));
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.stderr(`openspec-ui-cli: could not read ${options.from}: ${message}`);
      return 2;
    }
  }

  let manifest: ReleaseManifest;
  try {
    manifest = await build({
      repoRoot: options.cwd ?? process.cwd(),
      repository: options.repository ?? DEFAULT_REPOSITORY,
      ...(options.ref !== undefined ? { ref: options.ref } : {}),
      ...(options.commit !== undefined ? { commit: options.commit } : {}),
      ...(releases !== undefined ? { releases } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    deps.stderr(`openspec-ui-cli: could not build the release manifest: ${message}`);
    return 2;
  }

  deps.stdout(options.fingerprint ? versionFingerprint(manifest) : JSON.stringify(manifest, null, 2));
  return 0;
}
