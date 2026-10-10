import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AgentRunner } from "./agent-runner.js";
import { agentsByRunRoot, runRootOf } from "./run-root.js";

// a-change-runs-in-its-own-worktree: a run of a change in its own worktree
// is given that worktree's agents, whose sandbox is that worktree.

const workspace = path.resolve("/prog/HppMCP");
const container = path.resolve("/prog/.worktrees/HppMCP");

describe("runRootOf", () => {
  it("binds a run in the workspace to the workspace, and one in a worktree to that worktree", () => {
    expect(runRootOf(path.join(workspace, "packages"), workspace, container)).toBe(workspace);
    expect(runRootOf(path.join(container, "mcp-platform-foundation"), workspace, container)).toBe(path.join(container, "mcp-platform-foundation"));
    expect(runRootOf(path.join(container, "fresh", "openspec"), workspace, container)).toBe(path.join(container, "fresh"));
  });

  it("binds nothing outside both, nor the worktrees' container itself, nor before the container is read", () => {
    expect(runRootOf(path.resolve("/elsewhere/repo"), workspace, container)).toBeUndefined();
    expect(runRootOf(container, workspace, container)).toBeUndefined();
    expect(runRootOf(path.resolve("/prog/.worktrees/Other/fresh"), workspace, container)).toBeUndefined();
    expect(runRootOf(path.join(container, "fresh"), workspace, undefined)).toBeUndefined();
  });
});

describe("agentsByRunRoot", () => {
  it("gives a worktree its own agents, made once, and every other place the workspace's", () => {
    const own = new Map<string, AgentRunner>();
    const made: string[] = [];
    const runnersFor = vi.fn((root: string) => { made.push(root); return new Map<string, AgentRunner>(); });
    const agentsFor = agentsByRunRoot({ workspaceRoot: workspace, runners: own, container: () => container, runnersFor });

    const fresh = agentsFor(path.join(container, "fresh"));
    expect(agentsFor(path.join(container, "fresh", "src"))).toBe(fresh);
    expect(fresh).not.toBe(own);
    expect(made).toEqual([path.join(container, "fresh")]);

    expect(agentsFor(workspace)).toBe(own);
    expect(agentsFor(path.resolve("/elsewhere/repo"))).toBe(own);
    expect(agentsFor(undefined)).toBe(own);
  });
});
