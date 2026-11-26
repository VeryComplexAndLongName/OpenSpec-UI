import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { SaxesParser } from "saxes";
import { z } from "zod";
import { JUNIT_XML_MAX_BYTES } from "./change-actions.js";
import { assertValidChangeName } from "./change-name.js";
import { openGit } from "./git-client.js";
import { formatMessage, say } from "./message-register.js";
import type { ReviewScenario } from "./scenario-evidence.js";
import { editMappingFile, type ScenarioMappingPreview } from "./scenario-mapping-edit.js";

const sha = z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u);
const label = z.string().min(1).max(400);
const identity = z.strictObject({ classname: z.string().max(400), name: label });
const testcase = identity.extend({ state: z.enum(["passed", "failed", "error", "skipped"]) });
const snapshot = z.strictObject({ testedCommit: sha, importedAt: z.string().datetime(), tests: z.array(testcase).max(2000) });
const scenarioIdentity = z.strictObject({ capability: label, requirement: label, scenario: label });
const associations = z.strictObject({ scenarios: z.array(scenarioIdentity.extend({
  tests: z.array(identity).min(1).max(100),
})).max(1000) });
const request = z.strictObject({ head: sha, testedCommit: sha, xml: z.string() });
const reportId = z.string().regex(/^[a-f0-9]{64}$/u);
const testSelection = z.strictObject({ head: sha, reportId, scenario: scenarioIdentity, test: identity });
const testMappingRequest = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("preview"), selection: testSelection }),
  z.strictObject({ mode: z.literal("save"), selection: testSelection, revision: reportId }),
]);
export type JUnitMappingRequest = z.infer<typeof testMappingRequest>;
export type JUnitMappingPreview = ScenarioMappingPreview<z.infer<typeof testSelection>>;
type TestCase = z.infer<typeof testcase>;
type Snapshot = z.infer<typeof snapshot>;
type Associations = z.infer<typeof associations>;
const MAPPING_MAX_BYTES = 256 * 1024;

export interface JUnitMappingChoices {
  scenarios: ReviewScenario[];
  tests: TestCase[];
  testedCommit: string;
  reportId: string;
}

function refused(): Error {
  return new Error(formatMessage(say("OSW-CHG-014")));
}

/** JUnit is data. No entities, report output, filesystem access or network. */
export function parseJUnit(xml: string): TestCase[] {
  if (Buffer.byteLength(xml, "utf8") > JUNIT_XML_MAX_BYTES) throw refused();
  const parser = new SaxesParser();
  const stack: string[] = [];
  const tests: TestCase[] = [];
  let current: (TestCase & { depth: number }) | undefined;
  parser.on("doctype", () => { throw refused(); });
  parser.on("error", () => { throw refused(); });
  parser.on("opentag", (tag) => {
    stack.push(tag.name);
    if (stack.length > 64 || (stack.length === 1 && !["testsuite", "testsuites"].includes(tag.name))) throw refused();
    if (tag.name === "testcase") {
      if (current || !stack.slice(0, -1).includes("testsuite") || tests.length >= 2000) throw refused();
      const parsed = identity.safeParse({ classname: tag.attributes.classname ?? "", name: tag.attributes.name });
      if (!parsed.success) throw refused();
      const notRun = ["notrun", "disabled", "skipped"].includes(String(tag.attributes.status ?? "").toLowerCase())
        || ["suppressed", "skipped"].includes(String(tag.attributes.result ?? "").toLowerCase());
      current = { ...parsed.data, state: notRun ? "skipped" : "passed", depth: stack.length };
    } else if (current && stack.length === current.depth + 1) {
      if (tag.name === "error") current.state = "error";
      else if (tag.name === "failure" && current.state !== "error") current.state = "failed";
      else if (tag.name === "skipped" && current.state === "passed") current.state = "skipped";
    }
  });
  parser.on("closetag", () => {
    if (current && stack.length === current.depth) {
      const { depth: _depth, ...test } = current;
      tests.push(test);
      current = undefined;
    }
    stack.pop();
  });
  try { parser.write(xml).close(); } catch { throw refused(); }
  return tests;
}

