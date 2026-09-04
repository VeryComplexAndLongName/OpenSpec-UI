// Argv parsing, output formatting, and the 0/1/2 exit-code contract (see
// docs/adr/0007-ci-cli-third-delivery-target.md decision #3). Kept
// separate from cli.ts so it can be unit-tested without spawning a real
// process — cli.ts is just this function wired to process.argv/exit.

import { runValidateAll, type ValidateAllResult } from "./openspec-validate.js";
import {
  type ReleaseAssets,
  type ReleaseManifest,
  buildReleaseManifest,
  versionFingerprint,
} from "./release-manifest.js";

const USAGE = `openspec-ui-cli — non-interactive OpenSpec change validation for CI merge gates.

Usage:
  openspec-ui-cli validate [--cwd <path>] [--format json|text]
  openspec-ui-cli release-manifest [--cwd <path>] [--repository <owner/name>]
                                   [--ref <ref>] [--commit <sha>]
                                   [--releases <file>] [--fingerprint]
                                   [--from <file>]

Options:
  --cwd <path>        Repository root (default: current directory)
  --format json|text  Output format for the validate command (default: json)
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
  0  every active change passed strict validation / the manifest was built
  1  at least one active change failed strict validation
  2  the CLI itself could not complete the check (bad arguments, the
     openspec CLI missing, a filesystem error, an unreadable package.json)`;

export interface MainOptions {
  cwd?: string;
  format?: "json" | "text";
  repository?: string;
  ref?: string;
  commit?: string;
  releases?: string;
  from?: string;
  fingerprint?: boolean;
}

export interface MainDeps {
  validateAll?: (cwd: string) => Promise<ValidateAllResult>;
  buildManifest?: typeof buildReleaseManifest;
  readReleasesFile?: (filePath: string) => Promise<string>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
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
      arg === "--from"
    ) {
      const value = argv[i + 1];
      if (!value) return { command: undefined, options, error: `${arg} requires a value` };
      const key = arg.slice(2) as "repository" | "ref" | "commit" | "releases" | "from";
      options[key] = value;
      i += 1;
    } else if (arg === "--fingerprint") {
      options.fingerprint = true;
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

  return { command: positional[0], options };
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
  if (command === "release-manifest") {
    return await runReleaseManifest(options, { ...deps, stdout, stderr });
  }

  if (command !== "validate") {
    stderr(`openspec-ui-cli: unknown command '${command ?? ""}' (supported: validate, release-manifest)`);
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
