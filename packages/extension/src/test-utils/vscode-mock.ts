// Minimal mock of the `vscode` API for unit tests outside a real VS Code
// host. A live run inside actual VS Code is src/test/ (see tasks.md
// 4.1/4.2) — this does not replace it, it covers what can be verified
// without it.

import { vi } from "vitest";

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export enum ProgressLocation {
  Notification = 15,
}

export enum ViewColumn {
  Beside = -2,
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3,
}

export class Selection {
  constructor(public readonly anchor: unknown, public readonly active: unknown) { }
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  readonly event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { } };
  };
  fire(value: T): void {
    for (const listener of this.listeners) listener(value);
  }
}

export class ThemeIcon {
  constructor(public readonly id: string) { }
}

export class TreeItem {
  label?: string;
  description?: string;
  contextValue?: string;
  iconPath?: unknown;
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(label: string, public collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
  }
}

export class Uri {
  private constructor(public readonly fsPath: string) { }
  static file(fsPath: string): Uri {
    return new Uri(fsPath);
  }
  static joinPath(base: Uri, ...segments: string[]): Uri {
    return new Uri([base.fsPath, ...segments].join("/"));
  }
  toString(): string {
    return `file://${this.fsPath}`;
  }
}

/** Minimal in-memory document store backing `workspace.openTextDocument(uri)`
 * and `WorkspaceEdit`/`applyEdit`, for commands that insert text into a
 * file-backed document (e.g. `openspec-ui.copyTasksAsTemplate`) without a
 * real VS Code host. Only supports end-of-document inserts — sufficient for
 * what this codebase's commands actually do; not a general editor model. */
export class WorkspaceEdit {
  readonly _inserts: Array<{ uri: Uri; newText: string }> = [];
  insert(uri: Uri, _position: unknown, newText: string): void {
    this._inserts.push({ uri, newText });
  }
}

export function createVscodeMock() {
  const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
  const documentContents = new Map<string, string>();

  const mock = {
    TreeItemCollapsibleState,
    ProgressLocation,
    ViewColumn,
    TextEditorRevealType,
    Selection,
    EventEmitter,
    ThemeIcon,
    TreeItem,
    Uri,
    WorkspaceEdit,
    window: {
      createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        dispose: vi.fn(),
      })),
      showQuickPick: vi.fn(),
      showInputBox: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showTextDocument: vi.fn(async (document: unknown) => ({
        document,
        selection: undefined as unknown,
        revealRange: vi.fn(),
      })),
      withProgress: vi.fn(async (_options: unknown, task: (progress: unknown, token: unknown) => unknown) => {
        const token = { onCancellationRequested: vi.fn(() => ({ dispose: vi.fn() })) };
        return task({ report: vi.fn() }, token);
      }),
      registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
      createWebviewPanel: vi.fn(),
      createTerminal: vi.fn(() => ({ show: vi.fn(), sendText: vi.fn(), dispose: vi.fn() })),
    },
    workspace: {
      workspaceFolders: undefined as { uri: Uri }[] | undefined,
      getConfiguration: vi.fn(() => ({ get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue) })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      openTextDocument: vi.fn(async (arg: Uri | { language: string; content: string }) => {
        if (arg instanceof Uri) {
          const uri = arg;
          return {
            uri,
            getText: () => documentContents.get(uri.fsPath) ?? "",
            get lineCount() {
              return Math.max(1, (documentContents.get(uri.fsPath) ?? "").split("\n").length);
            },
            lineAt: (line: number) => {
              const text = (documentContents.get(uri.fsPath) ?? "").split(/\r?\n/)[line] ?? "";
              return {
                text,
                range: { start: { line, character: 0 }, end: { line, character: text.length } },
              };
            },
          };
        }
        const { language, content } = arg;
        return { uri: Uri.file(`/virtual/${language}.md`), getText: () => content };
      }),
      applyEdit: vi.fn(async (edit: WorkspaceEdit) => {
        for (const { uri, newText } of edit._inserts) {
          documentContents.set(uri.fsPath, (documentContents.get(uri.fsPath) ?? "") + newText);
        }
        return true;
      }),
    },
    _documentContents: documentContents,
    commands: {
      registerCommand: vi.fn((id: string, handler: (...args: unknown[]) => unknown) => {
        registeredCommands.set(id, handler);
        return { dispose: vi.fn() };
      }),
      executeCommand: vi.fn(),
    },
    extensions: {
      getExtension: vi.fn(),
    },
    _registeredCommands: registeredCommands,
  };

  return mock;
}

export type VscodeMock = ReturnType<typeof createVscodeMock>;
