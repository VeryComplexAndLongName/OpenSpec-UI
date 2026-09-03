// 2.2 Message bridge between the extension host and the webview (primary mode).
// 2.3 If the local server is enabled — the webview loads the same browser
// shell as standalone instead of using the bridge (see design.md, "Optional
// local server reuses the same server package as standalone").

import * as vscode from "vscode";
import {
  detectAvailableAgents,
  normalizeStepAgent,
  stepAgentFor,
  resolveHarnessConfig,
  VSCODE_CHAT_STEP_AGENT_ID,
  type AgentRunner,
  type Command,
  type Event,
  type HarnessChainRunner,
  type HarnessStage,
  type HarnessStepAgents,
  type WorkbenchProcessScheduler,
} from "@openspec-ui/core";
import type { RunController } from "../run-controller.js";
import { buildWorkbenchChatPrompt } from "../workbench-chat-prompt.js";

const COMMAND_MESSAGE_TYPE = "openspec-ui/command";
const EVENT_MESSAGE_TYPE = "openspec-ui/event";
const CONTEXT_MESSAGE_TYPE = "openspec-ui/context";

export interface AiPanelContext {
  cwd: string;
  changeDir: string;
  /** Never set by a caller of `reveal()` — populated internally, after the
   * fact, once `detectAvailableAgents()` resolves (see design.md, "Extension:
   * detection runs after reveal(), posted as a follow-up context message"). */
  detectedAgents?: Record<string, boolean>;
  /** Never set by a caller of `reveal()` — populated internally, after
   * `resolveHarnessConfig()` resolves, the same follow-up-message pattern
   * as `detectedAgents`. See openspec/changes/agentic-harness/.
   * Passed through in whatever form the config used — an agent id on its
   * own, or `{ agent, model }`. It must NOT be flattened to agent ids
   * here: the panel needs the model to put it on the `Command` it sends
   * (see harness-step-models tasks.md section 9 — flattening at this
   * layer silently dropped the model on its way to argv). */
  stepAgents?: HarnessStepAgents;
  /** Set by `openspec-ui.runWithHarness` (`agentic-harness-run-menu`) when
   * the caller already resolved (Node-side, before ever revealing a
   * panel) that this change's harness config targets `"chain"` rather
   * than `"picker"` — see `resolveRunWithHarnessTarget` in
   * `@openspec-ui/core`. Unlike `detectedAgents`/`stepAgents`, this must
   * be known on the FIRST render (it decides which component mounts), so
   * it is baked into the initial webview HTML (`getBridgeHtml`'s
   * `data-start-chain`), not delivered as a follow-up message. Absent (or
   * `false`) for every other reveal — the existing single-stage picker. */
  startChain?: boolean;
}

interface BridgeCommandMessage {
  type: typeof COMMAND_MESSAGE_TYPE;
  command: Parameters<AgentRunner["run"]>[0];
}

function isBridgeCommandMessage(data: unknown): data is BridgeCommandMessage {
  if (typeof data !== "object" || data === null) return false;
  const v = data as Record<string, unknown>;
  return v.type === COMMAND_MESSAGE_TYPE && typeof v.command === "object" && v.command !== null;
}

/** The `HarnessStage` a single-stage `Command.kind` corresponds to —
 * mirrors `HarnessChainRunner`'s own `CHAIN_STAGE_COMMAND` mapping
 * (`harness-chain-runner.ts`), inverted, and `webui`'s
 * `COMMAND_KIND_TO_HARNESS_STAGE` (`AiPanel.tsx`). Only these three kinds
 * are ever dispatched through a single `stepAgents` entry — everything
 * else (`status`/`list`/`show`/`validate`/`cancel`/`chain`/
 * `confirmCheckpoint`) has no entry here and always falls through to the
 * existing `AgentRunner` path. */
const STAGE_FOR_COMMAND_KIND: Partial<Record<Command["kind"], HarnessStage>> = {
  plan: "propose",
  review: "review",
  implement: "apply",
};