async function evidencePath(root: string, change: string, create = false): Promise<string> {
  assertValidChangeName(change);
  const common = await realpath((await openGit(root).raw(["rev-parse", "--path-format=absolute", "--git-common-dir"])).trim());
  const directory = path.join(common, "openspec-ui", "junit");
  if (create) await mkdir(directory, { recursive: true });
  const resolved = await realpath(directory).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (resolved !== undefined && path.relative(directory, resolved) !== "") throw refused();
  return path.join(directory, createHash("sha256").update(change).digest("hex") + ".json");
}

export async function importJUnit(root: string, change: string, input: unknown, displayedHead: string | undefined): Promise<void> {
  const parsed = request.safeParse(input);
  if (!parsed.success) throw refused();
  const value = parsed.data;
  const git = openGit(root);
  const currentHead = async () => (await git.raw(["rev-parse", "--verify", "HEAD"])).trim();
  if (value.head !== displayedHead || await currentHead() !== value.head) throw new Error(formatMessage(say("OSW-CHG-015")));
  const declared = (await git.raw(["rev-parse", "--verify", "--end-of-options", `${value.testedCommit}^{commit}`]).catch(() => "")).trim();
  if (declared !== value.testedCommit) throw new Error(formatMessage(say("OSW-CHG-016")));
  const data: Snapshot = { testedCommit: declared, importedAt: new Date().toISOString(), tests: parseJUnit(value.xml) };
  const file = await evidencePath(root, change, true);
  const temporary = file + "." + randomUUID();
  try {
    await writeFile(temporary, JSON.stringify(data), { flag: "wx", mode: 0o600 });
    if (await currentHead() !== value.head) throw new Error(formatMessage(say("OSW-CHG-015")));
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; });
  }
}

async function readJUnit(root: string, change: string): Promise<Snapshot | undefined> {
  const file = await evidencePath(root, change);
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (!info) return undefined;
  if (!info.isFile() || info.size > 1024 * 1024) throw refused();
  return snapshot.parse(JSON.parse(await readFile(file, "utf8")));
}

const scenarioKey = (one: ReviewScenario) => JSON.stringify([one.capability, one.requirement, one.scenario]);
const testKey = (one: { classname: string; name: string }) => JSON.stringify([one.classname, one.name]);
const snapshotId = (report: Snapshot) => createHash("sha256").update(JSON.stringify(report)).digest("hex");

function parseAssociations(mapping: string | undefined, scenarios: ReviewScenario[]): Associations {
  if (mapping === undefined) return { scenarios: [] };
  if (Buffer.byteLength(mapping, "utf8") > MAPPING_MAX_BYTES) throw refused();
  const data = associations.parse(JSON.parse(mapping));
  const known = new Set(scenarios.map(scenarioKey));
  for (const row of data.scenarios) {
    if (!known.delete(scenarioKey(row)) || new Set(row.tests.map(testKey)).size !== row.tests.length) throw refused();
  }
  return data;
}

export async function editJUnitMapping(root: string, change: string, head: string | undefined, input: unknown,
  choices: JUnitMappingChoices | undefined,
): Promise<{ preview: JUnitMappingPreview } | { saved: true }> {
  const edit = testMappingRequest.parse(input);
  const { selection } = edit;
  if (!choices || choices.reportId !== selection.reportId
      || !choices.scenarios.some((one) => scenarioKey(one) === scenarioKey(selection.scenario))
      || !choices.tests.some((one) => testKey(one) === testKey(selection.test))) {
    throw new Error("Choose a scenario and a unique testcase from the current JUnit report.");
  }
  return editMappingFile(root, change, head, edit, {
    filename: "scenario-tests.json",
    maxBytes: MAPPING_MAX_BYTES,
    append(previous) {
      let data: Associations;
      try { data = parseAssociations(previous, choices.scenarios); }
      catch { throw new Error("Resolve invalid or duplicate entries in scenario-tests.json before adding a test."); }
      const row = data.scenarios.find((one) => scenarioKey(one) === scenarioKey(selection.scenario));
      if (row?.tests.some((test) => testKey(test) === testKey(selection.test))) {
        throw new Error("This testcase is already linked to the selected scenario.");
      }
      if (row) row.tests.push(selection.test);
      else data.scenarios.push({ ...selection.scenario, tests: [selection.test] });
      const next = JSON.stringify(data, null, 2) + "\n";
      if (Buffer.byteLength(next, "utf8") > MAPPING_MAX_BYTES || !associations.safeParse(data).success) {
        throw new Error("The association exceeds the scenario-tests.json format limits.");
      }
      return next;
    },
    async verifyEvidence() {
      const current = await readJUnit(root, change);
      if (!current || snapshotId(current) !== selection.reportId) {
        throw new Error("The JUnit report moved. Open a fresh review before saving.");
      }
    },
  });
}

