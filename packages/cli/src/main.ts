// Argv parsing, output formatting, and the 0/1/2 exit-code contract (see
// docs/adr/0007-ci-cli-third-delivery-target.md decision #3). Kept
// separate from cli.ts so it can be unit-tested without spawning a real
// process — cli.ts is just this function wired to process.argv/exit.

import { runValidateAll, type ValidateAllResult } from "./openspec-validate.js";

const USAGE = `openspec-ui-cli — non-interactive OpenSpec change validation for CI merge gates.

Usage:
  openspec-ui-cli validate [--cwd <path>] [--format json|text]

Options:
  --cwd <path>        Repository root containing openspec/changes/ (default: current directory)
  --format json|text  Output format (default: json)
  --help, -h          Show this help and exit

Exit codes:
  0  every active change passed strict validation
  1  at least one active change failed strict validation
  2  the CLI itself could not complete the check (bad arguments, the
     openspec CLI missing, a filesystem error)`;

export interface MainOptions {
  cwd?: string;
  format?: "json" | "text";
}

export interface MainDeps {
  validateAll?: (cwd: string) => Promise<ValidateAllResult>;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

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
  if (command !== "validate") {
    stderr(`openspec-ui-cli: unknown command '${command ?? ""}' (supported: validate)`);
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