export interface AiPanelDeps {
  extensionUri: vscode.Uri;
  runController: RunController;
  resolveRunner: (agentId: string | undefined) => AgentRunner | undefined;
  /** Drives `"chain"`/`"confirmCheckpoint"` commands — see
   * docs/adr/0012-agentic-harness-chain-execution-protocol.md. Reused
   * across every message (a paused chain's state lives between them), not
   * a per-command construction. */
  chainRunner: HarnessChainRunner;
  /** If the local server is enabled and running — returns its base URL
   * (`http://127.0.0.1:<port>`); otherwise `undefined` (primary mode uses
   * the bridge). */
  getLocalServerUrl: () => string | undefined;
  /** Optional — when present, every `plan`/`implement`/`review` run also
   * registers a `WorkbenchProcess` (visible in the Processes view, with
   * `agentId`) purely as an observer of the same event stream already
   * flowing to the webview; it does not change how the run itself
   * executes. See openspec/changes/agentic-harness/design.md. */
  scheduler?: WorkbenchProcessScheduler;
}

export class AiPanel {
  private panel: vscode.WebviewPanel | undefined;
  private panelContext: AiPanelContext | undefined;
  /** Which agent each live run was started against.
   *
   * A `"cancel"` command carries no `agentId` — the webview does not know
   * one, and for a chain there is no single answer anyway. Without this,
   * `resolveRunner(command.agentId)` fell back to `DEFAULT_AGENT_ID`, so
   * a cancel for a run on any other agent was handed to `claude-cli`'s
   * runner, whose `activeRuns` map has never heard of that `runId`. The
   * cancel then reported "nothing to cancel" and the real agent carried
   * on working — reported 2026-09-03 against `copilot-cli-acp`, where it
   * looked like the Cancel button doing nothing at all. */
  private readonly runAgentIds = new Map<string, string | undefined>();

  /** Test-only observers of every `"openspec-ui/event"` message this
   * panel posts to the webview — see `onWebviewEventForTesting()` below.
   * Empty (and untouched) outside a test run; production behaviour is
   * unchanged because `postEventMessage()` always still calls
   * `panel.webview.postMessage()` regardless of whether any listener is
   * registered. */
  private readonly testEventListeners = new Set<(event: Event) => void>();

  constructor(private readonly deps: AiPanelDeps) { }

  /** The one place every `"openspec-ui/event"` message reaches the
   * webview from, so `onWebviewEventForTesting()` has a single seam to
   * observe rather than one per call site. */
  private postEventMessage(panel: vscode.WebviewPanel, event: Event): void {
    for (const listener of this.testEventListeners) listener(event);
    void panel.webview.postMessage({ type: EVENT_MESSAGE_TYPE, event });
  }

  /** Registers a `WorkbenchProcess` for a `plan`/`implement`/`review`/
   * `chain` command, purely observing `runController`'s existing event
   * stream (no change to how the run itself executes or cancels). No-op
   * when `deps.scheduler` isn't supplied. */
  private trackHarnessProcess(command: Command): void {
    const scheduler = this.deps.scheduler;
    if (!scheduler) return;
    // A cancel is a signal about a run, not a run. It reached here only
    // because `dispatchOrRun` is the "everything not handled above"
    // branch, and the result was a Processes entry called "cancel" whose
    // `execute` promise waited for a terminal event that a cancel command
    // does not produce — four presses, four entries, hanging forever
    // (reported 2026-09-03).
    if (command.kind === "cancel") return;

    const changeName = command.context.changeDir
      .split(/[\\/]+/)
      .filter((segment) => segment.length > 0)
      .pop();

    const handle: ReturnType<WorkbenchProcessScheduler["start"]> = scheduler.start({
      operation: command.kind,
      changeName,
      agentId: command.agentId,
      // A chain includes "implement"/"archive" stages that mutate the
      // repository just as directly as a standalone `implement` does.
      mutating: command.kind === "implement" || command.kind === "chain",
      execute: ({ report }) =>
        new Promise<string | void>((resolve, reject) => {
          const unsubscribe = this.deps.runController.onEvent((event) => {
            if (event.runId !== command.runId) return;
            switch (event.kind) {
              case "progress":
                report(event.message);
                return;
              case "completed":
                unsubscribe();
                resolve(event.summary);
                return;
              case "failed":
                unsubscribe();
                reject(new Error(event.reason));
                return;
              case "cancelled":
                unsubscribe();
                handle?.cancel();
                resolve();
                return;
              // Every remaining kind is non-terminal and simply does not
              // settle this promise. Listed by name rather than left to
              // `default:` — a bare default is what let `cancelling` be
              // added to the protocol without anything here noticing,
              // while the two exhaustive switches elsewhere failed the
              // build immediately. A new terminal kind must break here.
              case "started":
              case "stdout":
              case "stderr":
              case "cancelling":
              case "stageCompleted":
              case "checkpoint":
              case "handedOff":
              case "agentUpdate":
              case "permissionRequest":
                return;
            }
          });
        }),
    });
  }

