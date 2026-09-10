// The one rule for what a change may be called.
//
// Its own leaf module with zero Node imports, so every caller can reach
// it: `workbench.ts` and `harness-config.ts` build paths from a change
// name and read `node:fs`, while `scheduled-runs.ts` is pure and ends up
// in the browser bundle. A second copy of the pattern in the pure half
// would be a second rule to keep true, and the whole point of this
// module is that there is one.
//
// A change name reaches this process from a REST body and from a webview
// message, and is then joined into a path. `../../..` is a change name
// only if nothing checks, which is why the check lives beside the rule
// rather than in each host. See a-name-is-checked-before-it-is-used.

/** Lowercase letters and digits to begin with, then any of those plus
 * `.`, `_` and `-`. Closed on purpose: it cannot contain a path
 * separator, cannot be `.` or `..`, and cannot begin with a character
 * that makes it something other than a directory name. */
export const CHANGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

/** Thrown rather than a bare `Error` so a host can answer with the
 * status a refused name deserves — 400, not 500: the request was
 * understood and is being refused, and nothing went wrong here. */
export class InvalidChangeNameError extends Error {
  constructor(public readonly changeName: string) {
    super(
      `Invalid OpenSpec change name: ${changeName} — a change name must start with a lowercase letter or digit ` +
        `and may then contain only lowercase letters, digits, ".", "_" and "-"`,
    );
    this.name = "InvalidChangeNameError";
  }
}

export function isValidChangeName(changeName: unknown): changeName is string {
  return typeof changeName === "string"
    && CHANGE_NAME_PATTERN.test(changeName)
    && changeName !== "."
    && changeName !== "..";
}

/** Refuses a name before it can become a path. */
export function assertValidChangeName(changeName: string): void {
  if (!isValidChangeName(changeName)) throw new InvalidChangeNameError(changeName);
}
