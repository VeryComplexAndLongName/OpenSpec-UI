// VS Code webviews: Metro's dark palette follows the editor's theme (the-web-ui-
// wears-metro design decision 6; ADR 0030 decision 5). VS Code puts
// `vscode-light`, `vscode-dark`, `vscode-high-contrast` or
// `vscode-high-contrast-light` on a webview's body, and changes it in place when
// a person switches theme. Every colour Metro reads is also set from
// `--vscode-*` by `vscodeThemeCss`, so `dark-side` only decides what an unset
// variable would fall back to, and never a colour of its own.

import { useEffect, useState } from "react";

export function isDarkEditorTheme(classes: Pick<DOMTokenList, "contains">): boolean {
  if (classes.contains("vscode-high-contrast-light")) return false;
  return classes.contains("vscode-dark") || classes.contains("vscode-high-contrast");
}

const documentBody = (): HTMLElement | null => (typeof document === "undefined" ? null : document.body);

/** Whether the editor's current theme is dark or high contrast, kept current
 * as the body's class changes. */
export function useEditorDarkTheme(body: () => HTMLElement | null = documentBody): boolean {
  const [dark, setDark] = useState(() => {
    const element = body();
    return element ? isDarkEditorTheme(element.classList) : false;
  });

  useEffect(() => {
    const element = body();
    if (!element || typeof MutationObserver === "undefined") return undefined;
    const update = () => setDark(isDarkEditorTheme(element.classList));
    const observer = new MutationObserver(update);
    observer.observe(element, { attributes: true, attributeFilter: ["class"] });
    update();
    return () => observer.disconnect();
  }, [body]);

  return dark;
}

/** A webview entry's root classes: its own, Metro's root, and Metro's dark
 * palette when the editor is dark. */
export function metroRootClassName(ownClassName: string, dark: boolean): string {
  return dark ? `${ownClassName} openspec-metro dark-side` : `${ownClassName} openspec-metro`;
}
