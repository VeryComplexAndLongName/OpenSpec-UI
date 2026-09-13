import { describe, expect, it } from "vitest";
import { EnrolmentRefusedError, type AgentRosterEntry, type EnrolmentRequest } from "@openspec-ui/core";
import { enrolCommand } from "./enrol-command.js";

function collectingIo() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: (line: string) => out.push(line), stderr: (line: string) => err.push(line) };
}

const KEY_ID = "0123456789abcdef0123456789abcdef";

const REQUEST: EnrolmentRequest = {
  keyId: KEY_ID,
  publicKey: "MCowBQYDK2VwAyEA",
  label: "alpha",
  workingDirectory: "/wt/repo/alpha",
  machine: "ada-laptop",
  gitAuthor: "ada@example.com",
  seenAt: "2026-09-14T00:00:00.000Z",
};

const ENTRY: AgentRosterEntry = {
  keyId: KEY_ID,
  publicKey: "MCowBQYDK2VwAyEA",
  label: "Ada",
  gitAuthor: "ada@example.com",
  machine: "ada-laptop",
  confirmedAt: "2026-09-14T00:01:00.000Z",
};

describe("enrolCommand (a-run-is-signed-by-its-person 5.4)", () => {
  it("lists every key waiting to be enrolled, with what a person needs to decide", async () => {
    const io = collectingIo();

    const code = await enrolCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => ({ requests: [REQUEST], rosterDirectory: "/roster" }) },
    );

    expect(code).toBe(0);
    const text = io.out.join("\n");
    expect(text).toContain(KEY_ID);
    expect(text).toContain("alpha — /wt/repo/alpha, on ada-laptop, git author ada@example.com, last seen 2026-09-14T00:00:00.000Z");
    expect(text).toContain("openspec-ui-cli enrol <keyId>");
  });

  it("says nothing is waiting where nothing is", async () => {
    const io = collectingIo();

    const code = await enrolCommand(
      { workspaceRoot: "/repo", format: "text" },
      { ...io, read: async () => ({ requests: [], rosterDirectory: "/roster" }) },
    );

    expect(code).toBe(0);
    expect(io.out).toEqual(["No key is waiting to be enrolled."]);
  });

  it("confirms the key it names, with the label given", async () => {
    const io = collectingIo();
    const calls: unknown[] = [];

    const code = await enrolCommand(
      { workspaceRoot: "/repo", keyId: KEY_ID, label: "Ada", format: "text" },
      {
        ...io,
        confirm: async (root, keyId, options) => {
          calls.push([root, keyId, options]);
          return ENTRY;
        },
      },
    );

    expect(code).toBe(0);
    expect(calls).toEqual([["/repo", KEY_ID, { label: "Ada" }]]);
    expect(io.out.join("\n")).toContain("Enrolled 0123456789abcdef0123456789abcdef as Ada.");
  });

  it("exits 1 and says why when the confirmation is refused", async () => {
    const io = collectingIo();

    const code = await enrolCommand(
      { workspaceRoot: "/repo", keyId: KEY_ID, format: "text" },
      {
        ...io,
        confirm: async () => {
          throw new EnrolmentRefusedError(`${KEY_ID} is already enrolled with a different key`);
        },
      },
    );

    expect(code).toBe(1);
    expect(io.err.join("\n")).toContain("already enrolled with a different key");
  });

  it("exits 2 when the requests cannot be read", async () => {
    const io = collectingIo();

    const code = await enrolCommand(
      { workspaceRoot: "/repo", format: "text" },
      {
        ...io,
        read: async () => {
          throw new Error("not a git repository");
        },
      },
    );

    expect(code).toBe(2);
    expect(io.err.join("\n")).toContain("not a git repository");
  });
});
