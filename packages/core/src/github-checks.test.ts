import { describe, expect, it } from "vitest";
import { failureDetails, readGitHubChecks } from "./github-checks.js";

const headCommit = "a".repeat(40);
const target = { headCommit, baseBranch: "release/next" };
const link = "https://github.com/owner/repo/actions/runs/12";

describe("GitHub checks for the published PR head", () => {
  it("reads annotations only on explicit request and preserves the exact failed run source", async () => {
    const calls: string[] = [];
    const get = async (request: string): Promise<unknown> => {
      calls.push(request);
      if (request.includes("/check-runs?")) return { total_count: 1, check_runs: [{ id: 7, name: "tests", status: "completed", conclusion: "failure", output: { annotations_count: 1 } }] };
      if (request.includes("/status?")) return { total_count: 1, statuses: [{ context: "tests", state: "failure", description: "separate status observation" }] };
      if (request.includes("/annotations?")) return [{ annotation_level: "failure", path: "src/tests.ts", start_line: 42, message: "AssertionError: expected a to equal b" }];
      return [];
    };
    const ordinary = await readGitHubChecks(get, target);
    expect(calls.some((call) => call.includes("/annotations"))).toBe(false);
    expect(ordinary.kind === "checks" && ordinary.checks[0]?.failureDetails).toBeUndefined();
    calls.length = 0;
    const report = await readGitHubChecks(get, target, { failureDetails: true });
    expect(calls.filter((call) => call.includes("/annotations"))).toEqual(["/check-runs/7/annotations?per_page=10&page=1"]);
    expect(report).toMatchObject({ checks: [
      { failureDetails: { messages: ["src/tests.ts:42: AssertionError: expected a to equal b"], partial: false } },
      { failureDetails: { messages: ["separate status observation"], partial: true } },
    ] });
  });

  it("bounds requested annotations and retains unavailable detail without losing failures", async () => {
    const calls: string[] = [];
    const report = await readGitHubChecks(async (request) => {
      calls.push(request);
      if (request.includes("/check-runs?")) return { total_count: 6, check_runs: Array.from({ length: 6 }, (_, id) => ({ id: id + 1, name: `check-${id}`, status: "completed", conclusion: "failure" })) };
      if (request.includes("/status?")) return { total_count: 0, statuses: [] };
      if (request.includes("/annotations?")) throw Error("Forbidden");
      return [];
    }, target, { failureDetails: true });
    expect(calls.filter((call) => call.includes("/annotations?"))).toHaveLength(5);
    expect(report.kind === "checks" && report.checks).toHaveLength(6);
    if (report.kind === "checks") expect(report.checks.every((check) => check.failureDetails?.partial && !check.failureDetails.messages.length)).toBe(true);
    expect(failureDetails(["a\nb", "x".repeat(2000), ...Array(12).fill("extra")])).toMatchObject({ partial: true });
    expect(failureDetails(["a\nb"]).messages).toEqual(["a b"]);
    expect(failureDetails(["x".repeat(2000)]).messages[0]).toHaveLength(1500);
    expect(failureDetails(Array(12).fill("extra")).messages).toHaveLength(10);
  });

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
