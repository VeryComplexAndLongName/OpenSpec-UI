// Entry point for the VS Code extension. The primary mode is a direct
// import of `@openspec-ui/core` + a message bridge to the Webview, with no
// network involved (see ADR 0001 item 2 and
// openspec/changes/vscode-extension/design.md).

import * as vscode from "vscode";
import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import {
  CHECK_SCRIPT_NAMES,
  FileAuditLog,
  LEFTOVER_SWEEP_INTERVAL_MS,
  clearWorkspaceLeftovers,
  HarnessChainRunner,
  LiveRuns,
  WorkbenchProcessScheduler,
  WorkbenchRunJournal,
  WorkspaceLeaseManager,
  auditLogPath,
  agentStopRequestHandlers,
  buildDefaultAgentRunners,
  chainAnswerWriter,
  chainMessageHandlers,
  chainStopRequestHandlers,
  createGitWrapper,
  forgetMessage,
  loadOrCreateMachineKey,
  messageDirectoryBeside,
  readAgentRoster,
  readMessagesFor,
  resolveAgentStatusDirectory,
  rosterDirectoryBeside,
  rosterOf,
  confirmEnrolmentFor,
  readGitAuthor,
  resolveCheckScripts,
  resolveRunner as resolveAgentRunner,
  runDelegatedItem,
  shortDelegatedItemOutcome,
} from "@openspec-ui/core";
import { AnswerWatcher, describeAnswer } from "./answers-watcher.js";
import { buildChainRunnerAuditDeps } from "./chain-runner-audit-deps.js";
import { getWorkspaceRoot, readConfig } from "./config.js";
import { RunController } from "./run-controller.js";
import { RunCompletionNotifier, describeRunCompletion } from "./run-notifications.js";
import { registerChangeElsewhere } from "./change-elsewhere.js";
import { createRunChoiceHandler, registerCommands, type CommandsDeps } from "./commands.js";
import { sendPipelineRunControl } from "./pipeline-run-control.js";
import { checkScheduleOnce, watchScheduledRuns } from "./scheduled-run-watcher.js";
import type { RevealableTreeView, TreeSelectionView, ViewFilters } from "./commands.js";
import type { ViewFilterState } from "./tree/view-filter-state.js";
import { ChangesTreeProvider } from "./tree/changes-tree.js";
import { followChangesView } from "./tree/changes-view-follower.js";
import { ChangeStandingDecorations } from "./tree/change-standing-decorations.js";
import { ChangeTreeItem } from "./tree/changes-tree.js";
import { ArchiveTreeProvider, isUnderArchive } from "./tree/archive-tree.js";
import { SpecsTreeProvider } from "./tree/specs-tree.js";
import { ProcessesTreeProvider } from "./tree/processes-tree.js";
import { TemplatesTreeProvider } from "./tree/templates-tree.js";
import { ChangeGraphTreeProvider } from "./tree/change-graph-tree.js";
import type { GraphTreeNode } from "./tree/change-graph-tree.js";
import {
  HumanOnlyInboxTreeProvider,
  type EnrolmentRequestTreeItem,
  type HumanOnlyInboxItemTreeItem,
} from "./tree/human-only-inbox-tree.js";
import { registerFollowSelection } from "./follow-selection.js";
import { ImplementationSessionManager } from "./implementation-sessions.js";
import { registerOpenSpecChatParticipant } from "./chat-participant.js";
import { AiPanel } from "./webview/ai-panel.js";
import type { AiPanelContext, RunChoice } from "./webview/ai-panel.js";
import { HarnessSettingsPanel, type ObservedHarnessRequest } from "./webview/harness-settings-panel.js";
import { PipelinePanel } from "./webview/pipeline-panel.js";
import { OptionalServerManager } from "./optional-server.js";
import { recoveryDisabledMessage } from "./recovery-diagnostics.js";

let runners: Map<string, AgentRunner> | undefined;
let auditLog: FileAuditLog | undefined;
let optionalServer: OptionalServerManager | undefined;

/** Sets `openspec-ui.checks.<name>` for each check — the context key
 * package.json's `view/title` and `commandPalette` `when` clauses gate on
 * (task 1.4: a workspace declaring neither `osui-<name>` nor `<name>` must
 * see no command, not a failing one). Re-run on activation, on
 * `openspec-ui.checks` config changes, and whenever the workspace's
 * `package.json` changes — any of the three can change what resolves. */
