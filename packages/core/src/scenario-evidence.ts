import type { SimpleGit } from "simple-git";
import { z } from "zod";
import type { GitHubChecksReport } from "./github-checks.js";
import { extractDeltaSection, parseSpecRequirements } from "./spec-delta-check.js";

const name = z.string().trim().min(1).max(400);
const associations = z.strictObject({
  scenarios: z.array(z.strictObject({
    capability: name,
    requirement: name,
    scenario: name,
    checks: z.array(name).min(1).max(30),
  })).max(1000),
});

interface Scenario {
  capability: string;
  requirement: string;
  scenario: string;
}

function key({ capability, requirement, scenario }: Scenario): string {
  return JSON.stringify([capability, requirement, scenario]);
}

interface ScenarioEvidence {
  scenarios: Array<Scenario & { checks: string[] }>;
  warnings: string[];
}

export function scenarioEvidence(deltas: { capability: string; text: string }[], mapping?: string): ScenarioEvidence {
  const scenarios = deltas.flatMap(({ capability, text }) =>
    (["ADDED", "MODIFIED"] as const).flatMap((operation) =>
      parseSpecRequirements(extractDeltaSection(text, operation) ?? "").flatMap((requirement) =>
        requirement.scenarios.map((scenario) => ({ capability, requirement: requirement.header, scenario })))),
  );
  const warnings: string[] = [];
  const declared = new Map<string, string[]>();
  if (mapping !== undefined) {
    try {
      const parsed = associations.parse(JSON.parse(mapping));
      const keys = new Set(scenarios.map(key));
      for (const one of parsed.scenarios) {
        const id = key(one);
        if (!keys.has(id)) warnings.push("An association names a scenario absent from the reviewed delta.");
        else if (declared.has(id)) warnings.push("A scenario is listed more than once.");
        else declared.set(id, [...new Set(one.checks)]);
      }
    } catch {
      warnings.push("scenario-checks.json has an invalid format.");
    }
    if (warnings.length > 0) declared.clear();
  }
  return { scenarios: scenarios.map((one) => ({ ...one, checks: declared.get(key(one)) ?? [] })), warnings };
}

export async function readScenarioEvidence(git: SimpleGit, head: string, change: string): Promise<ScenarioEvidence> {
  const prefix = `openspec/changes/${change}/`;
  const mappingPath = `${prefix}scenario-checks.json`;
  try {
    const tracked = (await git.raw(["ls-tree", "-r", "--name-only", "-z", head, "--", prefix])).split("\0");
    const specs = tracked.flatMap((file) => {
      const capability = file.startsWith(prefix)
        ? /^specs\/([a-z0-9][a-z0-9-]*)\/spec\.md$/u.exec(file.slice(prefix.length))?.[1]
        : undefined;
      return capability === undefined ? [] : [{ file, capability }];
    });
    const read = (file: string) => git.raw(["show", `${head}:${file}`]);
    const deltas = await Promise.all(specs.map(async ({ file, capability }) => ({ capability, text: await read(file) })));
    return scenarioEvidence(deltas, tracked.includes(mappingPath) ? await read(mappingPath) : undefined);
  } catch {
    return { scenarios: [], warnings: ["Scenario evidence could not be read from the reviewed commit."] };
  }
}

export function scenarioCheckState(name: string, head: string, report?: GitHubChecksReport): string {
  if (report?.kind !== "checks") return "No GitHub result read";
  if (report.head !== head) return "GitHub reported a different commit";
  const matches = report.checks.filter((one) => one.name === name);
  if (!report.resultsComplete) return "GitHub results incomplete";
  if (matches.length > 1) return "Several results use this name";
  return matches[0]?.state.replaceAll("_", " ") ?? "No result on this commit";
}
