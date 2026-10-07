import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORKFLOW_SECTION_END,
  WORKFLOW_SECTION_START,
  renderWorkflowRules,
  workflowRulesNeedConsent,
  writeWorkflowRules,
} from "./agent-workflow-rules.js";
import { writeAgentInstructions } from "./repo-bootstrap.js";

// every-varying-check-has-a-budget: a few small file writes in a
// temporary directory, no process spawned.
vi.setConfig({ testTimeout: 15_000 });

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repository(name = "shop"): Promise<string> {
  const parent = await mkdtemp(path.join(os.tmpdir(), "openspec-rules-"));
  roots.push(parent);
  const root = path.join(parent, name);
  await import("node:fs/promises").then((fs) => fs.mkdir(root));
  return root;
}

const read = (root: string, name: string) => readFile(path.join(root, name), "utf8");

// agents-are-told-how-work-is-done-here 1.1.
describe("the workflow rules", () => {
  it("tell where a change is worked, with the repository's own name, and who does which stage", () => {
    const rules = renderWorkflowRules("shop");

    expect(rules.startsWith(WORKFLOW_SECTION_START)).toBe(true);
    expect(rules.endsWith(WORKFLOW_SECTION_END)).toBe(true);
    expect(rules).toContain("../.worktrees/shop/<change-id>");
    expect(rules).toContain("OPENSPEC_UI_WORKTREE_ROOT");
    expect(rules).toContain("openspec-ui-cli worktree add <change-id> --base origin/main");
    expect(rules).toContain("git worktree add ../.worktrees/shop/<change-id> -b <change-id> origin/main");
    expect(rules).toContain("Do not create an OpenSpec change, or edit one, in this checkout");
    expect(rules).toContain("openspec/agent-harness.json");
  });

  it("creates both files where there are none", async () => {
    const root = await repository();

    expect(await writeWorkflowRules(root, { appendToForeign: false })).toEqual({ "CLAUDE.md": "created", "AGENTS.md": "created" });
    expect(await read(root, "AGENTS.md")).toContain("../.worktrees/shop/<change-id>");
  });

  it("asks before adding to a file somebody else wrote, and appends to its end only when told", async () => {
    const root = await repository();
    await writeFile(path.join(root, "AGENTS.md"), "# Mine\n\nKeep this.\n", "utf8");

    expect(await workflowRulesNeedConsent(root)).toEqual(["AGENTS.md"]);
    expect((await writeWorkflowRules(root, { appendToForeign: false }))["AGENTS.md"]).toBe("skipped-foreign");
    expect(await read(root, "AGENTS.md")).toBe("# Mine\n\nKeep this.\n");

    expect((await writeWorkflowRules(root, { appendToForeign: true }))["AGENTS.md"]).toBe("appended");
    const after = await read(root, "AGENTS.md");
    expect(after.startsWith("# Mine\n\nKeep this.\n\n")).toBe(true);
    expect(after).toContain(WORKFLOW_SECTION_START);
  });

  it("rewrites its own section in place, and leaves the rest of the file as it was", async () => {
    const root = await repository();
    await writeFile(path.join(root, "CLAUDE.md"), `# Mine\n\n${WORKFLOW_SECTION_START}\nold rules\n${WORKFLOW_SECTION_END}\n\nAfter.\n`, "utf8");

    expect((await writeWorkflowRules(root, { appendToForeign: false }))["CLAUDE.md"]).toBe("updated");
    const after = await read(root, "CLAUDE.md");
    expect(after.startsWith("# Mine\n\n")).toBe(true);
    expect(after.endsWith("\n\nAfter.\n")).toBe(true);
    expect(after).not.toContain("old rules");
    expect((await writeWorkflowRules(root, { appendToForeign: false }))["CLAUDE.md"]).toBe("unchanged");
  });

  it("lives beside the project-type guidelines, in either order", async () => {
    const guidelinesFirst = await repository();
    await writeAgentInstructions(guidelinesFirst, "node");
    expect(await workflowRulesNeedConsent(guidelinesFirst)).toEqual([]);
    expect((await writeWorkflowRules(guidelinesFirst, { appendToForeign: false }))["CLAUDE.md"]).toBe("updated");
    const both = await read(guidelinesFirst, "CLAUDE.md");
    expect(both.indexOf("Node.js / TypeScript Guidelines")).toBeLessThan(both.indexOf(WORKFLOW_SECTION_START));

    const rulesFirst = await repository();
    await writeWorkflowRules(rulesFirst, { appendToForeign: false });
    expect(await writeAgentInstructions(rulesFirst, "python")).toEqual({ claude: "updated", agents: "updated" });
    const again = await read(rulesFirst, "AGENTS.md");
    expect(again).toContain("Python Guidelines");
    expect(again).toContain(WORKFLOW_SECTION_START);
  });
});
