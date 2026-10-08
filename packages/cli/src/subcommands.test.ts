import { describe, expect, it } from "vitest";
import { runMain } from "./main.js";
import { isVocabularyPair, publicNameOf, routeSubcommand, SUBCOMMANDS } from "./subcommands.js";

// every-action-is-a-verb-and-a-noun (ADR 0045).
describe("the CLI's subcommands are a verb and a noun", () => {
  it("names every subcommand with a verb and a noun from the product's lists", () => {
    expect(SUBCOMMANDS.filter((entry) => !isVocabularyPair(entry.verb, entry.noun)).map((entry) => `${entry.verb} ${entry.noun}`)).toEqual([]);
  });

  it("names each subcommand once", () => {
    const names = SUBCOMMANDS.map((entry) => `${entry.verb} ${entry.noun}`);
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([]);
  });

  it("carries a pair and what follows it to its handler", () => {
    expect(routeSubcommand(["answer", "question", "demo", "Q-1", "yes"])).toEqual({ kind: "handler", positionals: ["answer", "demo", "Q-1", "yes"] });
    expect(routeSubcommand(["complete", "task", "demo", "6.4"])).toEqual({ kind: "handler", positionals: ["task", "done", "demo", "6.4"] });
    expect(routeSubcommand(["remove", "lease"])).toEqual({ kind: "handler", positionals: ["lease", "release"] });
  });

  it("names a handler by the pair a person types", () => {
    expect(publicNameOf("send-back")).toBe("reopen change");
    expect(publicNameOf("task", "commit")).toBe("commit tasks");
    expect(publicNameOf("worktree", "add")).toBe("create worktree");
  });

  it("refuses a subcommand by its former name, naming the pair that replaced it, and runs nothing", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const code = await runMain(["doctor", "--cwd", "/repo"], { stdout: (line) => out.push(line), stderr: (line) => err.push(line) });

    expect(code).toBe(2);
    expect(err).toEqual(["error OSW-CLI-001: 'doctor' was renamed: use 'openspec-ui-cli diagnose workspace' (ADR 0045)"]);
    expect(out).toEqual([]);
  });

  it("refuses the former form of a verb that is also a new one", () => {
    expect(routeSubcommand(["run", "demo"])).toEqual({ kind: "renamed", former: "run", replacement: "run change" });
    expect(routeSubcommand(["answer", "demo", "Q-1", "yes"])).toEqual({ kind: "renamed", former: "answer", replacement: "show questions, or answer question" });
  });
});
