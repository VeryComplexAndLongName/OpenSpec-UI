// 1.2 TreeDataProvider для Archive. `openspec list --json` не гарантированно
// перечисляет заархивированные changes (это история, не текущая работа) —
// поэтому здесь напрямую читается `openspec/changes/archive/`, а состояние
// каждого элемента подтверждается через `readChangeState` (тот же источник
// правды, что и для Changes).

import path from "node:path";
import { readdir } from "node:fs/promises";
import type { Dirent } from "node:fs";
import * as vscode from "vscode";
import { readChangeState } from "@openspec-ui/core";
import { ChangeTreeItem } from "./changes-tree.js";

export class ArchiveTreeProvider implements vscode.TreeDataProvider<ChangeTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) {}

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: ChangeTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<ChangeTreeItem[]> {
    const archiveDir = path.join(this.workspaceRoot, "openspec", "changes", "archive");
    let entries: Dirent<string>[];
    try {
      entries = await readdir(archiveDir, { withFileTypes: true, encoding: "utf8" });
    } catch {
      return [];
    }

    const items: ChangeTreeItem[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const changeDir = path.join(archiveDir, entry.name);
      const state = await readChangeState(changeDir);
      items.push(new ChangeTreeItem(entry.name, changeDir, state));
    }
    return items;
  }
}
