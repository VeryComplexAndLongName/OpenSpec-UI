// The one way this product starts `git` through simple-git (simple-git-4).
//
// simple-git 4 removes every `GIT_`-prefixed variable, and a few others
// (`EDITOR`, `PAGER`, `SSH_ASKPASS`, ...), from the environment of the git it
// runs, so that a value nobody meant for it cannot make it run a program.
// That is right for most of them: nothing here opens an editor, a pager or a
// template. It would also take away what a person set up to reach their
// remote - the askpass helper VS Code provides, an SSH command, the switch
// that keeps git from prompting in a terminal nobody watches - and a push
// that worked would then fail to authenticate, or wait on a prompt.
//
// So the variables that carry how to connect and authenticate are let
// through, and only those. They come from the person's own environment;
// none of them is ever built from a change, a task or an agent's output.

import { simpleGit, type SimpleGit } from "simple-git";

/** The variables a push, fetch or pull needs from the person's environment
 * to reach and authenticate with a remote. */
export const GIT_CONNECTION_ENVIRONMENT: readonly string[] = [
  "GIT_ASKPASS",
  "SSH_ASKPASS",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "GIT_SSH_VARIANT",
  "GIT_TERMINAL_PROMPT",
];

/** A simple-git instance for `cwd`, with the connection variables above let
 * through. Throws, as `simpleGit` does, when `cwd` is not a directory. */
export function openGit(cwd: string): SimpleGit {
  return simpleGit({
    baseDir: cwd,
    allowEnvironment: GIT_CONNECTION_ENVIRONMENT,
    // An askpass helper and an SSH command run a program by design; letting
    // the person's own through is what keeps their remote reachable.
    unsafe: { allowUnsafeAskPass: true, allowUnsafeSshCommand: true },
  });
}
