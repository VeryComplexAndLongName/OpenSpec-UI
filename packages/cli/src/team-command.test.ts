import { describe, expect, it } from "vitest";
import { JoinRefusedError, type JoinResult, type PeopleReading } from "@openspec-ui/core";
import { joinCommand, peopleCommand } from "./team-command.js";

// a-team-works-through-git: the CLI's words for joining and for the people.

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, deps: { stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) } };
}

const JOINED: JoinResult = {
  file: "openspec/people/ada.json",
  person: { handle: "ada", name: "Ada", keys: [{ keyId: "a".repeat(32), publicKey: "x", addedAt: "2026-09-22" }] },
  outcome: "joined",
};

describe("join", () => {
  it("says what it wrote and that it goes in a pull request", async () => {
    const { out, deps } = capture();

    const code = await joinCommand({ workspaceRoot: "/repo", handle: "ada", name: "Ada", format: "text" }, { ...deps, join: async () => JOINED });

    expect(code).toBe(0);
    expect(out).toEqual([
      "Wrote openspec/people/ada.json for Ada, with this machine's key.",
      "Commit it in a pull request: once it merges, the team verifies what you sign.",
    ]);
  });

  it("exits 1 on a refusal and 2 on anything else", async () => {
    const refused = capture();
    expect(await joinCommand({ workspaceRoot: "/repo", handle: "ada", name: "Ada", format: "text" }, {
      ...refused.deps,
      join: async () => { throw new JoinRefusedError("this machine's key is already bob's"); },
    })).toBe(1);
    expect(refused.err).toEqual(["openspec-ui-cli: this machine's key is already bob's"]);

    const broken = capture();
    expect(await joinCommand({ workspaceRoot: "/repo", handle: "ada", name: "Ada", format: "text" }, {
      ...broken.deps,
      join: async () => { throw new Error("EACCES"); },
    })).toBe(2);
  });
});

describe("people", () => {
  it("lists each person with their keys, and exits 1 on a problem", async () => {
    const reading: PeopleReading = {
      people: [{ handle: "ada", name: "Ada", keys: [
        { keyId: "a".repeat(32), publicKey: "x", addedAt: "2026-09-01", retiredAt: "2026-09-20" },
        { keyId: "b".repeat(32), publicKey: "y", addedAt: "2026-09-20" },
      ] }],
      problems: [{ file: "openspec/people/bad.json", problem: "it is not valid JSON" }],
    };
    const { out, err, deps } = capture();

    const code = await peopleCommand({ workspaceRoot: "/repo", format: "text" }, { ...deps, read: async () => reading });

    expect(code).toBe(1);
    expect(out).toEqual(["ada  Ada  1 key, 1 retired"]);
    expect(err).toEqual(["openspec/people/bad.json: it is not valid JSON"]);
  });

  it("says how to join where nobody has", async () => {
    const { out, deps } = capture();

    expect(await peopleCommand({ workspaceRoot: "/repo", format: "text" }, { ...deps, read: async () => ({ people: [], problems: [] }) })).toBe(0);
    expect(out[0]).toContain("Nobody has joined yet");
  });
});
