import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { agentsAcceptingCustomAgents, customAgentFamilyFor, findCustomAgents } from "./custom-agents.js";
import { normalizeStepAgent } from "./harness-step-agent.js";

// custom-agents-are-visible:
// touches the filesystem, so its cost varies with the machine. Measured
// 2026-09-09 at under 200ms for the whole file; sized well above that.
import { vi } from "vitest";
vi.setConfig({ testTimeout: 15000 });

const roots: string[] = [];

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "custom-agents-"));
  roots.push(root);
  return root;
}

async function define(root: string, relative: string, name: string, body: string): Promise<void> {
  await mkdir(path.join(root, relative), { recursive: true });
  await writeFile(path.join(root, relative, `${name}.md`), body, "utf8");
}

describe("findCustomAgents", () => {
  it("finds a project definition for each family", async () => {
    const root = await workspace();
    await define(root, path.join(".claude", "agents"), "reviewer", "---\ndescription: Reviews a diff\n---\nbody");
    await define(root, path.join(".github", "agents"), "planner", "no frontmatter here");

    const found = await findCustomAgents(root);

    expect(found.map((agent) => `${agent.family}/${agent.name}`)).toEqual(["claude/reviewer", "copilot/planner"]);
    expect(found[0]?.description).toBe("Reviews a diff");
    // Absent is ordinary: a file without frontmatter is still a usable
    // agent, because its name is what the CLI accepts.
    expect(found[1]?.description).toBeUndefined();
  });

  it("prefers the project's definition over the user's on a name collision", async () => {
    // The project's is the one the CLI itself would use.
    const root = await workspace();
    const home = await workspace();
    await define(home, path.join(".claude", "agents"), "reviewer", "---\ndescription: user level\n---");
    await define(root, path.join(".claude", "agents"), "reviewer", "---\ndescription: project level\n---");

    const found = await findCustomAgents(root, home);

    expect(found).toHaveLength(1);
    expect(found[0]?.description).toBe("project level");
  });

  it("finds a user-level definition the project does not shadow", async () => {
    const root = await workspace();
    const home = await workspace();
    await define(home, path.join(".claude", "agents"), "only-mine", "---\ndescription: user level\n---");

    const found = await findCustomAgents(root, home);

    expect(found.map((agent) => agent.name)).toEqual(["only-mine"]);
  });

  it("yields nothing for a workspace that defines none", async () => {
    // The ordinary case — most workspaces define none, including the one
    // this was written in — and not an error.
    await expect(findCustomAgents(await workspace())).resolves.toEqual([]);
  });

  it("ignores files that are not definitions", async () => {
    const root = await workspace();
    await define(root, path.join(".claude", "agents"), "real", "---\ndescription: yes\n---");
    await mkdir(path.join(root, ".claude", "agents", "a-directory"), { recursive: true });
    await writeFile(path.join(root, ".claude", "agents", "notes.txt"), "not a definition", "utf8");

    expect((await findCustomAgents(root)).map((agent) => agent.name)).toEqual(["real"]);
  });
});

describe("which agents accept a custom one", () => {
  it("maps an agent id to its family, and says when there is none", () => {
    expect(customAgentFamilyFor("claude-cli-acp")).toBe("claude");
    expect(customAgentFamilyFor("copilot-cli")).toBe("copilot");
    // Offering one for an agent whose CLI cannot take it is the same
    // defect as a ceiling that cannot act.
    expect(customAgentFamilyFor("gemini-cli")).toBeUndefined();
    expect(customAgentFamilyFor("local-llm")).toBeUndefined();
  });

  it("lists the registry agents that accept one", () => {
    const accepting = agentsAcceptingCustomAgents();

    expect(accepting).toContain("claude-cli");
    expect(accepting).toContain("copilot-cli-acp");
    expect(accepting).not.toContain("gemini-cli-acp");
  });
});

describe("normalizeStepAgent carries the custom agent", () => {
  it("returns it rather than only declaring that it might", () => {
    // The type said the field could be there and the body did not copy
    // it — the same gap this repository has now closed three times in two
    // days. Asserted directly, because a type is not a test.
    expect(normalizeStepAgent({ agent: "claude-cli-acp", customAgent: "reviewer" }))
      .toMatchObject({ agent: "claude-cli-acp", customAgent: "reviewer" });
  });
});
