import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkAll, checkOtherWorkflows, checkPublishWorkflow } from "./check-publish-workflow.mjs";

// A lint that passes whatever it is given has checked nothing, so each
// guarantee is broken once here and the failure is asserted by its words.
// See a-check-that-passes-checked-something.

const GOOD = [
  "name: Publish",
  "",
  "on:",
  "  workflow_dispatch:",
  "    inputs:",
  "      vscode_version:",
  "        required: false",
  "      cli_version:",
  "        required: false",
  "      confirm:",
  "        required: true",
  "",
  "jobs:",
  "  confirm:",
  "    steps:",
  "      - name: Refuse a run that was not confirmed",
  "        run: |",
  '          if [ "${CONFIRM}" != "publish" ]; then exit 1; fi',
  "  marketplace:",
  "    needs: confirm",
  "    environment: marketplace",
  "    steps:",
  "      - name: Take the VSIX from the release",
  "        run: gh release download \"${TAG}\" --pattern '*.vsix' --dir publish",
  "      - name: Publish it",
  "        env:",
  "          VSCE_PAT: ${{ secrets.VSCE_PAT }}",
  "        run: npx vsce publish --packagePath \"${VSIX}\"",
  "  npm:",
  "    needs: confirm",
  "    environment: npm",
  "    permissions:",
  "      contents: read",
  "      id-token: write",
  "    steps:",
  '      - run: if [ "${GITHUB_REF}" != "refs/heads/main" ]; then exit 1; fi',
  "      - name: Refuse a version that is not the one this commit carries",
  "        run: |",
  "          HAVE=$(node -p \"require('./packages/cli/package.json').version\")",
  '          if npm view "@openspec-ui/cli@${VERSION}" version; then exit 1; fi',
  "      - name: Publish it",
  "        working-directory: packages/cli",
  "        run: npm publish --access public",
].join("\n");

function without(line) {
  return GOOD.split("\n").filter((one) => one !== line).join("\n");
}

test("the workflow as written passes", () => {
  assert.deepEqual(checkPublishWorkflow(GOOD), []);
});

test("a second trigger fails, naming it", () => {
  const withPush = GOOD.replace("on:\n  workflow_dispatch:", "on:\n  push:\n    branches: [main]\n  workflow_dispatch:");
  const problems = checkPublishWorkflow(withPush);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /runs on "push"/u);
});

test("a trigger written inline fails too, since a one-line on: is still a trigger", () => {
  const inline = GOOD.replace("on:\n  workflow_dispatch:\n    inputs:", "on: [push, workflow_dispatch]\n  inputs:");
  assert.ok(checkPublishWorkflow(inline).some((problem) => /runs on/u.test(problem)));
});

test("a trigger named only in a comment passes, because a comment is not a trigger", () => {
  const commented = `# on: push is what this deliberately does not do\n${GOOD}`;
  assert.deepEqual(checkPublishWorkflow(commented), []);
});

test("a missing confirmation input fails", () => {
  const problems = checkPublishWorkflow(without("      confirm:"));
  assert.ok(problems.some((problem) => /"confirm" input/u.test(problem)));
});

test("a confirmation nothing compares against fails", () => {
  const unchecked = GOOD.replace('          if [ "${CONFIRM}" != "publish" ]; then exit 1; fi', "          echo confirmed");
  assert.ok(checkPublishWorkflow(unchecked).some((problem) => /refuses a run/u.test(problem)));
});

test("a publish without --packagePath fails", () => {
  const rebuilt = GOOD.replace('        run: npx vsce publish --packagePath "${VSIX}"', "        run: npx vsce publish");
  assert.ok(checkPublishWorkflow(rebuilt).some((problem) => /--packagePath/u.test(problem)));
});

test("building a package of its own fails", () => {
  const rebuilt = GOOD.replace("      - name: Publish it", "      - run: npm run package --workspace openspec-ui-vscode\n      - name: Publish it");
  assert.ok(checkPublishWorkflow(rebuilt).some((problem) => /builds a package of its own/u.test(problem)));
});

test("a missing vscode_version or cli_version input fails", () => {
  assert.ok(checkPublishWorkflow(without("      vscode_version:")).some((problem) => /"vscode_version" input/u.test(problem)));
  assert.ok(checkPublishWorkflow(without("      cli_version:")).some((problem) => /"cli_version" input/u.test(problem)));
});

test("a publishing job that does not wait for the confirmation fails", () => {
  const unwaiting = GOOD.replace("  npm:\n    needs: confirm", "  npm:");
  assert.ok(checkPublishWorkflow(unwaiting).some((problem) => /does not need the "confirm" job/u.test(problem)));
});

