import { describe, expect, it } from "vitest";
import { toolCallsInText } from "./text-tool-calls.js";

// local-llm-codes-in-process 2.1.
const known = new Map<string, Record<string, string>>([
  ["read_file", { path: "string" }],
  ["write_file", { path: "string", content: "string" }],
  ["git_add", { paths: "array" }],
]);

describe("toolCallsInText", () => {
  it("takes a Qwen3-Coder call, as Qwen3.6 writes it through SGLang's hermes parser", () => {
    const { calls, text } = toolCallsInText(
      "Let me look first.\n\n<tool_call>\n<function=read_file>\n<parameter=path>\nsrc/greet.js\n</parameter>\n</function>\n</tool_call>",
      known,
    );
    expect(calls).toEqual([{ id: "text-call-1", name: "read_file", arguments: { path: "src/greet.js" } }]);
    expect(text).toBe("Let me look first.");
  });

  it("takes a Hermes call, reading an array where the tool declares one", () => {
    const { calls, text } = toolCallsInText('<tool_call>\n{"name": "git_add", "arguments": {"paths": ["a.txt"]}}\n</tool_call>', known);
    expect(calls).toEqual([{ id: "text-call-1", name: "git_add", arguments: { paths: ["a.txt"] } }]);
    expect(text).toBe("");
  });

  it("keeps JSON-looking file content as the text to write", () => {
    const { calls } = toolCallsInText(
      "<tool_call>\n<function=write_file>\n<parameter=path>\na.json\n</parameter>\n<parameter=content>\n{\"a\": 1}\n</parameter>\n</function>\n</tool_call>",
      known,
    );
    expect(calls[0]?.arguments).toEqual({ path: "a.json", content: '{"a": 1}' });
  });

  it("leaves a call to a tool that was not offered as text", () => {
    const content = "<tool_call>\n<function=format_disk>\n</function>\n</tool_call>";
    expect(toolCallsInText(content, known)).toEqual({ calls: [], text: content });
  });

  it("numbers several calls in order", () => {
    const one = "<tool_call><function=read_file><parameter=path>a</parameter></function></tool_call>";
    const two = "<tool_call><function=read_file><parameter=path>b</parameter></function></tool_call>";
    expect(toolCallsInText(`${one}${two}`, known).calls.map((call) => [call.id, call.arguments.path])).toEqual([
      ["text-call-1", "a"],
      ["text-call-2", "b"],
    ]);
  });
});
