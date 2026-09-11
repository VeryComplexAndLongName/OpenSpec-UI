// Argv parsing, output formatting, and the 0/1/2 exit-code contract (see
// docs/adr/0007-ci-cli-third-delivery-target.md decision #3, extended by
// docs/adr/0020-cli-runs-a-change.md decision 7). Kept separate from
// cli.ts so it can be unit-tested without spawning a real process —
// cli.ts is just this function wired to process.argv/exit.

import { readChangeGraph } from "@openspec-ui/core";
import { renderChangeAncestry, renderChangeTree } from "./change-graph-render.js";
import { checkChange } from "./check-change.js";
import { leaseCommand } from "./lease-command.js";
import { runChange, type CheckpointPrompt } from "./run-change.js";
import { readyCommand } from "./ready-command.js";
import { worktreeCommand } from "./worktree-command.js";
import { runValidateAll, type ValidateAllResult } from "./openspec-validate.js";
import {
  type ReleaseAssets,
  type ReleaseManifest,
  buildReleaseManifest,
  versionFingerprint,
} from "./release-manifest.js";

const USAGE = `openspec-ui-cli — OpenSpec changes from a terminal: validate them, run them, check them.

Usage:
  openspec-ui-cli validate [--cwd <path>] [--format json|text]
  openspec-ui-cli run <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli check <change> [--cwd <path>] [--format text|json]
  openspec-ui-cli ready [--cwd <path>] [--base <ref>] [--format text|json]
  openspec-ui-cli lease [--cwd <path>] [--format text|json]
  openspec-ui-cli lease release [--cwd <path>] [--format text|json]
  openspec-ui-cli worktree add <change> [--cwd <path>] [--path <dir>]
                                        [--base <ref>]
  openspec-ui-cli worktree list [--cwd <path>] [--format text|json]
  openspec-ui-cli worktree remove <change> [--cwd <path>]
  openspec-ui-cli change-graph [--cwd <path>] [--change <id>] [--all]
  openspec-ui-cli release-manifest [--cwd <path>] [--repository <owner/name>]
                                   [--ref <ref>] [--commit <sha>]
                                   [--releases <file>] [--fingerprint]
                                   [--from <file>]

Options:
  --cwd <path>        Repository root (default: current directory)
  --format json|text  Output format. Default json for validate, whose
                      output is one document made at the end; default
                      text for run and check, which are watched. For
                      run, json is one event per line, as it happens.
  --path <dir>        Where a working directory goes (default: a sibling
                      of the repository, <repo>.worktrees/<change>)
  --base <ref>        The ref a working directory is cut from
                      (default: main)
  --change <id>       Print one change's ancestry instead of the whole
                      graph: what it follows, and what those follow
  --all               Include changes that state no relation
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
     (bad arguments, the openspec CLI missing, a filesystem error, an
     unreadable package.json, a change whose configuration this terminal
     cannot honour, another host holding the workspace)

'lease' exits 0 whether or not the workspace is held: it answered the
question either way. 'lease release' exits 0 when it cleared a lease and
1 when it refused. It clears one only where the holder can be shown to be
gone — its heartbeat is already stale, or it is on this machine and its
process is not running. A live holder is refused: taking its lease would
let a second mutating run start against files it still has open, which is
what the lease exists to prevent.

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
}

export interface MainDeps {
  validateAll?: (cwd: string) => Promise<ValidateAllResult>;
  buildManifest?: typeof buildReleaseManifest;
  readReleasesFile?: (filePath: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  /** `run` and `check`, injected so a unit test never spawns an agent or
   * runs `npm` — the same seam `validateAll` already is. */
  runChange?: typeof runChange;
  worktreeCommand?: typeof worktreeCommand;
  readyCommand?: typeof readyCommand;
  checkChange?: typeof checkChange;
  leaseCommand?: typeof leaseCommand;
  /** How a checkpoint is put to a person, and how their answer comes
   * back. Absent `ask` means nobody is there, which is what makes a
   * change configured to pause refuse to start rather than hang.
   * Production derives it from whether standard input is a TTY. */
  checkpoint?: CheckpointPrompt;
  /** Writes without adding a newline — `run`'s text output joins the
   * slices of a streamed reply, so it cannot go through a line-oriented
   * writer. Defaults to `process.stdout.write`. */
  writeOut?: (text: string) => void;
}

/** The repository the manifest describes. A default rather than a
 * required flag so a local run needs no arguments, and overridable so a
 * fork publishes its own links rather than this repository's. */
const DEFAULT_REPOSITORY = "VeryComplexAndLongName/OpenSpec-UI";

function parseArgs(argv: string[]): { command: string | undefined; options: MainOptions; error?: string } {
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
      arg === "--change"
    ) {
      const value = argv[i + 1];
      if (!value) return { command: undefined, options, error: `${arg} requires a value` };
      const key = arg.slice(2) as "repository" | "ref" | "commit" | "releases" | "from" | "path" | "base" | "change";
      options[key] = value;
      i += 1;
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

  if (positional[1] !== undefined) options.changeName = positional[1];
  if (positional[2] !== undefined) options.worktreeChange = positional[2];
  return { command: positional[0], options };
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
    return `${status}  ${r.id}${detail}`;
  });
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

  const { command, options, error } = parseArgs(argv);
  if (error) {
    stderr(`openspec-ui-cli: ${error}`);
    stderr(USAGE);
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

  if (command === "worktree") {
    const action = options.changeName;
    if (action !== "add" && action !== "list" && action !== "remove") {
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
      stderr(`openspec-ui-cli: ${command} requires a change name`);
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

  if (command === "release-manifest") {
    return await runReleaseManifest(options, { ...deps, stdout, stderr });
  }

  if (command !== "validate") {
    stderr(
      `openspec-ui-cli: unknown command '${command ?? ""}'`
      + " (supported: validate, run, check, ready, lease, worktree, release-manifest, change-graph)",
    );
    stderr(USAGE);
    return 2;
  }

  const cwd = options.cwd ?? process.cwd();
  const format = options.format ?? "json";

  let result: ValidateAllResult;
  try {
    result = await validateAll(cwd);
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