  /** Routes a `"plan"`/`"review"`/`"implement"` command either to a
   * spawned `AgentRunner` (default, unchanged) or, when the
   * corresponding stage's `stepAgents` entry — already resolved once per
   * reveal by `resolveAndPostStepAgents()`, the same recommendation the
    * webview's picker pre-fill uses — selects the
    * `VSCODE_CHAT_STEP_AGENT_ID` target,
   * to VS Code's own chat instead — see
   * docs/adr/0016-harness-stage-dispatch-via-vscode-chat.md. Reading the
   * already-resolved `this.panelContext.stepAgents` here (rather than
   * calling `resolveHarnessConfig` again) keeps the ordinary AgentRunner
   * path fully synchronous, exactly as before this capability existed —
   * a malformed harness config already fails silently in
   * `resolveAndPostStepAgents()` (reported elsewhere, in the Harness
   * Settings UI), leaving `stepAgents` undefined and this method falling
   * through to the AgentRunner path here too. Every other command kind
   * has no entry in `STAGE_FOR_COMMAND_KIND`, so it always falls through
   * unchanged as well. */
  private dispatchOrRun(panel: vscode.WebviewPanel, command: Command): void {
    const stage = STAGE_FOR_COMMAND_KIND[command.kind];
    const stepAgent = stage ? stepAgentFor(this.panelContext?.stepAgents, stage) : undefined;
    if (stepAgent !== undefined && normalizeStepAgent(stepAgent).agent === VSCODE_CHAT_STEP_AGENT_ID) {
      const changeName = command.context.changeDir
        .split(/[\\/]+/)
        .filter((segment) => segment.length > 0)
        .pop();
      if (changeName) {
        void this.dispatchToChat(panel, command, stage as HarnessStage, changeName);
        return;
      }
    }

    // A cancel goes to the runner that owns the run, not to whichever
    // agent `DEFAULT_AGENT_ID` names. `activeRuns` lives per runner
    // instance, so asking the wrong one is the same as not asking.
    const agentId = command.kind === "cancel"
      ? this.runAgentIds.get(command.runId) ?? command.agentId
      : command.agentId;
    const runner = this.deps.resolveRunner(agentId);
    if (!runner) {
      this.postEventMessage(panel, {
        kind: "failed",
        runId: command.runId,
        timestamp: new Date().toISOString(),
        reason: "AI agent execution is disabled in direct OpenSpec mode.",
      });
      return;
    }
    if (command.kind !== "cancel") this.runAgentIds.set(command.runId, agentId);
    this.trackHarnessProcess(command);
    void this.deps.runController.run(runner, command);
  }

  /** Hands `command`'s stage to VS Code's own chat instead of spawning
   * an `AgentRunner`. Emits `started` then `handedOff` — never
   * `completed`/`failed`/`cancelled` — see design.md, "A distinct event
   * kind, not `completed`": nothing observes the chat session's work, so
   * the run simply ends at the hand-off event. */
  private async dispatchToChat(
    panel: vscode.WebviewPanel,
    command: Command,
    stage: HarnessStage,
    changeName: string,
  ): Promise<void> {
    this.postEventMessage(panel, {
      kind: "started",
      runId: command.runId,
      timestamp: new Date().toISOString(),
      command: command.kind,
      cwd: command.cwd,
    });

    const prompt = buildWorkbenchChatPrompt({
      stage,
      changeName,
      workspaceRoot: command.cwd,
      changeDir: command.context.changeDir,
    });
    await vscode.commands.executeCommand("workbench.action.chat.open", { query: prompt, mode: "agent" });

    this.postEventMessage(panel, { kind: "handedOff", runId: command.runId, timestamp: new Date().toISOString(), stage });
  }

