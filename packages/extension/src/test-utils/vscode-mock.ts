// Минимальный мок `vscode` API для юнит-тестов вне реального VS Code host'а.
// Живой прогон внутри настоящего VS Code — src/test/ (см. tasks.md 4.1/4.2),
// это не заменяет его, а покрывает то, что можно проверить без него.

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

export function createVscodeMock() {
  const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();

  const mock = {
    TreeItemCollapsibleState,
    ProgressLocation,
    ViewColumn,
    EventEmitter,
    ThemeIcon,
    TreeItem,
    Uri,
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
      showTextDocument: vi.fn(),
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
      openTextDocument: vi.fn(async ({ language, content }: { language: string; content: string }) => ({
        uri: Uri.file(`/virtual/${language}.md`),
        getText: () => content,
      })),
    },
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
