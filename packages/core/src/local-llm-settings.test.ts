import { describe, expect, it, vi } from "vitest";
import {
  chatCompletionsUrl,
  describeLocalLlmModel,
  LOCAL_LLM_DEFAULT_BASE_URL,
  localLlmHeaders,
  modelsUrl,
  resolveLocalLlmAcpSettings,
  resolveLocalLlmModel,
  resolveLocalLlmSettings,
  switchFromEnvironment,
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

  it("falls back to where the adapter always looked, with no key and no model", () => {
    // The model is found when a run starts (local-llm-codes-in-process).
    expect(resolveLocalLlmSettings({}, {})).toEqual({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL });
  });

  it("reads an empty value as none, so a cleared setting never sends an empty key", () => {
    expect(resolveLocalLlmSettings({ baseUrl: "  ", apiKey: "" }, { OPENSPEC_UI_LOCAL_LLM_API_KEY: " " }))
      .toEqual({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL });
  });
});

describe("chatCompletionsUrl and modelsUrl", () => {
  it("accept a base with its /v1 or without, and a trailing slash", () => {
    expect(chatCompletionsUrl("http://gpu.lan:8000/v1")).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:8000/v1/")).toBe("http://gpu.lan:8000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:30000")).toBe("http://gpu.lan:30000/v1/chat/completions");
    expect(chatCompletionsUrl("http://gpu.lan:30000/")).toBe("http://gpu.lan:30000/v1/chat/completions");
    expect(modelsUrl("http://gpu.lan:8000/v1/")).toBe("http://gpu.lan:8000/v1/models");
    expect(modelsUrl("http://gpu.lan:30000")).toBe("http://gpu.lan:30000/v1/models");
  });
});

describe("localLlmHeaders", () => {
  it("sends the key as a bearer token, and no authorization without one", () => {
    expect(localLlmHeaders({ apiKey: "k" })).toEqual({ "content-type": "application/json", authorization: "Bearer k" });
    expect(localLlmHeaders({})).toEqual({ "content-type": "application/json" });
  });
});

describe("resolveLocalLlmAcpSettings", () => {
  it("reuses the endpoint settings", () => {
    expect(resolveLocalLlmAcpSettings({ model: "qwen2.5-coder" }, {
      OPENSPEC_UI_LOCAL_LLM_BASE_URL: "http://gpu.lan:8000/v1",
    })).toEqual({ baseUrl: "http://gpu.lan:8000/v1", model: "qwen2.5-coder", limits: {} });
  });

  it("takes ACP limits from environment when host does not override", () => {
    expect(resolveLocalLlmAcpSettings({}, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "42",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_SHARE: "0.8",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOTAL_TOKENS: "120000",
    })).toEqual({
      baseUrl: LOCAL_LLM_DEFAULT_BASE_URL,
      limits: { maxIterations: 42, maxContextShare: 0.8, maxTotalTokens: 120000 },
    });
  });

  it("host limit overrides win over environment for ACP limits", () => {
    expect(resolveLocalLlmAcpSettings({
      limits: { maxIterations: 7, maxSeconds: 60 },
    }, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "42",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_SECONDS: "600",
    })).toEqual({ baseUrl: LOCAL_LLM_DEFAULT_BASE_URL, limits: { maxIterations: 7, maxSeconds: 60 } });
  });

  it("drops invalid numeric ACP limits instead of guessing", () => {
    expect(resolveLocalLlmAcpSettings({}, {
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_ITERATIONS: "zero",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_CONTEXT_SHARE: "1.5",
      OPENSPEC_UI_LOCAL_LLM_ACP_MAX_TOTAL_TOKENS: "-1",
    }).limits).toEqual({});
  });
});

// local-llm-codes-in-process 3.3: the stage, then the settings, then the
// server, then `default`.
describe("resolveLocalLlmModel", () => {
  const served = (ids: string[]) => vi.fn(async () => new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }), { status: 200 }));

  it("takes the stage's model first", async () => {
    const fetchImpl = served(["from-server"]);
    expect(await resolveLocalLlmModel("from-stage", { baseUrl: "http://a:1", model: "from-settings" }, fetchImpl))
      .toEqual({ model: "from-stage", source: "stage" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("takes the settings' model when the stage names none", async () => {
    expect(await resolveLocalLlmModel(undefined, { baseUrl: "http://a:2", model: "from-settings" }, served(["x"])))
      .toEqual({ model: "from-settings", source: "settings" });
  });

  it("asks the server when nothing names one, with the key, and takes the first it serves", async () => {
    const fetchImpl = served(["QuantTrio/Qwen3.6-35B-A3B-AWQ", "other"]);
    expect(await resolveLocalLlmModel(undefined, { baseUrl: "http://a:3/v1", apiKey: "k" }, fetchImpl))
      .toEqual({ model: "QuantTrio/Qwen3.6-35B-A3B-AWQ", source: "server" });
    expect(fetchImpl).toHaveBeenCalledWith("http://a:3/v1/models", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer k" }),
    }));
  });

  it("asks the same server once", async () => {
    const fetchImpl = served(["m"]);
    await resolveLocalLlmModel(undefined, { baseUrl: "http://a:4" }, fetchImpl);
    await resolveLocalLlmModel(undefined, { baseUrl: "http://a:4" }, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to default when the server cannot be asked, and asks again next time", async () => {
    const failing = vi.fn(async () => { throw new Error("ECONNREFUSED"); });
    expect(await resolveLocalLlmModel(undefined, { baseUrl: "http://a:5" }, failing)).toEqual({ model: "default", source: "default" });
    await resolveLocalLlmModel(undefined, { baseUrl: "http://a:5" }, failing);
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("says which model and why", () => {
    expect(describeLocalLlmModel({ model: "m", source: "server" })).toBe("Model m (the model the server serves).");
  });
});

describe("switchFromEnvironment", () => {
  it("reads 1, true, yes and on as on, anything else as off", () => {
    for (const on of ["1", "true", "YES", " on "]) expect(switchFromEnvironment(on)).toBe(true);
    for (const off of [undefined, "", "0", "false", "no"]) expect(switchFromEnvironment(off)).toBe(false);
  });
});
