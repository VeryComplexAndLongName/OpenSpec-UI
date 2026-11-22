#!/usr/bin/env node
// Publication policy: automatic Homepage leases, immutable artifacts, OIDC only.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLISH_WORKFLOW = ".github/workflows/publish.yml";

function executable(source) {
  return source.split(/\r?\n/u).filter((line) => !line.trim().startsWith("#")).join("\n");
}

export function checkPublishWorkflow(source) {
  const problems = [];
  let workflow;
  try { workflow = parse(source); } catch { return ["invalid workflow YAML"]; }
  const triggers = Object.keys(workflow.on ?? {});
  if (triggers.length !== 3 || !["workflow_run", "schedule", "workflow_dispatch"].every((one) => triggers.includes(one))) {
    problems.push("only workflow_run, schedule and workflow_dispatch may trigger publication");
  }
  if (JSON.stringify(workflow.on?.workflow_run) !== JSON.stringify({ workflows: ["Quality"], types: ["completed"], branches: ["main"] })) {
    problems.push("automatic publication must follow completed main Quality");
  }
  if (workflow.permissions?.["id-token"] || workflow.permissions?.contents !== "read") problems.push("top-level permissions must not grant publish identities or writes");
  if (workflow.concurrency?.["cancel-in-progress"] !== false) problems.push("publishing workers must not cancel one another");
  if (Object.keys(workflow.jobs ?? {}).sort().join(",") !== "marketplace,npm") problems.push("only the two registry workers may run");
  for (const channel of ["npm", "marketplace"]) {
    const job = workflow.jobs?.[channel] ?? {};
    if (job.environment !== channel) problems.push(`${channel}: environment must match its OIDC policy`);
    if (job.permissions?.["id-token"] !== "write" || job.permissions?.contents !== "read") problems.push(`${channel}: scoped OIDC and read-only contents are required`);
    if (job["runs-on"] !== "ubuntu-latest" || job["timeout-minutes"] > 10 || !job["timeout-minutes"]) problems.push(`${channel}: use a short GitHub-hosted job`);
    const guard = job.if ?? "";
    for (const condition of ["github.ref == 'refs/heads/main'", "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.event == 'push'", "github.event.workflow_run.head_repository.full_name == github.repository"]) {
      if (!guard.includes(condition)) problems.push(`${channel}: missing main/success/trusted repository guard`);
    }
    const checkout = job.steps?.find((step) => step.uses?.startsWith("actions/checkout@"));
    if (checkout?.with?.ref !== "main" || checkout?.with?.["persist-credentials"] !== false) problems.push(`${channel}: checkout main without persisted credentials`);
    if (!job.steps?.some((step) => step.run === `node scripts/publication-worker.mjs ${channel}`)) problems.push(`${channel}: must use the Homepage queue worker`);
    for (const step of job.steps ?? []) {
      if (step.run && /npm ci|npm run build|vsce package|npm run package|npm publish|vsce publish/u.test(step.run)) problems.push(`${channel}: no build or independent registry writes in the workflow`);
    }
  }
  if (workflow.env?.NPM_PUBLISH_VERSION !== "11.5.1" || workflow.env?.VSCE_PUBLISH_VERSION !== "4.0.2") problems.push("pin OIDC-capable registry clients");
  if (/VSCE_PAT|NPM_TOKEN|NODE_AUTH_TOKEN/u.test(executable(source))) problems.push("no persistent registry tokens are allowed");
  return problems;
}

export async function checkOtherWorkflows(root = repoRoot) {
  const problems = [];
  let entries;
  try { entries = await readdir(path.join(root, ".github/workflows")); } catch { return [".github/workflows is not readable"]; }
  for (const entry of entries) {
    const relative = `.github/workflows/${entry}`;
    if (!/\.ya?ml$/u.test(entry) || relative === PUBLISH_WORKFLOW) continue;
    const source = executable(await readFile(path.join(root, relative), "utf8"));
    if (/VSCE_PAT|NPM_TOKEN|NODE_AUTH_TOKEN|vsce publish|npm publish|changeset publish/u.test(source)) problems.push(`${relative}: registry writes and credentials belong only to the OIDC queue worker`);
    if (relative !== ".github/workflows/homepage-dispatch.yml" && source.includes("HOMEPAGE_DISPATCH_TOKEN")) problems.push(`${relative}: homepage dispatch token belongs only to homepage-dispatch.yml`);
  }
  return problems;
}

export async function checkAll(root = repoRoot) {
  let source;
  try { source = await readFile(path.join(root, PUBLISH_WORKFLOW), "utf8"); } catch { return [`${PUBLISH_WORKFLOW} is missing`]; }
  return [...checkPublishWorkflow(source), ...await checkOtherWorkflows(root)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await checkAll();
  if (problems.length) {
    console.error(`Publish workflow check failed:\n${problems.join("\n")}\nSee docs/adr/0058-homepage-publication-center.md`);
    process.exitCode = 1;
  } else console.log("Publish workflow check passed.");
}