test("an npm job outside the npm environment fails", () => {
  const elsewhere = GOOD.replace("    environment: npm", "    environment: marketplace");
  assert.ok(checkPublishWorkflow(elsewhere).some((problem) => /"npm" environment/u.test(problem)));
});

test("an npm job without id-token fails, and one granted twice fails too", () => {
  assert.ok(checkPublishWorkflow(without("      id-token: write")).some((problem) => /asks for no id-token/u.test(problem)));
  const twice = GOOD.replace("    needs: confirm\n    environment: marketplace", "    needs: confirm\n    environment: marketplace\n    permissions:\n      id-token: write");
  assert.ok(checkPublishWorkflow(twice).some((problem) => /granted more than once/u.test(problem)));
});

test("an npm token anywhere in the workflow fails", () => {
  const tokened = GOOD.replace("        run: npm publish --access public", "        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm publish --access public");
  assert.ok(checkPublishWorkflow(tokened).some((problem) => /names an npm token/u.test(problem)));
});

test("an npm job that does not refuse other refs, or check the version, fails", () => {
  const anyRef = GOOD.replace('"refs/heads/main"', '"refs/heads/other"');
  assert.ok(checkPublishWorkflow(anyRef).some((problem) => /ref other than main/u.test(problem)));
  const unchecked = GOOD.replace('          if npm view "@openspec-ui/cli@${VERSION}" version; then exit 1; fi', "          echo ok");
  assert.ok(checkPublishWorkflow(unchecked).some((problem) => /check the named version/u.test(problem)));
});

test("a second workflow publishing to npm or naming an npm token fails, naming the file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-publish-check-"));
  try {
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await writeFile(path.join(root, ".github", "workflows", "publish.yml"), GOOD, "utf8");
    await writeFile(
      path.join(root, ".github", "workflows", "quality.yml"),
      ["name: Quality", "jobs:", "  release:", "    steps:", "      - run: npm publish", "        env:", "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}"].join("\n"),
      "utf8",
    );

    const problems = await checkOtherWorkflows(root);

    assert.equal(problems.length, 2);
    assert.ok(problems.every((problem) => problem.startsWith(".github/workflows/quality.yml")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a second workflow naming the token fails, naming the file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-publish-check-"));
  try {
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await writeFile(path.join(root, ".github", "workflows", "publish.yml"), GOOD, "utf8");
    await writeFile(
      path.join(root, ".github", "workflows", "quality.yml"),
      ["name: Quality", "jobs:", "  release:", "    steps:", "      - run: npx vsce publish", "        env:", "          VSCE_PAT: ${{ secrets.VSCE_PAT }}"].join("\n"),
      "utf8",
    );

    const problems = await checkOtherWorkflows(root);

    assert.equal(problems.length, 2);
    assert.ok(problems.every((problem) => problem.startsWith(".github/workflows/quality.yml")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a missing workflow fails rather than passing quietly", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-publish-check-"));
  try {
    const problems = await checkAll(root);
    assert.ok(problems.some((problem) => /is missing/u.test(problem)));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("this repository's own workflows pass", async () => {
  assert.deepEqual(await checkAll(), []);
});

// the-homepage-hears-about-an-article: the other credential this
// repository holds is named by one workflow too.
test("fails a workflow other than the dispatch one that names the homepage token", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-workflows-"));
  try {
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await writeFile(path.join(root, ".github", "workflows", "publish.yml"), GOOD, "utf8");
    await writeFile(
      path.join(root, ".github", "workflows", "quality.yml"),
      ["name: Quality", "jobs:", "  build:", "    env:", "      GH_TOKEN: ${{ secrets.HOMEPAGE_DISPATCH_TOKEN }}"].join("\n"),
      "utf8",
    );

    const problems = await checkOtherWorkflows(root);

    assert.equal(problems.length, 1);
    assert.match(problems[0], /names HOMEPAGE_DISPATCH_TOKEN/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("allows the dispatch workflow itself to name the homepage token", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "openspec-workflows-"));
  try {
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await writeFile(path.join(root, ".github", "workflows", "publish.yml"), GOOD, "utf8");
    await writeFile(
      path.join(root, ".github", "workflows", "homepage-dispatch.yml"),
      ["name: Tell the homepage", "jobs:", "  tell:", "    env:", "      GH_TOKEN: ${{ secrets.HOMEPAGE_DISPATCH_TOKEN }}"].join("\n"),
      "utf8",
    );

    assert.deepEqual(await checkOtherWorkflows(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
