// See openspec/changes/human-only-inbox/proposal.md, "A spec delta that
// has drifted" — `openspec archive` already refuses a `## MODIFIED
// Requirements` block whose requirement header or scenarios no longer
// match the specification it modifies, but it refuses at the archive
// step, after the work is finished and reviewed. This runs the same
// comparison as a test, so the drift is caught at pull-request time
// instead — see design.md, "the checks are tests in packages/core".

import { readFile } from "node:fs/promises";
import path from "node:path";
import { discoverOpenSpecWorkspace } from "./workbench.js";

export interface SpecRequirement {
  header: string;
  scenarios: string[];
}

const REQUIREMENT_HEADER_RE = /^###\s+Requirement:\s*(.+?)\s*$/;
const SCENARIO_HEADER_RE = /^####\s+Scenario:\s*(.+?)\s*$/;
const TOP_LEVEL_HEADING_RE = /^##\s+/;

/** Every `### Requirement:` block in a spec.md-shaped document, in order,
 * each carrying the `#### Scenario:` titles nested under it. Works the
 * same whether `source` is a whole `openspec/specs/<id>/spec.md` or one
 * `## MODIFIED Requirements` section sliced out of a change's delta —
 * both use the identical `### Requirement:` / `#### Scenario:` shape. */
export function parseSpecRequirements(source: string): SpecRequirement[] {
  const requirements: SpecRequirement[] = [];
  let current: SpecRequirement | undefined;
  for (const line of source.split(/\r?\n/)) {
    const requirementMatch = line.match(REQUIREMENT_HEADER_RE);
    if (requirementMatch) {
      current = { header: requirementMatch[1] ?? "", scenarios: [] };
      requirements.push(current);
      continue;
    }
    const scenarioMatch = line.match(SCENARIO_HEADER_RE);
    if (scenarioMatch && current) {
      current.scenarios.push(scenarioMatch[1] ?? "");
    }
  }
  return requirements;
}

/** The `## MODIFIED Requirements` section of a delta spec, if it has one —
 * from that heading up to (not including) the next top-level `## `
 * heading, or the end of the file. `undefined` when the delta names no
 * modified requirement, which is the common case: most deltas only add. */
export function extractModifiedSection(source: string): string | undefined {
  const lines = source.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => line.trim() === "## MODIFIED Requirements");
  if (startIndex === -1) return undefined;

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (TOP_LEVEL_HEADING_RE.test(lines[i] ?? "")) {
      endIndex = i;
      break;
    }
  }
  return lines.slice(startIndex, endIndex).join("\n");
}

export interface SpecDeltaViolation {
  changeId: string;
  specId: string;
  filePath: string;
  reason: string;
}

/** Compares one delta's `## MODIFIED Requirements` block against the
 * current `openspec/specs/<specId>/spec.md` it claims to modify. A header
 * the current spec no longer carries, or a scenario the current spec
 * carries that the block omits, is drift — the block was accurate when
 * written, and another change landed a rename or an added scenario in
 * between. Names the header or scenario at issue, matching what
 * `openspec archive` already reports for the same failure. */
export function checkSpecDeltaAgainstSpec(
  deltaModifiedSection: string,
  currentSpecSource: string,
): string[] {
  const deltaRequirements = parseSpecRequirements(deltaModifiedSection);
  const currentRequirements = parseSpecRequirements(currentSpecSource);
  const currentByHeader = new Map(currentRequirements.map((requirement) => [requirement.header, requirement]));

  const reasons: string[] = [];
  for (const delta of deltaRequirements) {
    const current = currentByHeader.get(delta.header);
    if (!current) {
      reasons.push(
        `requirement header ${JSON.stringify(delta.header)} does not exist in the current specification`,
      );
      continue;
    }
    const deltaScenarios = new Set(delta.scenarios);
    for (const scenario of current.scenarios) {
      if (!deltaScenarios.has(scenario)) {
        reasons.push(
          `scenario ${JSON.stringify(scenario)} under requirement ${JSON.stringify(delta.header)}`
            + " exists in the current specification but is omitted from this change's modified block",
        );
      }
    }
  }
  return reasons;
}

/** Runs `checkSpecDeltaAgainstSpec` for every `## MODIFIED Requirements`
 * block across every active change's delta specs. A delta targeting a
 * spec that does not exist yet is skipped — that is a different failure
 * (`openspec change validate` catches it), not drift. */
export async function checkSpecDeltaDrift(root: string): Promise<SpecDeltaViolation[]> {
  const workspace = await discoverOpenSpecWorkspace(root);
  const violations: SpecDeltaViolation[] = [];

  for (const change of workspace.changes) {
    for (const artifact of change.artifacts) {
      if (artifact.kind !== "delta-spec" || !artifact.exists) continue;
      const specId = artifact.label;

      const currentSpecPath = path.join(root, "openspec", "specs", specId, "spec.md");
      let currentSpecSource: string;
      try {
        currentSpecSource = await readFile(currentSpecPath, "utf8");
      } catch {
        continue;
      }

      const deltaSource = await readFile(artifact.path, "utf8");
      const modifiedSection = extractModifiedSection(deltaSource);
      if (!modifiedSection) continue;

      for (const reason of checkSpecDeltaAgainstSpec(modifiedSection, currentSpecSource)) {
        violations.push({ changeId: change.name, specId, filePath: artifact.path, reason });
      }
    }
  }
  return violations;
}
