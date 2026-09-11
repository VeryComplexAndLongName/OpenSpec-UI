// Which repository-setup actions can do anything here.
//
// Two of the three write a file that only means something when
// something else is true, and the two are not true in the same way.
// Dependabot is a service the repository's host runs — nothing is
// installed, and what decides it is where the repository lives. Copilot
// is a component on this machine, and its presence is a local fact.
// One rule over both would be wrong for half of them.
//
// A pure function over facts the host gathers: knowing how to ask VS
// Code whether an extension is installed is the host's job, and knowing
// what the answer means is not (ADR 0001). It is also what makes this
// testable without an editor.

export type RepoSetupActionId =
  | "generate-agent-instructions"
  | "configure-dependabot"
  | "generate-subtype-instructions";

/** What the host managed to find out. Every field is three-valued
 * through `undefined` on purpose: a fact that could not be established
 * is not the same as one established to be false, and this feature
 * treats them differently. */
export interface RepoSetupFacts {
  /** The origin remote's URL, or `undefined` where there is no remote,
   * no git, or the command failed. */
  originUrl?: string;
  /** Whether the Copilot editor extension is installed, or `undefined`
   * where the host could not ask. */
  copilotExtension?: boolean;
  /** Whether a `copilot` binary is on the path, or `undefined` where
   * the probe could not run. */
  copilotCli?: boolean;
}

export interface RepoSetupAction {
  id: RepoSetupActionId;
  applies: boolean;
  /** Why it does not apply, for the command to say when it is invoked
   * from the palette anyway. Absent when it applies. */
  reason?: string;
}

/** Whether the origin is GitHub: `true` for github.com, `false` for a
 * host that was read and is not it, `undefined` where no host could be
 * read at all.
 *
 * The three values matter. A host that was read and is not github.com
 * is a definite answer about github.com — which is what Dependabot
 * needs — even though it is NOT a definite answer about GitHub
 * Enterprise Server, which answers to whatever hostname its owner
 * chose and cannot be told from any other host by inspecting a URL.
 * Matching anything containing "github" would claim `github.io` and
 * miss `git.example.com`. Enterprise is served by the palette instead. */
export function isGitHubRemote(originUrl: string | undefined): boolean | undefined {
  if (!originUrl) return undefined;
  const trimmed = originUrl.trim();
  if (trimmed.length === 0) return undefined;

  // scp-style ssh (`git@github.com:owner/repo.git`) is not a URL, so it
  // is matched before anything tries to parse it as one.
  const scp = /^[^@\s/]+@([^:\s]+):/.exec(trimmed);
  let host: string | undefined;
  if (scp) {
    host = scp[1];
  } else {
    try {
      host = new URL(trimmed).hostname;
    } catch {
      host = undefined;
    }
  }

  if (host === undefined || host.length === 0) return undefined;
  return host.toLowerCase().replace(/^www\./, "") === "github.com";
}

/** Which of the three setup actions can do something, given what the
 * host managed to establish.
 *
 * The shared rule: an action is withheld only on a definite negative.
 * Hiding because an inspection failed takes a working capability from
 * somebody whose setup could not be examined and leaves them no way to
 * find out why; one extra row in a tree is the cheaper mistake. */
export function resolveRepoSetupActions(facts: RepoSetupFacts): RepoSetupAction[] {
  const github = isGitHubRemote(facts.originUrl);

  // Present where either signal says so; absent only where both say so
  // definitely. The owner chose the broader signal on 2026-09-11, so
  // that somebody working through `copilot-cli` is not cut off from a
  // file they may well want.
  const copilot: boolean | undefined =
    facts.copilotExtension === true || facts.copilotCli === true
      ? true
      : facts.copilotExtension === false && facts.copilotCli === false
        ? false
        : undefined;

  const actions: RepoSetupAction[] = [
    {
      // Plain files any agent may read. Nothing's absence would make
      // them pointless, so nothing is checked.
      id: "generate-agent-instructions",
      applies: true,
    },
    {
      id: "configure-dependabot",
      applies: github !== false,
    },
    {
      id: "generate-subtype-instructions",
      applies: copilot !== false,
    },
  ];

  if (github === false) {
    actions[1]!.reason = `this repository's origin is ${facts.originUrl ?? "unknown"}, which is not github.com, and`
      + " Dependabot is a service GitHub runs — the file would be read by nothing."
      + " A GitHub Enterprise Server install cannot be recognised from a URL, so if that is what this is, proceed.";
  }
  if (copilot === false) {
    actions[2]!.reason = "GitHub Copilot is not installed here — neither the editor extension nor a copilot binary"
      + " on the path — and it is what reads these files.";
  }

  return actions;
}

/** Just the ids that apply, for a caller that only renders a list. */
export function applicableRepoSetupActionIds(facts: RepoSetupFacts): RepoSetupActionId[] {
  return resolveRepoSetupActions(facts).filter((action) => action.applies).map((action) => action.id);
}

/** One action's verdict, for a command asked to run whether or not it
 * was listed. */
export function repoSetupActionVerdict(
  facts: RepoSetupFacts,
  id: RepoSetupActionId,
): RepoSetupAction {
  const found = resolveRepoSetupActions(facts).find((action) => action.id === id);
  if (!found) throw new Error(`Unknown repository setup action "${id}"`);
  return found;
}
