import { describe, expect, it } from "vitest";
import { readGitHubChecks } from "./github-checks.js";

const headCommit = "a".repeat(40);
const target = { headCommit, baseBranch: "release/next" };
const link = "https://github.com/owner/repo/actions/runs/12";

describe("GitHub checks for the published PR head", () => {
  it("preserves reported states and distinguishes absent and wrong-source requirements", async () => {
    const replies = new Map([
      [`/commits/${headCommit}/check-runs?per_page=100`, {
        total_count: 2, check_runs: [
          { name: "build", status: "completed", conclusion: "success", details_url: link, app: { id: 42 } },
          { name: "lint", status: "in_progress", details_url: "https://outside.invalid/" },
        ],
      }],
      [`/commits/${headCommit}/status?per_page=100`, {
        total_count: 1, statuses: [{ context: "review", state: "pending" }],
      }],
      ["/rules/branches/release%2Fnext?per_page=100", [{ type: "required_status_checks", parameters: {
        required_status_checks: [
          { context: "build", integration_id: 42 },
          { context: "review", integration_id: 17 },
          { context: "package" },
        ],
      } }]],
      ["/branches/release%2Fnext", { protection: { enabled: true, required_status_checks: { contexts: ["lint"] } } }],
    ] as Array<[string, unknown]>);

    const report = await readGitHubChecks(async (request) => {
      if (!replies.has(request)) throw new Error(`Unexpected request: ${request}`);
      return replies.get(request);
    }, target);
    expect(report).toEqual({
      kind: "checks", head: headCommit, resultsComplete: true, rulesComplete: true,
      checks: [
        { name: "build", state: "success", link, app: 42 },
        { name: "lint", state: "in_progress" },
        { name: "review", state: "pending" },
      ],
      expected: [
        { name: "build", app: 42, state: "Reported" },
        { name: "review", app: 17, state: "Source unconfirmed" },
        { name: "package", state: "No result on this commit" },
        { name: "lint", state: "Reported" },
      ],
    });
  });

  it("does not treat denied rules or truncated/denied results as empty", async () => {
    const report = await readGitHubChecks(async (request) => {
      if (request.includes("/check-runs")) return { total_count: 120, check_runs: [] };
      if (request.startsWith("/branches/")) return { protection: {
        enabled: true, required_status_checks: { checks: [{ context: "required", app_id: 42 }] },
      } };
      throw new Error("Forbidden");
    }, target);
    expect(report).toMatchObject({
      resultsComplete: false, rulesComplete: false,
      expected: [{ name: "required", app: 42, state: "Result unknown" }],
    });
  });
});