async function updateCheckContexts(workspaceRoot: string | undefined): Promise<void> {
  const resolved = workspaceRoot ? await resolveCheckScripts(workspaceRoot, readConfig().checks) : {};
  await Promise.all(
    CHECK_SCRIPT_NAMES.map((name) =>
      vscode.commands.executeCommand("setContext", `openspec-ui.checks.${name}`, Boolean(resolved[name])),
    ),
  );
}

/** Exported via `vscode.extensions.getExtension(...).exports` — for
 * integration tests only (src/test/suite), not a public API. */
export interface ExtensionTestApi {
  getRunners: () => Map<string, AgentRunner> | undefined;
  runController: RunController;
  optionalServer: OptionalServerManager | undefined;
  getDashboardContext: () => AiPanelContext | undefined;
  changesTree: ChangesTreeProvider | undefined;
  templatesTree: TemplatesTreeProvider | undefined;
  /** Test-only in intent, real API in effect: delivers `command` to the
   * AI panel through the exact same handler a real webview message
   * reaches (`AiPanel.deliverWebviewCommandForTesting()`), so an
   * integration test exercises the actual webview → extension routing
   * (including the `vscode-chat` step-agent dispatch) instead of a
   * shortcut around it. Deliberately does NOT expose `AiPanel` itself or
   * its private `dispatchToChat()` — see
   * openspec/changes/dispatch-to-chat-integration-coverage/proposal.md.
   * No-op if the AI panel has never been revealed. */
  deliverWebviewCommand: (command: Command) => void;
  deliverWebviewRunChoice: (choice: RunChoice) => void;
  /** Delivers a request to a harness settings panel — the named change's,
   * or the global one with no change — through the same handler a real
   * webview message reaches. No-op when that panel is not open. */
  deliverWebviewRequest: (request: { id: string; op: string; args?: unknown }, changeName?: string) => void;
  onWebviewResponse: (listener: (response: unknown) => void) => vscode.Disposable;
  /** Observes every request a harness settings panel's webview sends,
   * including the ones a real webview sends when it first renders — how a
   * test can tell a change's panel loaded that change. */
  onHarnessSettingsRequest: (listener: (request: ObservedHarnessRequest) => void) => vscode.Disposable;
  /** The title of the named change's settings panel, or the global one's,
   * or `undefined` when it is not open. */
  getHarnessSettingsTitle: (changeName?: string) => string | undefined;
  getHarnessSettingsHtml: (changeName?: string) => string | undefined;
  checkScheduledRunsOnce: () => Promise<string[]>;
  getWebviewHtml: () => string | undefined;
  /** The receiving half of `deliverWebviewCommand` above: observes every
   * `"openspec-ui/event"` message the AI panel posts back to the webview
   * (`AiPanel.onWebviewEventForTesting()`) — the wire-level artifact a
   * real webview's own `window.addEventListener("message", ...)` would
   * see, not a hook into `AiPanel`'s internals. Needed so an integration
   * test can assert ADR 0016's `started` → `handedOff` event sequence
   * for a `vscode-chat` dispatch, which never reaches
   * `runController.onEvent` (see ai-panel.ts's `dispatchToChat()` header
   * comment — nothing observes the chat session's work through the
   * ordinary runner path). Returns a `Disposable` that stops observing;
   * works whether registered before or after the AI panel has been
   * revealed. */
  onWebviewEvent: (listener: (event: Event) => void) => vscode.Disposable;
}

