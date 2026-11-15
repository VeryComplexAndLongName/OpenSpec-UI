import { createHash } from "node:crypto";
import { lstat, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { assertValidChangeName } from "./change-name.js";
import { openGit } from "./git-client.js";
import { appendScenarioCheck, type ReviewScenario } from "./scenario-evidence.js";

const sha = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const label = z.string().trim().min(1).max(400);
const selectionSchema = z.strictObject({
  head: z.string().regex(sha),
  scenario: z.strictObject({ capability: label, requirement: label, scenario: label }),
  check: label,
});
const requestSchema = z.discriminatedUnion("mode", [
  z.strictObject({ mode: z.literal("preview"), selection: selectionSchema }),
  z.strictObject({ mode: z.literal("save"), selection: selectionSchema, revision: z.string().regex(/^[a-f0-9]{64}$/u) }),
]);

export type ScenarioMappingSelection = z.infer<typeof selectionSchema>;
export type ScenarioMappingRequest = z.infer<typeof requestSchema>;
export interface ScenarioMappingPreview {
  selection: ScenarioMappingSelection;
  revision: string;
  diff: string;
}

export interface ScenarioMappingChoices {
  scenarios: ReviewScenario[];
  checks: string[];
}

function renderedDiff(previous: string | undefined, proposed: string): string {
  const lines = (text: string) => text.replace(/\r?\n$/u, "").split(/\r?\n/u);
  const old = previous === undefined ? [] : lines(previous);
  const next = lines(proposed);
  return [
    `--- ${previous === undefined ? "/dev/null" : "a/scenario-checks.json"}`,
    "+++ b/scenario-checks.json",
    `@@ -${old.length ? 1 : 0},${old.length} +1,${next.length} @@`,
    ...old.map((line) => "-" + line), ...next.map((line) => "+" + line),
  ].join("\n");
}

async function readMapping(file: string): Promise<string | undefined> {
  const info = await lstat(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (info === undefined) return undefined;
  if (!info.isFile() || info.size > 2 * 1024 * 1024) throw new Error("scenario-checks.json is not a regular mapping file within the size limit.");
  return readFile(file, "utf8");
}

export async function editScenarioMapping(
  root: string, change: string, input: unknown, head: string | undefined, options: ScenarioMappingChoices | undefined,
): Promise<{ preview: ScenarioMappingPreview } | { saved: true }> {
  assertValidChangeName(change);
  const request = requestSchema.parse(input);
  const { selection } = request;
  const git = openGit(root);
  const currentHead = async () => (await git.raw(["rev-parse", "--verify", "HEAD"])).trim();
  if (head !== selection.head || await currentHead() !== head || !options?.checks.includes(selection.check)) {
    throw new Error("Refresh PR checks on the matching commit and select a check that was reported there.");
  }
  const directory = path.join(await realpath(root), "openspec", "changes", change);
  if (path.relative(directory, await realpath(directory)) !== "") throw new Error("The change directory must be inside its working directory.");
  const file = path.join(directory, "scenario-checks.json");
  const previous = await readMapping(file);
  const next = appendScenarioCheck(previous, options.scenarios, selection.scenario, selection.check);
  const revision = createHash("sha256").update(JSON.stringify([selection, previous, next])).digest("hex");
  if (request.mode === "preview") return { preview: { selection, revision, diff: renderedDiff(previous, next) } };
  if (request.revision !== revision) throw new Error("The scenario mapping changed. Review a fresh preview before saving.");

  const staged = file + ".openspec-ui.new";
  const handle = await open(staged, "wx");
  let saved = false;
  try {
    try {
      await handle.writeFile(next, "utf8");
    } finally {
      await handle.close();
    }
    if (await readMapping(file) !== previous || await currentHead() !== head) {
      throw new Error("The change or mapping moved after the preview. Review a fresh preview before saving.");
    }
    await rename(staged, file);
    saved = true;
    return { saved: true };
  } finally {
    if (!saved) await unlink(staged).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
