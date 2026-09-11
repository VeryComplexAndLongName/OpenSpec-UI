import { describe, expect, it } from "vitest";
import {
  applicableRepoSetupActionIds,
  isGitHubRemote,
  repoSetupActionVerdict,
  resolveRepoSetupActions,
} from "./repo-setup-actions.js";

/** Both Copilot signals definitely absent, so the Copilot action is out
 * of the way of a test about something else. */
const NO_COPILOT = { copilotExtension: false, copilotCli: false } as const;

describe("isGitHubRemote", () => {
  it("recognises github.com however it is written", () => {
    for (const url of [
      "https://github.com/owner/repo.git",
      "https://github.com/owner/repo",
      "https://www.github.com/owner/repo",
      "git@github.com:owner/repo.git",
      "ssh://git@github.com/owner/repo.git",
      "HTTPS://GitHub.com/Owner/Repo",
    ]) {
      expect(isGitHubRemote(url), url).toBe(true);
    }
  });

  it("says no to a host it read that is not github.com", () => {
    // A definite answer about github.com, which is what Dependabot
    // needs — and deliberately not an answer about Enterprise.
    for (const url of [
      "https://gitlab.com/owner/repo.git",
      "git@bitbucket.org:owner/repo.git",
      "https://git.example.com/owner/repo.git",
      "https://github.io/owner/repo",
      "https://notgithub.com/owner/repo",
    ]) {
      expect(isGitHubRemote(url), url).toBe(false);
    }
  });

  it("says it could not tell where no host could be read", () => {
    for (const url of [undefined, "", "   ", "not a url at all"]) {
      expect(isGitHubRemote(url), String(url)).toBeUndefined();
    }
  });
});

describe("resolveRepoSetupActions", () => {
  it("always offers the agent instructions", () => {
    // Plain files any agent may read; nothing's absence makes them
    // pointless.
    const ids = applicableRepoSetupActionIds({ originUrl: "https://gitlab.com/o/r", ...NO_COPILOT });

    expect(ids).toContain("generate-agent-instructions");
  });

  it("offers Dependabot on a GitHub origin and not on another host", () => {
    expect(applicableRepoSetupActionIds({ originUrl: "https://github.com/o/r", ...NO_COPILOT }))
      .toContain("configure-dependabot");
    expect(applicableRepoSetupActionIds({ originUrl: "https://gitlab.com/o/r", ...NO_COPILOT }))
      .not.toContain("configure-dependabot");
  });

  it("offers Dependabot where the origin could not be read at all", () => {
    // Not knowing is not knowing that it is absent. Hiding here would
    // take the action from somebody whose setup could not be examined.
    expect(applicableRepoSetupActionIds({ ...NO_COPILOT })).toContain("configure-dependabot");
  });

  it("offers the Copilot instructions on either signal", () => {
    for (const facts of [
      { copilotExtension: true, copilotCli: false },
      { copilotExtension: false, copilotCli: true },
      { copilotExtension: true, copilotCli: true },
    ]) {
      expect(applicableRepoSetupActionIds(facts), JSON.stringify(facts))
        .toContain("generate-subtype-instructions");
    }
  });

  it("withholds the Copilot instructions only when both signals are definitely absent", () => {
    expect(applicableRepoSetupActionIds(NO_COPILOT)).not.toContain("generate-subtype-instructions");
    // One unknown is not a negative.
    expect(applicableRepoSetupActionIds({ copilotExtension: false }))
      .toContain("generate-subtype-instructions");
    expect(applicableRepoSetupActionIds({})).toContain("generate-subtype-instructions");
  });

  it("gives a withheld action a reason that says what to do about it", () => {
    const dependabot = repoSetupActionVerdict({ originUrl: "https://gitlab.com/o/r", ...NO_COPILOT }, "configure-dependabot");

    expect(dependabot.applies).toBe(false);
    expect(dependabot.reason).toContain("gitlab.com");
    // The escape hatch is the only correct answer to Enterprise, so the
    // reason has to mention it.
    expect(dependabot.reason).toContain("Enterprise");
  });

  it("gives an action that applies no reason at all", () => {
    const dependabot = repoSetupActionVerdict({ originUrl: "https://github.com/o/r" }, "configure-dependabot");

    expect(dependabot.applies).toBe(true);
    expect(dependabot.reason).toBeUndefined();
  });

  it("names every action exactly once, whatever the facts", () => {
    // A caller rendering this list must not have to guess whether an
    // id is missing because it was withheld or because it was dropped.
    for (const facts of [{}, NO_COPILOT, { originUrl: "https://github.com/o/r", copilotCli: true }]) {
      const ids = resolveRepoSetupActions(facts).map((action) => action.id);
      expect(new Set(ids).size).toBe(3);
    }
  });
});
