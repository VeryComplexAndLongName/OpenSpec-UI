// Gathering the facts the core rule decides on — see
// `repo-setup-actions.ts` and
// openspec/changes/setup-offers-only-what-applies/design.md.
//
// Knowing how to ask VS Code whether an extension is installed is this
// host's job. Knowing what the answer means is not: the rule lives in
// core so it can be tested without an editor.

import * as vscode from "vscode";
import { createGitWrapper, detectAvailableAgents, type RepoSetupFacts } from "@openspec-ui/core";

/** Extension ids that mean Copilot is here. Chat is listed too: a
 * person who installed only the chat extension still has Copilot
 * reading `.github/instructions/`. */
const COPILOT_EXTENSION_IDS = ["GitHub.copilot", "GitHub.copilot-chat"];

/** Cached for the session. The tree is rebuilt on every workspace
 * change, and probing the path for a binary costs a process — one per
 * rebuild is how a tree view becomes the reason an editor feels slow.
 *
 * The cost of caching is that installing Copilot with the window open
 * does not make the row appear until the window is reloaded, which is
 * stated in the change's design rather than solved with a watcher. */
let cached: Promise<RepoSetupFacts> | undefined;

export function forgetRepoSetupFacts(): void {
  cached = undefined;
}

export function readRepoSetupFacts(workspaceRoot: string): Promise<RepoSetupFacts> {
  cached ??= gather(workspaceRoot);
  return cached;
}

async function gather(workspaceRoot: string): Promise<RepoSetupFacts> {
  const facts: RepoSetupFacts = {};

  // Every failure below leaves its field `undefined` rather than
  // `false`. A fact that could not be established is not a negative,
  // and the rule in core withholds an action only on a definite one.
  try {
    const url = await createGitWrapper({ cwd: workspaceRoot }).remoteUrl("origin");
    if (url) facts.originUrl = url;
  } catch {
    // No git, no remote, or the command failed: where this repository
    // is hosted is unknown, and unknown shows the action.
  }

  try {
    facts.copilotExtension = COPILOT_EXTENSION_IDS.some((id) => vscode.extensions.getExtension(id) !== undefined);
  } catch {
    // Not reachable in a real host; a test double without
    // `vscode.extensions` would land here rather than throw out of the
    // tree.
  }

  try {
    const detected = await detectAvailableAgents();
    facts.copilotCli = Object.entries(detected)
      .some(([id, present]) => present && id.startsWith("copilot"));
  } catch {
    // The probe could not run. Again: unknown, not absent.
  }

  return facts;
}
