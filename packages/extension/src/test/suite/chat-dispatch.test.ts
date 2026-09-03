// Live integration coverage for the `vscode-chat` harness step-agent
// dispatch — see
// openspec/changes/dispatch-to-chat-integration-coverage/proposal.md.
//
// Drives the real webview -> extension routing through
// `ExtensionTestApi.deliverWebviewCommand`
// (`AiPanel.deliverWebviewCommandForTesting`), the exact same handler a
// real webview message reaches, and observes the resulting
// `"openspec-ui/event"` messages through
// `ExtensionTestApi.onWebviewEvent` (`AiPanel.onWebviewEventForTesting`)
// — the wire-level artifact a real webview would receive, not a hook
// into `AiPanel`'s internals. Neither `AiPanel` itself nor its private
// `dispatchToChat()` is reachable from this test.
//
// Asserts ADR 0016's `started` -> `handedOff` event contract (and that
// `completed` never appears) plus that `workbench.action.chat.open` was
// invoked with the built prompt. Deliberately does NOT assert anything
// about the chat window being visible or what it contains — that stays
// a human check, narrowed in `harness-stage-dispatch` task 6.6.

import * as assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import type { Command, Event } from "@openspec-ui/core";
import type { ExtensionTestApi } from "../../extension.js";
import { buildWorkbenchChatPrompt } from "../../workbench-chat-prompt.js";

function getExtension(): vscode.Extension<ExtensionTestApi> {
  const found = vscode.extensions.all.find((e) => e.packageJSON.name === "openspec-ui-vscode");
  assert.ok(found, "openspec-ui-vscode extension not found among loaded extensions");
  return found as vscode.Extension<ExtensionTestApi>;
}

/** Temporarily replaces `vscode.commands.executeCommand` so
 * `"workbench.action.chat.open"` calls are captured instead of actually
 * opening VS Code's chat UI, while every other command is forwarded to
 * the real implementation unchanged (needed because the test itself
 * also drives real commands, e.g. `openspec-ui.openAiPanel`). */
function stubChatOpenCommand(): { calls: unknown[]; restore: () => void } {
  const original = vscode.commands.executeCommand;
  const calls: unknown[] = [];
  const stub = (async (command: string, ...rest: unknown[]) => {
    if (command === "workbench.action.chat.open") {
      calls.push(rest[0]);
      return undefined;
    }
    return original.call(vscode.commands, command, ...rest);
  }) as typeof vscode.commands.executeCommand;
  (vscode.commands as { executeCommand: typeof vscode.commands.executeCommand }).executeCommand = stub;
  return {
    calls,
    restore: () => {
      (vscode.commands as { executeCommand: typeof vscode.commands.executeCommand }).executeCommand = original;
    },
  };
}

