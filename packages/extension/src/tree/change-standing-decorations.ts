// The colour of a change's state word in the Changes tree
// (a-change-says-where-it-stands).
//
// A tree row's description carries the word itself. This gives the row a
// colour from the theme's chart colours, a one-character badge and the word
// as a tooltip, through a file decoration on a URI in the extension's own
// scheme. An icon tint alone is lost in several themes and says nothing to a
// screen reader, so the colour only ever agrees with a word that is written.

import * as vscode from "vscode";
import type { ChangeStateColour, DescribedChangeState } from "@openspec-ui/core";

export const CHANGE_URI_SCHEME = "openspec-ui-change";

/** The URI a change's row carries, so its decoration can find it. */
export function changeUri(changeName: string): vscode.Uri {
  return vscode.Uri.from({ scheme: CHANGE_URI_SCHEME, path: `/${changeName}` });
}

const THEME_COLOUR: Record<ChangeStateColour, string | undefined> = {
  settled: "charts.green",
  ahead: "charts.yellow",
  now: "charts.blue",
  failed: "charts.red",
  deleted: "disabledForeground",
  none: undefined,
};

export class ChangeStandingDecorations implements vscode.FileDecorationProvider {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this.emitter.event;
  private states: ReadonlyMap<string, DescribedChangeState> = new Map();

  /** Takes the words just read, and asks every row to be decorated again. */
  update(states: ReadonlyMap<string, DescribedChangeState>): void {
    this.states = states;
    this.emitter.fire(undefined);
  }

  provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (uri.scheme !== CHANGE_URI_SCHEME) return undefined;
    const state = this.states.get(uri.path.replace(/^\//u, ""));
    if (state === undefined) return undefined;
    const colour = THEME_COLOUR[state.colour];
    return {
      tooltip: state.word,
      ...(state.badge !== undefined ? { badge: state.badge } : {}),
      ...(colour !== undefined ? { color: new vscode.ThemeColor(colour) } : {}),
    };
  }
}
