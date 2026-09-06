import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverOpenSpecWorkspace } from "./workbench.js";
import {
  checkSpecDeltaAgainstSpec,
  checkSpecDeltaDrift,
  extractModifiedSection,
  parseSpecRequirements,
} from "./spec-delta-check.js";

// Cost-varying: the `checkSpecDeltaDrift` cases each write a temporary
// directory, and the repository gate below reads every active change's
// delta specs. Measured 2026-09-06 on an idle machine: 397ms for the
// whole file, of which the repository gate is 302ms. Budgeted far above
// that, because the number that matters is the one a loaded machine
// reaches — a timeout sized to the idle measurement reports contention
// as a failure (LIMITS.md, "a budget is a ceiling, not a target").
vi.setConfig({ testTimeout: 20_000 });

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function repoWith(spec: { id: string; source: string }, change: { id: string; deltaSource: string }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-spec-delta-check-"));
  roots.push(root);

  const specDir = path.join(root, "openspec", "specs", spec.id);
  await mkdir(specDir, { recursive: true });
  await writeFile(path.join(specDir, "spec.md"), spec.source, "utf8");

  const changeSpecsDir = path.join(root, "openspec", "changes", change.id, "specs", spec.id);
  await mkdir(changeSpecsDir, { recursive: true });
  await writeFile(path.join(changeSpecsDir, "spec.md"), change.deltaSource, "utf8");

  return root;
}

describe("parseSpecRequirements", () => {
  it("reads requirement headers with their nested scenario titles", () => {
    const source = [
      "### Requirement: First",
      "Body text.",
      "#### Scenario: One",
      "- WHEN x",
      "#### Scenario: Two",
      "### Requirement: Second",
      "#### Scenario: Three",
    ].join("\n");
    expect(parseSpecRequirements(source)).toEqual([
      { header: "First", scenarios: ["One", "Two"] },
      { header: "Second", scenarios: ["Three"] },
    ]);
  });
});

describe("extractModifiedSection", () => {
  it("slices from the heading to the next top-level heading", () => {
    const source = [
      "## ADDED Requirements",
      "### Requirement: New",
      "## MODIFIED Requirements",
      "### Requirement: Changed",
      "#### Scenario: A",
      "## REMOVED Requirements",
      "### Requirement: Gone",
    ].join("\n");
    const section = extractModifiedSection(source);
    expect(section).toContain("### Requirement: Changed");
    expect(section).toContain("#### Scenario: A");
    expect(section).not.toContain("### Requirement: New");
    expect(section).not.toContain("### Requirement: Gone");
  });

  it("returns undefined when the delta names no modified requirement", () => {
    expect(extractModifiedSection("## ADDED Requirements\n### Requirement: New\n")).toBeUndefined();
  });
});

describe("checkSpecDeltaAgainstSpec", () => {
  it("passes when the delta matches the current specification", () => {
    const current = "### Requirement: A thing\n#### Scenario: It works\n";
    const delta = "## MODIFIED Requirements\n\n### Requirement: A thing\n#### Scenario: It works\n";
    expect(checkSpecDeltaAgainstSpec(delta, current)).toEqual([]);
  });

  it("fails when the requirement header was renamed since the change was written — harness-git-stage-no-agent", () => {
    // harness-git-stage-no-agent targeted "A stage that invokes no agent
    // offers no agent setting" while the specification had settled on
    // "...offers none to configure".
    const current = "### Requirement: A stage that invokes no agent offers none to configure\n"
      + "#### Scenario: Configuring an agent for a mechanical stage\n";
    const delta = "## MODIFIED Requirements\n\n"
      + "### Requirement: A stage that invokes no agent offers no agent setting\n"
      + "#### Scenario: Configuring an agent for a mechanical stage\n";
    const reasons = checkSpecDeltaAgainstSpec(delta, current);
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain("offers no agent setting");
  });

  it("fails when the specification carries a scenario the block omits — agentic-harness-git-stage", () => {
    const current = "### Requirement: The git stage runs in sequence\n"
      + "#### Scenario: git stage runs after archive\n"
      + "#### Scenario: A check fails\n"
      + "#### Scenario: No check result is available\n"
      + "#### Scenario: The pull request is left open for a human\n";
    const delta = "## MODIFIED Requirements\n\n"
      + "### Requirement: The git stage runs in sequence\n"
      + "#### Scenario: git stage runs after archive\n";
    const reasons = checkSpecDeltaAgainstSpec(delta, current);
    expect(reasons).toHaveLength(3);
    expect(reasons.join("\n")).toContain("A check fails");
    expect(reasons.join("\n")).toContain("No check result is available");
    expect(reasons.join("\n")).toContain("The pull request is left open for a human");
  });

  it("does not fail when the delta adds a scenario the specification doesn't have yet", () => {
    // A block may be ahead of the spec it will replace — only a scenario
    // the *current* spec already carries and the block omits is drift.
    const current = "### Requirement: A thing\n#### Scenario: It works\n";
    const delta = "## MODIFIED Requirements\n\n### Requirement: A thing\n"
      + "#### Scenario: It works\n#### Scenario: A brand new one\n";
    expect(checkSpecDeltaAgainstSpec(delta, current)).toEqual([]);
  });
});