suite("openspec-ui-vscode — vscode-chat harness stage dispatch (webview -> extension routing)", () => {
  let api: ExtensionTestApi;
  let workspaceRoot: string;

  suiteSetup(async () => {
    const ext = getExtension();
    api = ext.isActive ? ext.exports : await ext.activate();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspaceFolder, "no workspace folder open for the integration test");
    workspaceRoot = workspaceFolder.uri.fsPath;
  });

  async function writeFixtureChange(changeName: string, harnessConfig: unknown): Promise<string> {
    const changeDir = path.join(workspaceRoot, "openspec", "changes", changeName);
    await mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, "proposal.md"),
      "## Why\n\nFixture change for the chat-dispatch integration test suite.\n",
      "utf8",
    );
    await writeFile(path.join(changeDir, "tasks.md"), "## 1. Fixture\n\n- [ ] 1.1 Placeholder task.\n", "utf8");
    await writeFile(path.join(changeDir, "harness.json"), `${JSON.stringify(harnessConfig, null, 2)}\n`, "utf8");
    return changeDir;
  }

  async function removeFixtureChange(changeName: string): Promise<void> {
    await rm(path.join(workspaceRoot, "openspec", "changes", changeName), { recursive: true, force: true });
  }

  /** Reveals the AI panel scoped to `changeDir` and waits for its
   * follow-up `stepAgents` context message (`resolveAndPostStepAgents()`
   * in ai-panel.ts) to land — `dispatchOrRun()` reads
   * `panelContext.stepAgents` synchronously, so delivering a command
   * before this resolves would always fall through to the ordinary
   * `AgentRunner` path regardless of `harness.json`. */
  async function revealPanelAndWaitForStepAgents(changeDir: string): Promise<void> {
    const events: Event[] = [];
    const subscription = api.onWebviewEvent((event) => events.push(event));
    try {
      await vscode.commands.executeCommand("openspec-ui.openAiPanel", { changeDir });
      // stepAgents resolution has no event of its own to await — poll
      // getDashboardContext() briefly instead, exactly as the existing
      // "mode-toggle" test in extension.test.ts polls for the optional
      // server's isRunning flag.
      const deadline = Date.now() + 5000;
      while (api.getDashboardContext()?.stepAgents === undefined && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    } finally {
      subscription.dispose();
      void events; // only used to keep this helper self-contained; not asserted here
    }
  }

  test("a stage configured to the vscode-chat agent: started, then handedOff, never completed — ADR 0016", async () => {
    const changeName = "chat-dispatch-fixture-apply";
    const changeDir = await writeFixtureChange(changeName, {
      stepAgents: { apply: { agent: "vscode-chat" } },
      autonomyLevel: "assisted",
    });
    const chatOpen = stubChatOpenCommand();

    try {
      await revealPanelAndWaitForStepAgents(changeDir);

      const events: Event[] = [];
      const subscription = api.onWebviewEvent((event) => events.push(event));

      const runId = `chat-dispatch-apply-${Date.now()}`;
      const command: Command = {
        kind: "implement",
        cwd: workspaceRoot,
        context: { changeDir },
        runId,
        agentId: "claude-cli",
      };

      try {
        api.deliverWebviewCommand(command);
        const deadline = Date.now() + 5000;
        while (!events.some((e) => e.kind === "handedOff") && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } finally {
        subscription.dispose();
      }

      const kinds = events.filter((e) => "runId" in e && e.runId === runId).map((e) => e.kind);
      assert.deepEqual(kinds, ["started", "handedOff"], `expected exactly started -> handedOff, got: ${kinds.join(", ")}`);
      assert.equal(kinds.includes("completed"), false, "a vscode-chat dispatch must never emit completed");

      assert.equal(chatOpen.calls.length, 1, "expected workbench.action.chat.open to be invoked exactly once");
      const expectedPrompt = buildWorkbenchChatPrompt({ stage: "apply", changeName, workspaceRoot, changeDir });
      assert.deepEqual(chatOpen.calls[0], { query: expectedPrompt, mode: "agent" });
    } finally {
      chatOpen.restore();
      await removeFixtureChange(changeName);
    }
  });

  test("a stage NOT configured to the vscode-chat agent still runs through the ordinary agent path", async () => {
    const changeName = "chat-dispatch-fixture-default";
    const changeDir = await writeFixtureChange(changeName, { autonomyLevel: "assisted" });
    const chatOpen = stubChatOpenCommand();

    try {
      await revealPanelAndWaitForStepAgents(changeDir);

      const events: Event[] = [];
      const subscription = api.onWebviewEvent((event) => events.push(event));

      const runId = `chat-dispatch-default-${Date.now()}`;
      // An agent id that is never registered — resolveRunner() then
      // returns undefined, and dispatchOrRun()'s ordinary-path branch
      // emits "failed" without spawning a real CLI process, which is
      // all this test needs: proof the dispatch did NOT take the
      // vscode-chat branch.
      const command: Command = {
        kind: "implement",
        cwd: workspaceRoot,
        context: { changeDir },
        runId,
        agentId: "not-a-registered-agent",
      };

      try {
        api.deliverWebviewCommand(command);
        const deadline = Date.now() + 5000;
        while (
          !events.some((e) => "runId" in e && e.runId === runId && (e.kind === "failed" || e.kind === "completed" || e.kind === "handedOff"))
          && Date.now() < deadline
        ) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } finally {
        subscription.dispose();
      }

      const kinds = events.filter((e) => "runId" in e && e.runId === runId).map((e) => e.kind);
      assert.equal(chatOpen.calls.length, 0, "the ordinary agent path must never invoke workbench.action.chat.open");
      assert.equal(kinds.includes("handedOff"), false, "a stage not configured to vscode-chat must never emit handedOff");
      assert.ok(kinds.includes("failed"), `expected the ordinary AgentRunner path to fail for an unregistered agent id, got: ${kinds.join(", ")}`);
    } finally {
      chatOpen.restore();
      await removeFixtureChange(changeName);
    }
  });
});
