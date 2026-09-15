// The standalone shell's light and dark theme (the-web-ui-wears-metro design
// decision 5; ADR 0030 decision 5). A stored choice wins. Without one, the
// system's `prefers-color-scheme` decides, and a change to it is followed.
// Storage that cannot be read or written falls back to the system and never
// throws: a private window or a blocked origin must still draw the shell.
//
// VS Code webviews do not use this. Their theme is the editor's.

import { useCallback, useEffect, useState } from "react";

export type ShellTheme = "light" | "dark";

/** Where the choice is remembered, in that browser. */
export const THEME_STORAGE_KEY = "openspec-ui.theme";

/** The media query the system preference is read from. */
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** The attribute on the document element that the shell's dark tokens key
 * on. It sits on the document, not the app root, because `body`'s own
 * ground is drawn from those tokens too. */
export const THEME_ATTRIBUTE = "data-openspec-theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;
type SchemeQuery = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

export interface ThemeEnvironment {
  /** Called on each access: reading `window.localStorage` can itself throw. */
  storage: () => ThemeStorage;
  matchMedia: (query: string) => SchemeQuery | undefined;
  documentElement: () => HTMLElement | undefined;
}

export const browserThemeEnvironment: ThemeEnvironment = {
  storage: () => window.localStorage,
  matchMedia: (query) => (typeof window.matchMedia === "function" ? window.matchMedia(query) : undefined),
  documentElement: () => (typeof document === "undefined" ? undefined : document.documentElement),
};

export function readStoredTheme(storage: () => ThemeStorage): ShellTheme | undefined {
  try {
    const value = storage().getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Whether the choice was remembered. It still applies for this page when not. */
export function storeTheme(storage: () => ThemeStorage, theme: ShellTheme): boolean {
  try {
    storage().setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function resolveTheme(stored: ShellTheme | undefined, systemPrefersDark: boolean): ShellTheme {
  return stored ?? (systemPrefersDark ? "dark" : "light");
}

function systemPrefersDark(environment: ThemeEnvironment): boolean {
  try {
    return environment.matchMedia(DARK_SCHEME_QUERY)?.matches ?? false;
  } catch {
    return false;
  }
}

export function useStandaloneTheme(environment: ThemeEnvironment = browserThemeEnvironment): {
  theme: ShellTheme;
  toggle: () => void;
} {
  const [stored, setStored] = useState(() => readStoredTheme(environment.storage));
  const [systemDark, setSystemDark] = useState(() => systemPrefersDark(environment));

  useEffect(() => {
    let query: SchemeQuery | undefined;
    try {
      query = environment.matchMedia(DARK_SCHEME_QUERY);
    } catch {
      query = undefined;
    }
    if (!query) return undefined;
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [environment]);

  const theme = resolveTheme(stored, systemDark);

  useEffect(() => {
    environment.documentElement()?.setAttribute(THEME_ATTRIBUTE, theme);
  }, [environment, theme]);

  const toggle = useCallback(() => {
    const next: ShellTheme = theme === "dark" ? "light" : "dark";
    storeTheme(environment.storage, next);
    setStored(next);
  }, [environment, theme]);

  return { theme, toggle };
}
