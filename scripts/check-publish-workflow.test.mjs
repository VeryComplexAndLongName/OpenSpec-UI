import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parse, stringify } from "yaml";
import { checkAll, checkOtherWorkflows, checkPublishWorkflow } from "./check-publish-workflow.mjs";

const GOOD = await readFile(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");

test("automatic OIDC workflow passes its independent policy", () => assert.deepEqual(checkPublishWorkflow(GOOD), []));

for (const [name, mutate, message] of [
  ["unexpected trigger", (w) => { w.on.push = {}; }, /only workflow_run/u],
  ["PR workflow source", (w) => { w.on.workflow_run.branches = ["feature"]; }, /completed main Quality/u],
  ["global OIDC", (w) => { w.permissions["id-token"] = "write"; }, /top-level/u],
  ["cancel ongoing publication", (w) => { w.concurrency["cancel-in-progress"] = true; }, /cancel/u],
  ["wrong environment", (w) => { w.jobs.npm.environment = "other"; }, /environment/u],
  ["no Marketplace identity", (w) => { delete w.jobs.marketplace.permissions["id-token"]; }, /scoped OIDC/u],
  ["no main guard", (w) => { w.jobs.npm.if = "true"; }, /guard/u],
  ["arbitrary checkout", (w) => { w.jobs.npm.steps[0].with.ref = "feature"; }, /checkout main/u],
  ["persisted checkout token", (w) => { w.jobs.npm.steps[0].with["persist-credentials"] = true; }, /checkout main/u],
  ["missing queue worker", (w) => { w.jobs.npm.steps.pop(); }, /Homepage queue/u],
  ["rebuild in publisher", (w) => { w.jobs.npm.steps.push({ run: "npm run build" }); }, /no build/u],
  ["PAT fallback", (w) => { w.jobs.marketplace.steps.push({ env: { VSCE_PAT: "secret" } }); }, /persistent/u],
  ["obsolete client", (w) => { w.env.VSCE_PUBLISH_VERSION = "3.9.2"; }, /OIDC-capable/u],
]) {
  test(`rejects ${name}`, () => {
    const workflow = parse(GOOD);
    mutate(workflow);
    assert.ok(checkPublishWorkflow(stringify(workflow)).some((problem) => message.test(problem)));
  });
}

test("other workflows cannot publish or read persistent credentials", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "publication-policy-"));
  try {
    await mkdir(path.join(root, ".github/workflows"), { recursive: true });
    await writeFile(path.join(root, ".github/workflows/unsafe.yml"), "jobs:\n  x:\n    run: npm publish\n    env: VSCE_PAT\n");
    assert.equal((await checkOtherWorkflows(root)).length, 1);
    assert.ok((await checkAll(root)).some((problem) => problem.includes("missing")));
  } finally { await rm(root, { recursive: true }); }
});
