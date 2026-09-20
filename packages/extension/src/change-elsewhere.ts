// Reading a change that is worked in another working directory
// (changes-shows-one-change-and-who-owns-it).
//
// This checkout has its own copy of every change that was active when its
// branch was cut, and that copy is a snapshot: what the other agent has
// actually written this morning is in their directory, uncommitted.
//
// It is served here through a content provider on a scheme of this
// extension's own. A document on such a scheme has nowhere to be saved
// to, so read-only is a property of where the text came from rather than
// a flag somebody can forget to set - and a save that did land would land
// in another agent's index.

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import {
  changeOwnership,
  describeOwnership,
  discoverOpenSpecWorkspace,
  surveyWorktrees,
  type ChangeOwnership,
  type WorktreeSurvey,
} from "@openspec-ui/core";
import { ChangeTreeItem } from "./tree/changes-tree.js";

export const ELSEWHERE_SCHEME = "openspec-ui-elsewhere";

/** The documents offered, in the order a change is read in. */
const ARTIFACTS = ["proposal.md", "design.md", "tasks.md"] as const;

/** The URI a document is served on. The real path rides in the query,
 * where nothing but this provider reads it; the path is what the tab
 * says, so it names the change, the directory and that it is read-only. */
export function elsewhereUri(options: {
  changeName: string;
  label: string;
  filePath: string;
  artifact: string;
}): vscode.Uri {
  const stem = options.artifact.endsWith(".md") ? options.artifact.slice(0, -3) : options.artifact;
  return vscode.Uri.from({
    scheme: ELSEWHERE_SCHEME,
    path: `/${options.changeName} ${stem} (${options.label}, read-only).md`,
    query: options.filePath,
  });
}

/** Serves another working directory's copy, and says so plainly where it
 * cannot. A missing file is a sentence in the document, not an error
 * notification: the other agent may simply not have written that artifact
 * yet, which is a fact about their change rather than a fault. */
export class ChangeElsewhereProvider implements vscode.TextDocumentContentProvider {
  constructor(
    private readonly readFile: (filePath: string) => Promise<string> = (filePath) => fs.readFile(filePath, "utf8"),
  ) { }

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const filePath = uri.query;
    try {
      return await this.readFile(filePath);
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      return `That working directory's copy could not be read.

${filePath}

${why}
`;
    }
  }
}

export interface ElsewhereDeps {
  getWorkspaceRoot: () => string | undefined;
  /** Reveals a change this checkout has. Absent before a workspace is
   * open. */
  reveal?: (item: ChangeTreeItem) => Thenable<void>;
  /** Test seam for the survey. */
  survey?: (workspaceRoot: string) => Promise<WorktreeSurvey>;
}

async function surveyOf(deps: ElsewhereDeps, workspaceRoot: string): Promise<WorktreeSurvey | undefined> {
  try {
    return await (deps.survey ?? ((root: string) => surveyWorktrees({ workspaceRoot: root })))(workspaceRoot);
  } catch {
    // A survey that could not be taken leaves every change reading as
    // nobody's, which is what this checkout can honestly say.
    return undefined;
  }
}

/** Where a change is worked, as an item carries it or as the survey says.
 * An item carries what the tree drew; a name from the picker does not. */
function ownershipOf(
  item: ChangeTreeItem | undefined,
  changeName: string,
  survey: WorktreeSurvey | undefined,
): ChangeOwnership {
  return item?.ownership ?? changeOwnership(changeName, survey);
}

async function openArtifact(changeName: string, directory: { label: string; path: string }): Promise<void> {
  const chosen = await vscode.window.showQuickPick(
    ARTIFACTS.map((artifact) => ({ label: artifact, description: `in ${directory.label}` })),
    { title: `${changeName}, as ${directory.label} has it`, placeHolder: "Read-only: this is their copy, not yours" },
  );
  if (!chosen) return;
  const filePath = path.join(directory.path, "openspec", "changes", changeName, chosen.label);
  const uri = elsewhereUri({ changeName, label: directory.label, filePath, artifact: chosen.label });
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, { preview: true });
}

export function registerChangeElsewhere(context: vscode.ExtensionContext, deps: ElsewhereDeps): void {
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(ELSEWHERE_SCHEME, new ChangeElsewhereProvider()),

    vscode.commands.registerCommand("openspec-ui.readChangeElsewhere", async (item?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot || !item) return;
      const ownership = ownershipOf(item, item.changeName, await surveyOf(deps, workspaceRoot));
      if (!("path" in ownership)) {
        void vscode.window.showInformationMessage(
          `OpenSpec UI: ${item.changeName} is not worked in another working directory,`
          + " so this checkout's copy is the one to read.",
        );
        return;
      }
      await openArtifact(item.changeName, ownership);
    }),

    vscode.commands.registerCommand("openspec-ui.openChangeDirectory", async (item?: ChangeTreeItem) => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot || !item) return;
      const ownership = ownershipOf(item, item.changeName, await surveyOf(deps, workspaceRoot));
      if (!("path" in ownership)) {
        void vscode.window.showInformationMessage(`OpenSpec UI: ${item.changeName} is worked in this working directory.`);
        return;
      }
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(ownership.path), { forceNewWindow: true });
    }),

    vscode.commands.registerCommand("openspec-ui.pickChange", async () => {
      const workspaceRoot = deps.getWorkspaceRoot();
      if (!workspaceRoot) return;
      const survey = await surveyOf(deps, workspaceRoot);
      const workspace = await discoverOpenSpecWorkspace(workspaceRoot, { changes: "active" });
      const here = new Set(workspace.changes.map((change) => change.name));
      const entries = workspace.changes.map((change) => {
        const ownership = changeOwnership(change.name, survey);
        return {
          label: change.name,
          description: describeOwnership(ownership) ?? "this working directory's own",
          ownership,
          inThisCheckout: true,
          // This directory's own change first: the window is about it.
          rank: ownership.kind === "here" ? 0 : ownership.kind === "nobody" ? 1 : 2,
        };
      });
      // A change proposed after this directory was cut is in no row above,
      // and is the one a reader is most likely to be looking for.
      for (const directory of survey?.directories ?? []) {
        if (directory.isThis || directory.belongsTo === undefined || here.has(directory.belongsTo)) continue;
        entries.push({
          label: directory.belongsTo,
          description: `worked in ${directory.label}, and not in this checkout`,
          ownership: changeOwnership(directory.belongsTo, survey),
          inThisCheckout: false,
          rank: 3,
        });
      }
      entries.sort((left, right) => left.rank - right.rank);
      const chosen = await vscode.window.showQuickPick(entries, {
        title: "Active changes, and where each is worked",
        placeHolder: "Pick a change",
      });
      if (!chosen) return;
      if (chosen.inThisCheckout && deps.reveal) {
        const change = workspace.changes.find((candidate) => candidate.name === chosen.label);
        if (change) {
          await deps.reveal(new ChangeTreeItem(
            change.name,
            change.path,
            change.state,
            change.artifacts,
            false,
            undefined,
            change.schema,
            chosen.ownership,
          ));
          return;
        }
      }
      if ("path" in chosen.ownership) await openArtifact(chosen.label, chosen.ownership);
    }),
  );
}
