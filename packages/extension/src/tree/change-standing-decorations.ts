// Where a change stands, said in the Changes tree
// (a-change-says-where-it-stands).
//
// A tree row's description carries the word itself. This gives the row a
// one-character badge and the word as a tooltip, through a file decoration
// on a URI in the extension's own scheme.
//
// The colour is on the row's icon, not here: VS Code applies a decoration's
// `color` to the label, and a dozen rows of coloured words read as if the
// colour were the subject (the-icon-carries-the-colour). The reason it was
// on the label - that an icon tint alone is lost in several themes and says
// nothing to a screen reader - is answered rather than overruled: the word
// is in the description and in the tooltip, and the badge is a letter, not
// a hue. The map itself stays here, beside that reasoning, and the tree
// asks for it.

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

/** The theme colour a standing is drawn in, or `undefined` where the
 * standing carries none. One map, asked for by whoever draws: two would
 * drift, and the one that drifted would be the one nobody reads. */
export function standingThemeColour(colour: ChangeStateColour): vscode.ThemeColor | undefined {
  const named = THEME_COLOUR[colour];
  return named === undefined ? undefined : new vscode.ThemeColor(named);
}

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
    // No `color`: it would tint the label and the badge, and the colour
    // belongs to the icon (the-icon-carries-the-colour).
    return {
      tooltip: state.word,
      ...(state.badge !== undefined ? { badge: state.badge } : {}),
    };
  }
}
