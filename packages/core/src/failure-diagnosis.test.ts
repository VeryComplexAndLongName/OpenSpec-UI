import { describe, expect, it } from "vitest";
import { QUOTED_LINE_LIMIT, describeDiagnosis, diagnoseFailure, readFailureDiagnosis } from "./failure-diagnosis.js";

// the-supervisor-advises 2.1: each cause from the text it is matched on.
describe("diagnoseFailure", () => {
  it("reads the failure copilot-cli-acp gave on this machine as not signed in", () => {
    const diagnosis = diagnoseFailure({ agentId: "copilot-cli-acp", reason: "Authentication required" });
    expect(diagnosis).toMatchObject({
      cause: "not-signed-in",
      repeatHelps: "no",
      evidence: "Authentication required",
      commands: ["copilot"],
    });
    expect(diagnosis.remedy).toContain("`copilot`");
  });

  it("finds the cause in the output where the reason is only an exit code", () => {
    const diagnosis = diagnoseFailure({
      agentId: "claude-cli",
      reason: "claude exited with code 1",
      output: "starting\nInvalid API key · Please run /login\n",
    });
    expect(diagnosis.cause).toBe("not-signed-in");
    expect(diagnosis.evidence).toBe("Invalid API key · Please run /login");
  });

  it("reads a missing executable as not installed", () => {
    const diagnosis = diagnoseFailure({ agentId: "gemini-cli", reason: "spawn gemini ENOENT" });
    expect(diagnosis).toMatchObject({ cause: "agent-not-installed", repeatHelps: "no", commands: ["openspec-ui-cli diagnose workspace"] });
    expect(diagnosis.remedy).toContain("`gemini`");
  });

  it("reads Windows' own words for a missing command", () => {
    expect(diagnoseFailure({
      agentId: "codex-cli",
      reason: "codex exited with code 1",
      output: "'codex' is not recognized as an internal or external command,",
    }).cause).toBe("agent-not-installed");
  });

  it("reads a refused file as blocked by the machine", () => {
    expect(diagnoseFailure({
      agentId: "copilot-cli",
      reason: "copilot exited with code 1",
      output: "Error: EPERM: operation not permitted, open 'C:\\Users\\x\\AppData\\Local\\copilot\\runtime.node'",
    })).toMatchObject({ cause: "blocked-by-the-machine", repeatHelps: "no" });
  });

  it("reads an unreachable server as the network, and names the proxy switch", () => {
    const diagnosis = diagnoseFailure({ agentId: "local-llm-acp", reason: "fetch failed: connect ECONNREFUSED 192.168.137.33:8000" });
    expect(diagnosis).toMatchObject({ cause: "network-unreachable", repeatHelps: "no" });
    expect(diagnosis.remedy).toContain("OPENSPEC_UI_IGNORE_SYSTEM_PROXY");
  });

  it("reads a rate limit as passing by itself", () => {
    expect(diagnoseFailure({ agentId: "claude-cli", reason: "HTTP 429 Too Many Requests" }))
      .toMatchObject({ cause: "rate-limited", repeatHelps: "likely" });
  });

  it("reads a server error as passing by itself", () => {
    expect(diagnoseFailure({ agentId: "local-llm", reason: "local LLM answered 503 Service Unavailable" }))
      .toMatchObject({ cause: "server-error", repeatHelps: "likely" });
  });

  it("says nothing it has not seen", () => {
    expect(diagnoseFailure({ agentId: "copilot-cli-acp", reason: "ACP connection closed" }))
      .toEqual({ cause: "unknown", repeatHelps: "unknown" });
  });

  it("takes the earlier cause where two are present", () => {
    // A CLI that cannot sign in may also print the network error its
    // sign-in attempt met; the sign-in is what the person has to fix.
    const diagnosis = diagnoseFailure({
      agentId: "claude-cli",
      reason: "claude exited with code 1",
      output: "request failed: ECONNRESET\nNot logged in",
    });
    expect(diagnosis.cause).toBe("not-signed-in");
  });

  it("does not read a number as a status code without its context", () => {
    const diagnosis = diagnoseFailure({
      agentId: "claude-cli",
      reason: "claude exited with code 2",
      output: "4010 tests passed in 401 ms\nretrying after 500 ms",
    });
    expect(diagnosis.cause).toBe("unknown");
  });

  it("reads a status code in its context", () => {
    expect(diagnoseFailure({ agentId: "codex-cli", reason: "request failed with status code 401" }).cause).toBe("not-signed-in");
  });

  it("names the local LLM's key, not an executable, for a local agent that was refused", () => {
    const diagnosis = diagnoseFailure({ agentId: "local-llm", reason: "local LLM answered 401 Unauthorized" });
    expect(diagnosis.cause).toBe("not-signed-in");
    expect(diagnosis.remedy).toContain("OPENSPEC_UI_LOCAL_LLM_API_KEY");
    expect(diagnosis.commands).toBeUndefined();
  });

  it("quotes a long line cut to its limit", () => {
    const line = `Authentication required ${"x".repeat(400)}`;
    const evidence = diagnoseFailure({ agentId: "copilot-cli", reason: line }).evidence ?? "";
    expect(evidence.length).toBe(QUOTED_LINE_LIMIT);
    expect(evidence.startsWith("Authentication required")).toBe(true);
  });
});

describe("describeDiagnosis", () => {
  it("says the cause and whether repeating helps", () => {
    expect(describeDiagnosis({ cause: "not-signed-in", repeatHelps: "no" }))
      .toBe("the agent is not signed in: repeating will not help");
    expect(describeDiagnosis({ cause: "unknown", repeatHelps: "unknown" }))
      .toBe("the cause is not known: whether repeating helps is not known");
  });
});

describe("readFailureDiagnosis", () => {
  it("reads a diagnosis back, and nothing that is not one", () => {
    const diagnosis = diagnoseFailure({ agentId: "copilot-cli-acp", reason: "Authentication required" });
    expect(readFailureDiagnosis(JSON.parse(JSON.stringify(diagnosis)))).toEqual(diagnosis);
    expect(readFailureDiagnosis({ cause: "bad-luck", repeatHelps: "no" })).toBeUndefined();
    expect(readFailureDiagnosis("not-signed-in")).toBeUndefined();
  });
});