describe("checkSpecDeltaDrift", () => {
  it("fails a change whose modified block has drifted from the live spec", async () => {
    const root = await repoWith(
      { id: "some-capability", source: "### Requirement: A thing\n#### Scenario: It works\n#### Scenario: Added later\n" },
      { id: "the-change", deltaSource: "## MODIFIED Requirements\n\n### Requirement: A thing\n#### Scenario: It works\n" },
    );
    const violations = await checkSpecDeltaDrift(root);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.changeId).toBe("the-change");
    expect(violations[0]?.specId).toBe("some-capability");
    expect(violations[0]?.reason).toContain("Added later");
  });

  it("passes a change whose modified block still matches", async () => {
    const root = await repoWith(
      { id: "some-capability", source: "### Requirement: A thing\n#### Scenario: It works\n" },
      { id: "the-change", deltaSource: "## MODIFIED Requirements\n\n### Requirement: A thing\n#### Scenario: It works\n" },
    );
    expect(await checkSpecDeltaDrift(root)).toEqual([]);
  });

  it("skips a delta targeting a spec that does not exist yet", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "openspec-spec-delta-check-"));
    roots.push(root);
    const changeSpecsDir = path.join(root, "openspec", "changes", "the-change", "specs", "missing-capability");
    await mkdir(changeSpecsDir, { recursive: true });
    await writeFile(
      path.join(changeSpecsDir, "spec.md"),
      "## MODIFIED Requirements\n\n### Requirement: A thing\n",
      "utf8",
    );
    await expect(checkSpecDeltaDrift(root)).resolves.toEqual([]);
  });
});

describe("this repository's own changes", () => {
  // The gate, in the shape `change-graph.test.ts` established. Without it
  // this check would only ever run over fixtures, and the drift it exists
  // to catch — another change landing a rename or a new scenario under a
  // requirement some open change also modifies — happens in this tree,
  // not in a fixture.
  it("has no active change whose modified block has drifted from the spec it modifies", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const workspaceRoot = path.resolve(here, "..", "..", "..");
    await expect(stat(path.join(workspaceRoot, "openspec", "changes"))).resolves.toBeDefined();

    // Guards a clean result that is only clean because the check reached
    // nothing: a spec id that stopped resolving to a file would otherwise
    // read as "no drift" forever. Measured 2026-09-06: 5 delta specs
    // across the active changes, one of them carrying a MODIFIED block.
    const workspace = await discoverOpenSpecWorkspace(workspaceRoot);
    const deltaSpecs = workspace.changes.flatMap((change) =>
      change.artifacts.filter((artifact) => artifact.kind === "delta-spec" && artifact.exists));
    expect(deltaSpecs.length).toBeGreaterThan(0);

    expect(await checkSpecDeltaDrift(workspaceRoot)).toEqual([]);
  });
});
