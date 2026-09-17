// What a panel that frames the local server's shell gives the framed page
// and its own outer document (the-pipeline-answers-while-a-run-works 5.7).
//
// A page served over http from the local server cannot read the editor's
// colours, and it decided light or dark from the operating system instead:
// a dark editor showed a light Pipeline. The panel now names the editor's
// light or dark in the page's address.
//
// The outer document sizes its iframe with an inline style. Under
// `default-src 'none'` with no `style-src` that style was refused, so the
// iframe kept the browser's default 300 by 150 pixels in the corner of the
// tab. It is allowed by the same nonce as the document's script.

import * as vscode from "vscode";

/** The URL parameter the shell reads its light or dark from when framed. */
export const EMBED_THEME_PARAMETER = "theme";

/** Light or dark, from the editor's active colour theme: a light or
 * high-contrast light theme is light, every other kind dark. */
export function editorThemeName(): "light" | "dark" {
  const kind = vscode.window.activeColorTheme?.kind;
  return kind === vscode.ColorThemeKind.Light || kind === vscode.ColorThemeKind.HighContrastLight ? "light" : "dark";
}

/** The style directive and the stylesheet that fill the panel with its
 * iframe, allowed by `nonce`. */
export function frameFillingStyle(nonce: string): { directive: string; element: string } {
  return {
    directive: `style-src 'nonce-${nonce}';`,
    // The iframe is a block, and the outer document does not scroll: an
    // inline iframe sits on a text baseline, and the few pixels under it gave
    // the tab scrollbars of its own beside the framed page's.
    element: `<style nonce="${nonce}">html, body, iframe { height: 100%; width: 100%; margin: 0; border: 0; } html, body { overflow: hidden; } iframe { display: block; }</style>`,
  };
}
