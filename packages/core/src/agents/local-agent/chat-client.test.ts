import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { completeTurn } from "./chat-client.js";
import { TOOL_PARAMETER_TYPES, TOOL_SCHEMAS } from "./tools.js";

// local-llm-codes-in-process 2.4: against a local HTTP stand-in, answering
// as SGLang does.
let server: Server | undefined;
afterEach(async () => {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = undefined;
});

async function serve(answer: unknown): Promise<{ base: string; requests: unknown[] }> {
  const requests: unknown[] = [];
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    req.on("end", () => {
      requests.push({ url: req.url, auth: req.headers.authorization, body: JSON.parse(body) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(answer));
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { base: `http://127.0.0.1:${port}/v1`, requests };
}

const options = (base: string) => ({
  settings: { baseUrl: base, apiKey: "k" },
  model: "m",
  fetch: (input: string, init?: RequestInit) => fetch(input, init),
  tools: TOOL_SCHEMAS,
  parameterTypes: TOOL_PARAMETER_TYPES,
});

describe("completeTurn", () => {
  it("reads SGLang's null tool_calls and null usage as none", async () => {
    const { base, requests } = await serve({ choices: [{ message: { content: "Done.", tool_calls: null } }], usage: null });
    const turn = await completeTurn(options(base), [{ role: "user", content: "hi" }]);
    expect(turn).toEqual({ text: "Done.", calls: [], usage: {} });
    expect(requests[0]).toMatchObject({ url: "/v1/chat/completions", auth: "Bearer k", body: { model: "m", tool_choice: "auto" } });
  });

  it("reads structured calls, a null argument as no arguments", async () => {
    const { base } = await serve({
      choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "list_dir", arguments: null } }] } }],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    });
    const turn = await completeTurn(options(base), [{ role: "user", content: "hi" }]);
    expect(turn).toEqual({ text: "", calls: [{ id: "c1", name: "list_dir", arguments: {} }], usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 } });
  });

  it("reads a call written as text when there is no structured one", async () => {
    const { base } = await serve({
      choices: [{ message: { content: "<tool_call>\n<function=read_file>\n<parameter=path>\na.txt\n</parameter>\n</function>\n</tool_call>", tool_calls: null } }],
    });
    const turn = await completeTurn(options(base), [{ role: "user", content: "hi" }]);
    expect(turn.calls).toEqual([{ id: "text-call-1", name: "read_file", arguments: { path: "a.txt" } }]);
    expect(turn.text).toBe("");
  });
});