export async function activate(context: vscode.ExtensionContext): Promise<ExtensionTestApi> {
  const outputChannel = vscode.window.createOutputChannel("OpenSpec UI");
  context.subscriptions.push(outputChannel);

  // Every run this extension host starts — from the palette, the AI panel,
  // a chain, or a delegated item — is held here while it runs, and the
  // Pipeline's cards offer controls only for these
  // (a-change-is-run-from-its-card).
  const liveRuns = new LiveRuns();
  // A run started here reads requests to stop it from other worktrees, and
  // stops as a card's Stop would stop it: a chain through the chain runner,
  // with the enrolled person and the request's id, a single stage through its
  // runner (a-run-elsewhere-can-be-asked-to-stop). `chainRunner` and
  // `auditLog` are read when a request arrives, long after activation.
  const runController = new RunController(liveRuns, (runner, command) =>
    command.kind === "chain"
      ? {
        ...chainStopRequestHandlers(chainRunner, command, auditLog),
        // The same renewal that reads a request to stop reads what the
        // operator said (the-operator-can-say-something-to-a-run).
        ...chainMessageHandlers(chainRunner, command, auditLog),
      }
      : agentStopRequestHandlers(runner, command, auditLog));
  const workspaceRoot = getWorkspaceRoot();
  let journal: WorkbenchRunJournal | undefined;
  let restoredRuns = { processes: [], checkpointSessions: [] } as Awaited<ReturnType<WorkbenchRunJournal["load"]>>;
  if (workspaceRoot) {
    journal = new WorkbenchRunJournal(workspaceRoot);
    try {
      restoredRuns = await journal.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel.appendLine(`Run recovery disabled: ${message}`);
      void vscode.window.showErrorMessage(recoveryDisabledMessage(error));
      journal = undefined;
    }
  }
  // Once, at activation. The lease renews every five seconds and must
  // not spawn a git process each time (a-lease-says-who).
  const lease = workspaceRoot
    ? new WorkspaceLeaseManager(workspaceRoot, {
      hostKind: "vscode-extension",
      author: await readGitAuthor(workspaceRoot),
    })
    : undefined;
  const scheduler = new WorkbenchProcessScheduler(restoredRuns.processes, lease);
  const persistRuns = () => {
    if (!journal) return;
    void journal.save({
      processes: scheduler.list(),
      checkpointSessions: implementationSessions.exportPersisted(),
    }).catch((error: unknown) => {
      outputChannel.appendLine(`Run journal write failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
  const implementationSessions = new ImplementationSessionManager(scheduler, persistRuns);
  context.subscriptions.push({ dispose: scheduler.onDidChange(persistRuns) });
  // Startup reads checkpoint payloads only for interrupted sessions that
  // still lack a persisted delta; all other restored sessions keep a
  // lazy reference and resolve on first details/rollback request.
  await implementationSessions.restore(restoredRuns.checkpointSessions);

  // Notify when a plan/implement/review run finishes while the user isn't
  // necessarily watching the Processes view — seeded from the restored
  // journal so processes that were already terminal before this activation
  // (including ones the constructor above just marked "interrupted") never
  // re-fire. See run-notifications.ts for why status/list/show/validate and
  // cancelled/interrupted/rolled-back are excluded.
  const runCompletionNotifier = new RunCompletionNotifier(scheduler.list());
  context.subscriptions.push({
    dispose: scheduler.onDidChange((processes) => {
      for (const process of runCompletionNotifier.handle(processes)) {
        const message = describeRunCompletion(process);
        const show = process.state === "failed" ? vscode.window.showErrorMessage : vscode.window.showInformationMessage;
        void show(message, "View").then((choice) => {
          if (choice === "View") void vscode.commands.executeCommand("openspec-ui.openAiPanel");
        });
      }
    }),
  });

  // Retention (openspec-ui.checkpointRetentionDays): 0 or negative keeps
  // everything forever (default, matches prior behavior — nothing was
  // ever pruned before this setting existed). scheduler.removeBefore's
  // own onDidChange emission (subscribed above) persists the pruned
  // state; no separate persistRuns() call needed here.
  const retentionDays = vscode.workspace.getConfiguration("openspec-ui").get<number>("checkpointRetentionDays", 0);
  if (retentionDays > 0) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    implementationSessions.dropSessions(scheduler.removeBefore(cutoff));
  }
  const processesTree = new ProcessesTreeProvider(scheduler, workspaceRoot ?? "");
  context.subscriptions.push(
    processesTree,
    vscode.window.registerTreeDataProvider("openspecUiProcesses", processesTree),
  );

  let changesTree: ChangesTreeProvider | undefined;
  let archiveTree: ArchiveTreeProvider | undefined;
  let specsTree: SpecsTreeProvider | undefined;
  let templatesTree: TemplatesTreeProvider | undefined;
  let changeGraphTree: ChangeGraphTreeProvider | undefined;
  let humanOnlyInboxTree: HumanOnlyInboxTreeProvider | undefined;
  // The three views whose rows the item-scoped commands act on:
  // `createTreeView` returns a handle exposing `selection`, which
  // `registerTreeDataProvider` does not, and the Command Palette (which
  // passes no item) needs it to find the row the user highlighted.
  // `openspecUiSpecs`/`openspecUiProcesses` stay on
  // `registerTreeDataProvider` — no command reads their selection.
  let changesView: RevealableTreeView<ChangeTreeItem> | undefined;
  let archiveView: RevealableTreeView<ChangeTreeItem> | undefined;
  let templatesView: TreeSelectionView | undefined;
  let changeGraphView: RevealableTreeView<GraphTreeNode> | undefined;
  let filters: ViewFilters | undefined;
  if (workspaceRoot) {
    // Each change's state word colours its row through a file decoration
    // (a-change-says-where-it-stands).
    const standingDecorations = new ChangeStandingDecorations();
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(standingDecorations));
    const changes = new ChangesTreeProvider(workspaceRoot, { decorations: standingDecorations });
    changesTree = changes;
    archiveTree = new ArchiveTreeProvider(workspaceRoot);
    specsTree = new SpecsTreeProvider(workspaceRoot);
    templatesTree = new TemplatesTreeProvider(workspaceRoot);
    changeGraphTree = new ChangeGraphTreeProvider(workspaceRoot);
    humanOnlyInboxTree = new HumanOnlyInboxTreeProvider(workspaceRoot);
    const changesTreeView = vscode.window.createTreeView("openspecUiChanges", { treeDataProvider: changes });
    // The view says which change this working directory is for, beside its
    // title, and says it again whenever the tree is drawn: the survey that
    // knows it lands after the first draw
    // (changes-shows-one-change-and-who-owns-it).
    const sayWhichChange = (): void => {
      changesTreeView.description = changes.ownChangeName();
    };
    context.subscriptions.push(changes.onDidChangeTreeData(sayWhichChange));
    sayWhichChange();
    // Reading another working directory's copy, opening that directory,
    // and the picker over all of them
    // (changes-shows-one-change-and-who-owns-it).
    registerChangeElsewhere(context, {
      getWorkspaceRoot: () => workspaceRoot,
      reveal: async (item) => { await changesTreeView.reveal(item, { select: true, focus: true }); },
    });
    const archiveTreeView = vscode.window.createTreeView("openspecUiArchive", { treeDataProvider: archiveTree });
    const templatesTreeView = vscode.window.createTreeView("openspecUiTemplates", { treeDataProvider: templatesTree });
    // Was `registerTreeDataProvider` (no command read this view's
    // selection). Reversed here because `reveal` — which
    // `openspec-ui.revealInChangeGraph` and follow-selection both need —
    // lives only on the handle `createTreeView` returns. The rest of the
    // original reasoning is unchanged: this is still revealed *into*, not
    // read from — no mutating command gains a graph entry (design.md,
    // "the graph moves to createTreeView, and what that reverses").
    const changeGraphTreeView = vscode.window.createTreeView("openspecUiChangeGraph", { treeDataProvider: changeGraphTree });
    // Was `registerTreeDataProvider`: a filtered view has to say what it
    // is filtered by, and `message` lives only on the handle
    // `createTreeView` returns
    // (the-views-are-searched-and-landed-relations-fold).
    const specsTreeView = vscode.window.createTreeView("openspecUiSpecs", { treeDataProvider: specsTree });
    // What a narrowed view says above its rows. Written whenever the view
    // finishes counting, so the counts are the rows actually drawn.
    const sayWhatIsFiltered = (view: vscode.TreeView<unknown>, provider: { filter: ViewFilterState }) => {
      provider.filter.onCounted = () => { view.message = provider.filter.message; };
    };
    sayWhatIsFiltered(archiveTreeView as unknown as vscode.TreeView<unknown>, archiveTree);
    sayWhatIsFiltered(specsTreeView as unknown as vscode.TreeView<unknown>, specsTree);
    sayWhatIsFiltered(changeGraphTreeView as unknown as vscode.TreeView<unknown>, changeGraphTree);
    // What this product left behind, swept on activation and on core's
    // interval, and said in the Changes view: a directory with no
    // documents was listed there as a change with no tasks
    // (the-workspace-clears-what-it-left-behind). The sweep removes only
    // an archived change's own leavings; everything else is shown.
    const sweepLeftovers = async () => {
      if (!workspaceRoot || !changesTree) return;
      try {
        const sweep = await clearWorkspaceLeftovers(workspaceRoot);
        changesTree.setLeftovers({
          cleared: sweep.removed.map((one) => one.name),
          kept: sweep.kept.map((one) => ({
            name: one.name,
            path: one.path,
            files: one.files,
            archived: one.archivedAs !== undefined,
          })),
        });
        for (const failure of sweep.failures) {
          outputChannel.appendLine(`OpenSpec UI: could not clear ${failure.path} (${failure.reason})`);
        }
      } catch (error) {
        outputChannel.appendLine(`OpenSpec UI: the leftover sweep failed (${error instanceof Error ? error.message : String(error)})`);
      }
    };
    void sweepLeftovers();
    const sweepTimer = setInterval(() => { void sweepLeftovers(); }, LEFTOVER_SWEEP_INTERVAL_MS);
    context.subscriptions.push({ dispose: () => clearInterval(sweepTimer) });

    filters = {
      archive: { filter: archiveTree.filter, refresh: () => archiveTree?.refresh() },
      specs: { filter: specsTree.filter, refresh: () => specsTree?.refresh() },
      changeGraph: {
        filter: changeGraphTree.filter,
        refresh: () => changeGraphTree?.refresh(),
        get landedShown() { return changeGraphTree?.landedShown ?? false; },
        setShowLanded: (shown: boolean) => changeGraphTree?.setShowLanded(shown),
      },
    };
    changesView = changesTreeView;
    archiveView = archiveTreeView;
    templatesView = templatesTreeView;
    changeGraphView = changeGraphTreeView;
    context.subscriptions.push(
      changesTreeView,
      archiveTreeView,
      templatesTreeView,
      changeGraphTreeView,
      specsTreeView,
      // Read-only, same reasoning as the graph above: no command reads
      // this view's selection, since selecting a row only reveals it in
      // Changes and never mutates it (design.md, "nothing in the inbox
      // marks an item done").
      vscode.window.registerTreeDataProvider("openspecUiHumanOnlyInbox", humanOnlyInboxTree),
      registerFollowSelection({
        getWorkspaceRoot,
        changesView: changesTreeView,
        archiveView: archiveTreeView,
        changeGraphView: changeGraphTreeView,
      }),
      vscode.commands.registerCommand("openspec-ui.refresh", () => {
        // A person asked, so refs are fetched now, whatever the interval.
        changesTree?.refresh({ fetchNow: true });
        archiveTree?.refresh();
        specsTree?.refresh();
        templatesTree?.refresh();
        changeGraphTree?.refresh();
        humanOnlyInboxTree?.refresh();
      }),
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "openspec/**"),
    );
    const refreshTrees = (uri: vscode.Uri) => {
      changesTree?.refresh();
      // The archive is read again only for an event inside it. A run ticks
      // tasks.md in an active change many times, and each tick read every
      // archived change again (the-pipeline-reads-each-workspace-once).
      // Archiving a change creates its folder there, so that still counts.
      if (isUnderArchive(workspaceRoot, uri)) archiveTree?.refresh();
      specsTree?.refresh();
      templatesTree?.refresh();
      changeGraphTree?.refresh();
      humanOnlyInboxTree?.refresh();
    };
    context.subscriptions.push(
      watcher,
      watcher.onDidCreate(refreshTrees),
      watcher.onDidChange(refreshTrees),
      watcher.onDidDelete(refreshTrees),
    );
    // While the Changes view is visible, standings are read again once per
    // fetch interval, and the runs whenever a run's status record changes
    // (the-changes-views-see-a-run-start).
    context.subscriptions.push(followChangesView({ workspaceRoot, view: changesTreeView, tree: changesTree }));

    optionalServer = new OptionalServerManager(
      workspaceRoot,
      vscode.Uri.joinPath(context.extensionUri, "dist").fsPath,
    );
    if (readConfig().localServerEnabled) {
      void optionalServer.start();
    }

    auditLog = new FileAuditLog(auditLogPath(workspaceRoot));
    runners = buildDefaultAgentRunners({ workspaceRoot, auditLog });

    // Running one delegated item, from the row that names its agent.
    // Bound to `RUNNABLE_INBOX_ITEM_CONTEXT` in package.json, so a row
    // waiting on a person never shows it; the refusals in
    // `runDelegatedItem` are what catch the rest (an id the registry
    // does not carry, an item already ticked, a task list that moved
    // underneath the row). See a-delegated-item-runs-its-agent.
    const inboxTree = humanOnlyInboxTree;
    const inboxRoot = workspaceRoot;
    context.subscriptions.push(
      vscode.commands.registerCommand("openspec-ui.runDelegatedItem", async (item?: HumanOnlyInboxItemTreeItem) => {
        // This view is registered read-only (`registerTreeDataProvider`
        // exposes no selection), so the row has to come from the menu
        // that invoked the command.
        if (!item) {
          void vscode.window.showWarningMessage(
            "OpenSpec UI: run a delegated item from its own row in the Human-Only Inbox.",
          );
          return;
        }
        const agents = runners;
        if (!agents) {
          void vscode.window.showWarningMessage("OpenSpec UI: no workspace is open.");
          return;
        }
        try {
          const result = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `OpenSpec UI: running ${item.changeName} — ${item.text}`,
              cancellable: false,
            },
            () => runDelegatedItem({
              workspaceRoot: inboxRoot,
              changeName: item.changeName,
              lineNumber: item.lineNumber,
              resolveRunner: (agentId) => {
                const runner = resolveAgentRunner(agents, agentId);
                return runner === undefined ? undefined : liveRuns.runner(runner);
              },
              // The request and its reply go to the log the runners write to
              // (a-change-says-where-it-stands).
              ...(auditLog !== undefined ? { auditLog } : {}),
            }),
          );
          inboxTree?.reportOutcome(item, shortDelegatedItemOutcome(result));
          const refused = result.status === "refused" || result.gate.kind === "reverted";
          const stopped = result.status === "ran" && result.outcome !== "completed";
          const show = refused || stopped ? vscode.window.showWarningMessage : vscode.window.showInformationMessage;
          const lastStderr = result.status === "ran" ? result.lastStderr : undefined;
          if (lastStderr === undefined) {
            void show(`OpenSpec UI: ${result.message}`);
          } else {
            // What the agent last said is one click away rather than lost
            // behind an exit code (a-delegated-run-says-what-happened).
            void show(`OpenSpec UI: ${result.message}`, "Show output").then((choice) => {
              if (choice !== "Show output") return;
              outputChannel.appendLine(`${item.changeName} — ${item.text}: what the agent last said`);
              outputChannel.appendLine(lastStderr);
              outputChannel.show(true);
            });
          }
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          inboxTree?.reportOutcome(item, "the run could not be started");
          void vscode.window.showErrorMessage(`OpenSpec UI: failed to run delegated item — ${reason}`);
        }
      }),
      // A person says a run was theirs, from the row of the key that signed
      // it. Which key that enrols, and whether it may, is core's
      // (a-run-is-signed-by-its-person).
      vscode.commands.registerCommand("openspec-ui.confirmEnrolment", async (row?: EnrolmentRequestTreeItem) => {
        if (!row) {
          void vscode.window.showWarningMessage(
            "OpenSpec UI: confirm an enrolment from its own row in the Human-Only Inbox.",
          );
          return;
        }
        const label = await vscode.window.showInputBox({
          title: `It was me: ${row.request.label}`,
          prompt: "The name this key's runs will be signed by",
          value: row.request.gitAuthor ?? row.request.label,
        });
        if (label === undefined) return;
        try {
          const entry = await confirmEnrolmentFor(inboxRoot, row.keyId, label.trim().length > 0 ? { label } : {});
          inboxTree?.refresh();
          void vscode.window.showInformationMessage(`OpenSpec UI: enrolled — its runs read as signed by ${entry.label}, verified.`);
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`OpenSpec UI: not enrolled — ${reason}`);
        }
      }),
    );

    const packageJsonWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, "package.json"),
    );
    const refreshCheckContexts = () => void updateCheckContexts(workspaceRoot);
    context.subscriptions.push(
      packageJsonWatcher,
      packageJsonWatcher.onDidCreate(refreshCheckContexts),
      packageJsonWatcher.onDidChange(refreshCheckContexts),
      packageJsonWatcher.onDidDelete(refreshCheckContexts),
    );
  } else {
    void vscode.window.showWarningMessage("OpenSpec UI: no folder open — open a workspace to use it.");
  }
  await updateCheckContexts(workspaceRoot);

  // One `HarnessChainRunner` for the extension host's lifetime — a chain
  // is stateful (a paused checkpoint lives between webview messages, see
  // harness-chain-runner.ts), so it must be reused across every message,
  // not reconstructed per command. `runners` resolves lazily the same way
  // `resolveRunner` above does — there is no workspace-independent set of
  // agents to bind at construction time.
  const chainRunner = new HarnessChainRunner({
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    // Both audit dependencies come from one place, so that "the chain
    // writes its spend but reads nothing back" cannot be introduced by
    // editing one of two lines. See chain-runner-audit-deps.ts.
    ...buildChainRunnerAuditDeps(auditLog),
    // An answer to a question the operator asked is written where the key
    // is, and only once a stage has said something
    // (the-operator-can-say-something-to-a-run). The status directory is
    // resolved when the first answer is due, not now: resolving it needs
    // git, and most runs are never asked anything.
    ...(workspaceRoot !== undefined
      ? {
        answerMessage: chainAnswerWriter({
          workspaceRoot,
          statusDirectory: () => resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot),
        }),
      }
      : {}),
  });

  // The person's own side of the signed channel: an answer a run wrote is
  // brought to whoever asked, rather than left in a directory nobody opens
  // (the-operator-can-say-something-to-a-run).
  if (workspaceRoot !== undefined) {
    const answers = new AnswerWatcher({
      myKeyId: async () => (await loadOrCreateMachineKey().catch(() => undefined))?.keyId,
      messageDirectory: async () => messageDirectoryBeside(
        await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot),
      ),
      roster: async () => rosterOf((await readAgentRoster(
        rosterDirectoryBeside(await resolveAgentStatusDirectory(createGitWrapper({ cwd: workspaceRoot }), workspaceRoot)),
      )).entries),
      readMessages: readMessagesFor,
      forget: forgetMessage,
      show: (message) => { void vscode.window.showInformationMessage(describeAnswer(message)); },
    });
    answers.start();
    context.subscriptions.push({ dispose: () => answers.dispose() });
  }

  const aiPanel = new AiPanel({
    extensionUri: context.extensionUri,
    runController,
    resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    chainRunner,
    getLocalServerUrl: () => optionalServer?.launchUrl,
    scheduler,
  });
  // The harness settings, one panel per file: the global one, and one per
  // change. See a-change-is-configured-from-the-change.
  const harnessSettingsPanel = new HarnessSettingsPanel({
    extensionUri: context.extensionUri,
    getWorkspaceRoot,
  });
  // The Pipeline, the same picture the standalone shell draws, in a panel
  // of its own. See the-pipeline-opens-in-vs-code.
  const pipelinePanel = new PipelinePanel({
    extensionUri: context.extensionUri,
    getWorkspaceRoot,
    getLocalServerUrl: () => optionalServer?.launchUrl,
    liveRuns,
    // A card's Start opens the change's run dialog, the one way in to run
    // (a-change-is-run-from-its-card).
    runChange: async (changeName) => {
      await vscode.commands.executeCommand("openspec-ui.runWithHarness", changeName);
    },
    // After the folded row archived what had landed, the views are drawn
    // again so they stop listing it (what-is-finished-is-tidied-away).
    refreshTrees: () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
      changeGraphTree?.refresh();
    },
    // A card's answer or stop, for a run the panel has already checked this
    // host holds: to the chain runner when it holds the run, otherwise to
    // the runner the run was started on. The run's own stream reports what
    // follows.
    sendRunControl: (control) => sendPipelineRunControl(control, {
      liveRuns,
      chainRunner,
      resolveRunner: (agentId) => (runners ? resolveAgentRunner(runners, agentId) : undefined),
    }),
    // As `openspec-ui.revealInChanges` reveals a row: an item built from
    // the change the host found, never from the message.
    revealChange: async (change) => {
      await changesView?.reveal(
        new ChangeTreeItem(change.name, change.path, change.state, change.artifacts, false),
        { select: true, focus: true, expand: true },
      );
    },
  });
  context.subscriptions.push(
    vscode.commands.registerCommand("openspec-ui.openPipeline", () => pipelinePanel.show()),
  );

  const commandsDeps = {
    getWorkspaceRoot,
    runController,
    outputChannel,
    revealAiPanel: (panelContext: AiPanelContext | undefined) => aiPanel.reveal(panelContext),
    showHarnessSettings: (changeName?: string) => {
      if (changeName === undefined) harnessSettingsPanel.showGlobal();
      else harnessSettingsPanel.showChange(changeName);
    },
    refreshTrees: () => {
      changesTree?.refresh();
      archiveTree?.refresh();
      specsTree?.refresh();
      changeGraphTree?.refresh();
    },
    refreshTemplatesTree: () => templatesTree?.refresh(),
    scheduler,
    implementationSessions,
    changesView,
    archiveView,
    templatesView,
    changeGraphView,
    filters,
    // Undefined without an open workspace, where there is nowhere for an
    // audit log to live — the same real case `chain-runner-audit-deps.ts`
    // treats as absent rather than as a reader over nothing.
    ...(auditLog ? { readAuditEntries: () => (auditLog as FileAuditLog).readEntries() } : {}),
  } satisfies CommandsDeps;

  registerCommands(context, commandsDeps);
  // The run dialog lives in the panel now, so the two answers only this
  // host can carry out — opening a chat session, writing a named
  // configuration — come back as messages. The handler is built from the
  // same deps the commands use, because it needs the same things. See
  // run-dialog-in-the-panel.
  aiPanel.onRunChoice((choice, choiceContext) => {
    void createRunChoiceHandler(commandsDeps)(choice, choiceContext);
  });
  // A scheduled run starts when its time comes, or when this editor is
  // opened after it has passed — which is the case the feature exists
  // for. See a-run-can-be-scheduled.
  context.subscriptions.push(watchScheduledRuns({
    getWorkspaceRoot,
    revealAiPanel: (panelContext) => aiPanel.reveal(panelContext),
    outputChannel,
  }));
  registerOpenSpecChatParticipant(context, { getWorkspaceRoot });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("openspec-ui.transport.localServer.enabled") && optionalServer) {
        if (readConfig().localServerEnabled) {
          await optionalServer.start();
        } else {
          await optionalServer.stop();
        }
      }
      if (e.affectsConfiguration("openspec-ui.checks")) {
        await updateCheckContexts(workspaceRoot);
      }
    }),
  );

  return {
    getRunners: () => runners,
    runController,
    optionalServer,
    getDashboardContext: () => aiPanel.getContext(),
    changesTree,
    templatesTree,
    deliverWebviewCommand: (command) => aiPanel.deliverWebviewCommandForTesting(command),
    deliverWebviewRunChoice: (choice) => aiPanel.deliverWebviewRunChoiceForTesting(choice),
    deliverWebviewRequest: (request, changeName) => harnessSettingsPanel.deliverRequestForTesting(request, changeName),
    onWebviewResponse: (listener) => harnessSettingsPanel.onResponseForTesting(listener),
    onHarnessSettingsRequest: (listener) => harnessSettingsPanel.onRequestForTesting(listener),
    getHarnessSettingsTitle: (changeName) => harnessSettingsPanel.getTitleForTesting(changeName),
    getHarnessSettingsHtml: (changeName) => harnessSettingsPanel.getHtmlForTesting(changeName),
    checkScheduledRunsOnce: async () => {
      const lines: string[] = [];
      await checkScheduleOnce({
        getWorkspaceRoot,
        revealAiPanel: (panelContext) => aiPanel.reveal(panelContext),
        outputChannel: { appendLine: (line) => { lines.push(line); outputChannel.appendLine(line); } },
      });
      return lines;
    },
    getWebviewHtml: () => aiPanel.getWebviewHtmlForTesting(),
    onWebviewEvent: (listener) => aiPanel.onWebviewEventForTesting(listener),
  };
}

export async function deactivate(): Promise<void> {
  await optionalServer?.stop();
}
