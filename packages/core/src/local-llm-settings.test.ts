import { describe, expect, it } from "vitest";
import {
  chatCompletionsUrl,
  LOCAL_LLM_ACP_DEFAULT_EXECUTABLE,
  LOCAL_LLM_DEFAULT_BASE_URL,
  LOCAL_LLM_DEFAULT_MODEL,
  localLlmHeaders,
  resolveLocalLlmAcpSettings,
  resolveLocalLlmSettings,
} from "./local-llm-settings.js";

// the-local-llm-is-where-you-say: pure over values and a given environment.

const environment = {
  OPENSPEC_UI_LOCAL_LLM_BASE_URL: "http://gpu.lan:8000/v1",
  OPENSPEC_UI_LOCAL_LLM_MODEL: "from-environment",
  OPENSPEC_UI_LOCAL_LLM_API_KEY: "environment-key",
};

describe("resolveLocalLlmSettings", () => {
  it("takes what the host was told first", () => {
    expect(resolveLocalLlmSettings({ baseUrl: "http://host:1", model: "told", apiKey: "told-key" }, environment))
      .toEqual({ baseUrl: "http://host:1", model: "told", apiKey: "told-key" });
  });

  it("takes the environment for what the host was not told", () => {
    expect(resolveLocalLlmSettings({ model: "told" }, environment))
      .toEqual({ baseUrl: "http://gpu.lan:8000/v1", model: "told", apiKey: "environment-key" });
  });

  it("falls back to where the adapter always looked, with no key", () => {
    expect(resolveLocalLlmSettings({}, {})).toEqual({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL, model: LOCAL_LLM_DEFAULT_MODEL });
  });

  it("reads an empty value as none, so a cleared setting never sends an empty key", () => {
    expect(resolveLocalLlmSettings({ baseUrl: "  ", apiKey: "" }, { OPENSPEC_UI_LOCAL_LLM_API_KEY: " " }))
      .toEqual({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL, model: LOCAL_LLM_DEFAULT_MODEL });
  });
});

describe("chatCompletionsUrl", () => {
  it("accepts a base with its /v1 or without, and a trailing slash", () => {
    expect(chatCompletionsUrl("http://gpu.lan:8000/v1")).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:8000/v1/")).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:30000")).toBe("http://gpu.lan:30000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:30000/")).toBe("http://gpu.lan:30000/v1/chat/completions");
  });
});

describe("localLlmHeaders", () => {
  it("sends the key as a bearer token, and no authorization without one", () => {
    expect(localLlmHeaders({ apiKey: "k" })).toEqual({ "content-type": "application/json", authorization: "Bearer k" });
    expect(localLlmHeaders({})).toEqual({ "content-type": "application/json" });
  });
});

describe("resolveLocalLlmAcpSettings", () => {
  it("reuses base endpoint settings and defaults executable", () => {
    expect(resolveLocalLlmAcpSettings({ model: "qwen2.5-coder" }, {
      OPENSPEC_UI_LOCAL_LLM_BASE_URL: "http://gpu.lan:8000/v1",
    })).toEqual({
      baseUrl: "http://gpu.lan:8000/v1",
      model: "qwen2.5-coder",
      executable: LOCAL_LLM_ACP_DEFAULT_EXECUTABLE,
      limits: {},
    });
  });

  it("takes ACP limits from environment when host does not override", () => {
    expect(resolveLocalLlmAcpSettings({}, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "42",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_SHARE: "0.8",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOTAL_TOKENS: "120000",
    })).toEqual({
      baseUrl: LOCAL_LLM_DEFAULT_BASE_URL,
      model: LOCAL_LLM_DEFAULT_MODEL,
      executable: LOCAL_LLM_ACP_DEFAULT_EXECUTABLE,
      limits: {
        maxIterations: 42,
        maxContextShare: 0.8,
        maxTotalTokens: 120000,
      },
    });
  });

  it("host limit overrides win over environment for ACP limits", () => {
    expect(resolveLocalLlmAcpSettings({
      limits: { maxIterations: 7, maxSeconds: 60 },
    }, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "42",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_SECONDS: "600",
    })).toEqual({
      baseUrl: LOCAL_LLM_DEFAULT_BASE_URL,
      model: LOCAL_LLM_DEFAULT_MODEL,
      executable: LOCAL_LLM_ACP_DEFAULT_EXECUTABLE,
      limits: { maxIterations: 7, maxSeconds: 60 },
    });
  });

  it("drops invalid numeric ACP limits instead of guessing", () => {
    expect(resolveLocalLlmAcpSettings({}, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "zero",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_SHARE: "1.5",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOTAL_TOKENS: "-1",
    }).limits).toEqual({});
  });
});
