import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listBootstrapProjectTypes,
  writeAgentInstructions,
  writeDependabotConfig,
  writeSubtypeInstructions,
} from "./repo-bootstrap.js";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-repo-bootstrap-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("listBootstrapProjectTypes", () => {
  it("lists both seed project types", () => {
    expect(listBootstrapProjectTypes()).toEqual([
      { id: "node", label: "Node.js / TypeScript" },
      { id: "python", label: "Python" },
    ]);
  });
});

describe("writeAgentInstructions", () => {
  it("creates CLAUDE.md and AGENTS.md with identical managed content", async () => {
    const root = await temporaryRoot();

    const result = await writeAgentInstructions(root, "node");

    expect(result).toEqual({ claude: "created", agents: "created" });
    const claude = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(claude).toBe(agents);
    expect(claude).toContain("<!-- openspec-ui:managed start -->");
    expect(claude).toContain("Node.js / TypeScript Guidelines");
  });

  it("leaves a foreign existing file untouched and reports it", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "CLAUDE.md"), "# Hand-written instructions\n");

    const result = await writeAgentInstructions(root, "python");

    expect(result.claude).toBe("skipped-foreign");
    expect(result.agents).toBe("created");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toBe("# Hand-written instructions\n");
  });

  it("regenerating an owned file preserves user content after the end marker", async () => {
    const root = await temporaryRoot();
    await writeAgentInstructions(root, "node");
    const original = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    const withUserContent = `${original}\n## My own notes\n\nDo not touch this.\n`;
    await writeFile(path.join(root, "CLAUDE.md"), withUserContent);

    const result = await writeAgentInstructions(root, "python");

    expect(result.claude).toBe("updated");
    const updated = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    expect(updated).toContain("Python Guidelines");
    expect(updated).not.toContain("Node.js / TypeScript Guidelines");
    expect(updated).toContain("## My own notes\n\nDo not touch this.\n");
  });
});

describe("writeSubtypeInstructions", () => {
  it("creates .github/instructions/<subtype>.instructions.md with applyTo frontmatter", async () => {
    const root = await temporaryRoot();

    const result = await writeSubtypeInstructions(root, "node", "backend");

    expect(result).toBe("created");
    const content = await readFile(path.join(root, ".github", "instructions", "backend.instructions.md"), "utf8");
    expect(content.startsWith('---\napplyTo: "**"\n---\n\n')).toBe(true);
    expect(content).toContain("Backend-specific notes");
  });

  it("leaves a foreign existing instructions file untouched", async () => {
    const root = await temporaryRoot();
    const dir = path.join(root, ".github", "instructions");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "backend.instructions.md"), "hand-written\n");

    const result = await writeSubtypeInstructions(root, "node", "backend");

    expect(result).toBe("skipped-foreign");
    expect(await readFile(path.join(dir, "backend.instructions.md"), "utf8")).toBe("hand-written\n");
  });
});

describe("writeDependabotConfig", () => {
  it("creates the file with the requested ecosystem plus github-actions", async () => {
    const root = await temporaryRoot();

    const result = await writeDependabotConfig(root, ["node"]);

    expect(result).toBe("created");
    const content = await readFile(path.join(root, ".github", "dependabot.yml"), "utf8");
    expect(content).toContain('package-ecosystem: "npm"');
    expect(content).toContain('package-ecosystem: "github-actions"');
    expect(content).not.toContain('package-ecosystem: "pip"');
  });

  it("accumulates ecosystems across separate invocations instead of overwriting", async () => {
    const root = await temporaryRoot();
    await writeDependabotConfig(root, ["node"]);

    const result = await writeDependabotConfig(root, ["python"]);

    expect(result).toBe("updated");
    const content = await readFile(path.join(root, ".github", "dependabot.yml"), "utf8");
    expect(content).toContain('package-ecosystem: "npm"');
    expect(content).toContain('package-ecosystem: "pip"');
  });

  it("leaves a foreign existing dependabot.yml untouched", async () => {
    const root = await temporaryRoot();
    const dir = path.join(root, ".github");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "dependabot.yml"), "version: 2\nupdates: []\n");

    const result = await writeDependabotConfig(root, ["node"]);

    expect(result).toBe("skipped-foreign");
    expect(await readFile(path.join(dir, "dependabot.yml"), "utf8")).toBe("version: 2\nupdates: []\n");
  });
});