// Values are displayed as code, never as report-supplied Markdown or HTML.
function literal(text: string): string {
  const safe = text.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ");
  const fence = "`".repeat(Math.max(0, ...(safe.match(/`+/gu) ?? []).map((one) => one.length)) + 1);
  return `${fence} ${safe} ${fence}`;
}

export function junitScenarioSummary(scenarios: ReviewScenario[], mapping: string | undefined, report: Snapshot | undefined, head: string): string[] {
  if (scenarios.length === 0 && report === undefined && mapping === undefined) return [];
  const lines = ["", "### Scenario test results (JUnit)", ""];
  const rows = new Map<string, z.infer<typeof identity>[]>();
  if (mapping !== undefined) {
    try {
      for (const row of parseAssociations(mapping, scenarios).scenarios) rows.set(scenarioKey(row), row.tests);
    } catch {
      rows.clear();
      lines.push("- scenario-tests.json is invalid or names duplicate/unknown scenarios or tests.");
    }
  } else lines.push("- Commit scenario-tests.json beside the proposal to associate scenarios with exact JUnit tests.");
  if (!report) lines.push("- No JUnit report imported. Import one with an explicitly declared tested commit.");
  else {
    lines.push(`- User-declared tested commit: ${literal(report.testedCommit)}. Imported at ${literal(report.importedAt)}.`);
    lines.push(report.testedCommit === head ? "- The declared revision matches the reviewed commit; this attribution is not independently verified."
      : "- Historical report: the declared revision differs from the reviewed commit. These are not current passing results.");
  }
  if (scenarios.length === 0) lines.push("- No added or modified scenarios were found in the reviewed commit.");
  lines.push("- Test results are observations, not proof of scenario coverage; suite/job totals do not establish an individual test result.");
  for (const scenario of scenarios) {
    lines.push(`- ${literal(scenario.capability)} / ${literal(scenario.requirement)} / ${literal(scenario.scenario)}`);
    const tests = rows.get(scenarioKey(scenario)) ?? [];
    if (!tests.length) lines.push("  - No test linked.");
    for (const test of tests) {
      const matches = report?.tests.filter((one) => testKey(one) === testKey(test)) ?? [];
      const state = !report ? "no report" : matches.length === 0 ? "missing" : matches.length > 1 ? "ambiguous (duplicate test identity)" : matches[0]!.state;
      lines.push(`  - ${literal(test.classname)} / ${literal(test.name)}: ${report && report.testedCommit !== head ? "historical " : ""}${state}.`);
    }
  }
  return lines;
}

export async function readJUnitReview(root: string, change: string, head: string, scenarios: ReviewScenario[]):
Promise<{ lines: string[]; choices?: JUnitMappingChoices }> {
  const git = openGit(root);
  const mapping = await git.raw(["show", `${head}:openspec/changes/${change}/scenario-tests.json`]).catch(() => undefined);
  let report: Snapshot | undefined;
  try { report = await readJUnit(root, change); }
  catch { return { lines: [...junitScenarioSummary(scenarios, mapping, undefined, head), "- Saved JUnit evidence could not be read; import a new report."] }; }
  const lines = junitScenarioSummary(scenarios, mapping, report, head);
  if (!report || scenarios.length === 0) return { lines };
  const counts = new Map<string, number>();
  for (const test of report.tests) counts.set(testKey(test), (counts.get(testKey(test)) ?? 0) + 1);
  const tests = report.tests.filter((test) => counts.get(testKey(test)) === 1);
  if (tests.length === 0) return { lines: [...lines, "- No unique testcases are available to link from this report."] };
  return { lines, choices: { tests, testedCommit: report.testedCommit, reportId: snapshotId(report),
    scenarios: scenarios.map(({ capability, requirement, scenario }) => ({ capability, requirement, scenario })) } };
}
