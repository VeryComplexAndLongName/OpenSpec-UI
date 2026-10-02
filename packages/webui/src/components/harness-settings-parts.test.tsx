import { describe, expect, it } from "vitest";
import { acceptsModel } from "./harness-settings-parts.js";

// local-llm-codes-in-process 3.5: the Harness Settings views offer the model
// field to the local LLM agents, as to the CLIs that take `--model`.
describe("acceptsModel", () => {
  it("offers a model for both local LLM agents", () => {
    expect(acceptsModel("local-llm")).toBe(true);
    expect(acceptsModel("local-llm-acp")).toBe(true);
  });

  it("still offers one for a CLI with --model, and none for a CLI without", () => {
    expect(acceptsModel("claude-cli")).toBe(true);
    expect(acceptsModel("gemini-cli")).toBe(false);
  });
});