  reveal(panelContext?: AiPanelContext): void {
    if (panelContext) this.panelContext = { ...panelContext };
    if (this.panel) {
      this.panel.reveal();
      if (panelContext) {
        void this.panel.webview.postMessage({ type: CONTEXT_MESSAGE_TYPE, context: panelContext });
      }
      this.detectAndPostAgents();
      this.resolveAndPostStepAgents();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "openspecUiAiPanel",
      "OpenSpec UI",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.deps.extensionUri, "dist")],
      },
    );
    this.panel = panel;

    const localServerUrl = this.deps.getLocalServerUrl();
    panel.webview.html = localServerUrl
      ? this.getLocalServerHtml(localServerUrl)
      : this.getBridgeHtml(panel.webview, panelContext);
    this.detectAndPostAgents();
    this.resolveAndPostStepAgents();

    const unsubscribeEvents = this.deps.runController.onEvent((event) => {
      this.postEventMessage(panel, event);
    });

    const messageSub = panel.webview.onDidReceiveMessage((message: unknown) => {
      this.handleWebviewMessage(panel, message);
    });

    panel.onDidDispose(() => {
      unsubscribeEvents();
      messageSub.dispose();
      this.panel = undefined;
    });
  }

  /** The single handler for every message a webview posts, wired up by
   * `reveal()` above via `panel.webview.onDidReceiveMessage()`. Pulled
   * out to a named method (rather than left inline) so
   * `deliverWebviewCommandForTesting()` below can hand it the exact same
   * code path — including `dispatchOrRun()`/`dispatchToChat()` — instead
   * of a test needing its own copy of this routing. */
  private handleWebviewMessage(panel: vscode.WebviewPanel, message: unknown): void {
    if (!isBridgeCommandMessage(message)) return;
    const command = message.command;

    if (command.kind === "status" || command.kind === "list" || command.kind === "show" || command.kind === "validate") {
      void this.deps.runController.run(undefined, command);
      return;
    }

    // "confirmCheckpoint" and a "cancel" targeting an active chain never
    // reach a single AgentRunner — they signal the one long-lived
    // HarnessChainRunner already driving that runId (see
    // harness-chain-runner.ts). The chain's own events keep flowing to
    // the webview through the existing `runController.onEvent`
    // subscription above (unchanged) — a chain is started through
    // `runController.run()` below just like any other command, so no
    // separate event-forwarding path is needed for it.
    if (command.kind === "confirmCheckpoint") {
      this.deps.chainRunner.confirmCheckpoint(command.runId);
      return;
    }
    if (command.kind === "cancel" && this.deps.chainRunner.cancel(command.runId)) {
      // Tell the webview the request landed. Returning silently left
      // the panel with nothing between the click and the chain's own
      // `cancelled`, which arrives only once the stage's process is
      // actually gone — so the button appeared to do nothing. The
      // standalone host gets this from the chain runner's own
      // `asAgentRunner()`; this path bypasses it.
      this.postEventMessage(panel, {
        kind: "cancelling",
        runId: command.runId,
        timestamp: new Date().toISOString(),
        attempted: "termination-requested",
      });
      return;
    }
    if (command.kind === "chain") {
      this.trackHarnessProcess(command);
      void this.deps.runController.run(this.deps.chainRunner.asAgentRunner(), command);
      return;
    }

    this.dispatchOrRun(panel, command);
  }

  /** Test-only in intent, real API in effect: delivers `command` through
   * the exact same `handleWebviewMessage()` a real webview's
   * `acquireVsCodeApi().postMessage(...)` reaches, wrapped in the same
   * `{ type: "openspec-ui/command", command }` envelope
   * `isBridgeCommandMessage()` expects. It exists only because VS Code's
   * test API provides no way for an Extension Development Host test to
   * simulate an incoming webview message, and `packages/extension/src/
   * test/suite/` needs to exercise the real webview → extension routing
   * (including `dispatchToChat()`) rather than reaching around it by
   * calling a private method directly — see
   * openspec/changes/dispatch-to-chat-integration-coverage/proposal.md.
   * Deliberately does NOT expose `AiPanel` itself or `dispatchToChat()` —
   * only this one command-delivery seam. No-op if `reveal()` has not
   * been called yet (there is no panel to deliver to). */
  deliverWebviewCommandForTesting(command: Parameters<AgentRunner["run"]>[0]): void {
    if (!this.panel) return;
    this.handleWebviewMessage(this.panel, { type: COMMAND_MESSAGE_TYPE, command });
  }

  /** Test-only in intent, real API in effect: the receiving half of
   * `deliverWebviewCommandForTesting()` above — observes every
   * `"openspec-ui/event"` message this panel posts to the webview
   * (`postEventMessage()`), exactly as a real webview's own
   * `window.addEventListener("message", ...)` would. Needed because a
   * VS Code `WebviewPanel`'s `postMessage()` has no return channel a
   * Node-side test can otherwise observe. Registering a listener never
   * changes what gets posted or when — every existing `postMessage()`
   * call still fires unconditionally; this only taps the same stream.
   * Returns a `Disposable` that stops observing. */
  onWebviewEventForTesting(listener: (event: Event) => void): vscode.Disposable {
    this.testEventListeners.add(listener);
    return { dispose: () => this.testEventListeners.delete(listener) };
  }

  getContext(): AiPanelContext | undefined {
    return this.panelContext ? { ...this.panelContext } : undefined;
  }

  /** Fire-and-forget: computes agent presence via a direct core import and
   * posts it as a follow-up context message once resolved, without
   * delaying `reveal()` itself (see design.md, "Extension: detection runs
   * after reveal()..."). No-op in optional-local-server mode — that mode's
   * iframe loads the same standalone bundle, which already gets detection
   * via its own REST call, not this message-bridge channel. */
  private detectAndPostAgents(): void {
    if (this.deps.getLocalServerUrl()) return;
    const panel = this.panel;
    if (!panel) return;
    void detectAvailableAgents().then((detectedAgents) => {
      if (!this.panelContext) return;
      this.panelContext = { ...this.panelContext, detectedAgents };
      void panel.webview.postMessage({ type: CONTEXT_MESSAGE_TYPE, context: this.panelContext });
    });
  }

  /** Same follow-up-context-message pattern as `detectAndPostAgents()` —
   * resolves the Agentic Harness `stepAgents` recommendation for the
   * currently loaded change and posts it once resolved, never blocking
   * `reveal()`. No-op in optional-local-server mode (that mode loads the
   * standalone webui bundle over HTTP instead, unrelated to this
   * message-bridge context). */
  private resolveAndPostStepAgents(): void {
    if (this.deps.getLocalServerUrl()) return;
    const panel = this.panel;
    const context = this.panelContext;
    if (!panel || !context || !context.changeDir) return;
    const changeName = context.changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0).pop();
    if (!changeName) return;

    void resolveHarnessConfig(context.cwd, changeName).then((harnessConfig) => {
      if (!this.panelContext) return;
      // Passed through as resolved, not flattened to agent ids — the
      // object form carries the stage's model, which the panel needs for
      // the `Command` it sends. JSON-serializes over `postMessage` as is.
      this.panelContext = { ...this.panelContext, stepAgents: harnessConfig.stepAgents };
      void panel.webview.postMessage({ type: CONTEXT_MESSAGE_TYPE, context: this.panelContext });
    }).catch(() => {
      // Malformed harness config is reported elsewhere (Harness Settings
      // UI); the picker simply falls back to no recommendation here.
    });
  }

  private getBridgeHtml(webview: vscode.Webview, panelContext?: AiPanelContext): string {
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.deps.extensionUri, "dist", "webview.js"));
    const csp = `default-src 'none'; script-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline';`;
    const cwd = escapeHtmlAttribute(panelContext?.cwd ?? "");
    const changeDir = escapeHtmlAttribute(panelContext?.changeDir ?? "");
    // Unlike detectedAgents/stepAgents (delivered as a follow-up message
    // once resolved), startChain must be known on the FIRST render — it
    // decides which component mounts — so it is baked into the initial
    // HTML here, not posted afterward.
    const startChain = panelContext?.startChain ? "true" : "false";
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI</title>
  </head>
  <body>
    <div id="root" data-workspace-root="${cwd}" data-change-directory="${changeDir}" data-start-chain="${startChain}"></div>
    <script src="${scriptUri.toString()}"></script>
  </body>
</html>`;
  }

  /** Optional mode (2.3): embeds the same browser shell as the standalone
   * tool, instead of the postMessage bridge. CSP is scoped to that exact
   * localhost address.
   *
   * Marks the iframe `src` with the `embed=vscode-local-server` query
   * parameter (see
   * openspec/changes/standalone-shell-host-aware-tabs/design.md, "Signal
   * mechanism") so the embedded standalone shell shows only the "Run a
   * Command" tab — the other four are already covered by native VS Code
   * UI (diff/tree/file editing). Built via `URL`, not string
   * concatenation, so the parameter lands correctly ahead of the
   * `#token=...` fragment already present in `baseUrl`. */
  private getLocalServerHtml(baseUrl: string): string {
    const iframeUrl = new URL(baseUrl);
    iframeUrl.searchParams.set("embed", "vscode-local-server");
    const iframeSrc = iframeUrl.toString();
    const csp = `default-src 'none'; frame-src ${baseUrl};`;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>OpenSpec UI</title>
    <style>html, body, iframe { height: 100%; width: 100%; margin: 0; border: 0; }</style>
  </head>
  <body>
    <iframe src="${iframeSrc}"></iframe>
  </body>
</html>`;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
