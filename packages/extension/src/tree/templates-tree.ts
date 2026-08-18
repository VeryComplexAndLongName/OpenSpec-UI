import * as vscode from "vscode";
import { listBuiltInTemplates, listProjectTemplates, type CatalogTemplate } from "@openspec-ui/core";

export class TemplateTreeItem extends vscode.TreeItem {
  constructor(public readonly template: CatalogTemplate) {
    super(template.manifest.title, vscode.TreeItemCollapsibleState.None);
    this.id = `template:${template.origin}:${template.manifest.id}`;
    this.description = template.manifest.forkedFrom ? `${template.manifest.category} · customized` : template.manifest.category;
    this.contextValue = template.origin === "built-in" ? "openspec-ui.builtInTemplate" : "openspec-ui.projectTemplate";
    this.iconPath = new vscode.ThemeIcon(template.origin === "built-in" ? "library" : "file-code");
    this.tooltip = template.manifest.summary;
  }
}

export class TemplateGroupTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly templates: CatalogTemplate[]) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.id = `template-group:${label}`;
    this.contextValue = "openspec-ui.templateGroup";
  }
}

export class EmptyTemplatesTreeItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `empty-templates:${label}`;
    this.description = description;
    this.contextValue = "openspec-ui.empty";
    this.iconPath = new vscode.ThemeIcon("info");
  }
}

export type TemplatesTreeItem = TemplateGroupTreeItem | TemplateTreeItem | EmptyTemplatesTreeItem;

export class TemplatesTreeProvider implements vscode.TreeDataProvider<TemplatesTreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly workspaceRoot: string) { }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: TemplatesTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TemplatesTreeItem): Promise<TemplatesTreeItem[]> {
    if (element instanceof TemplateGroupTreeItem) {
      if (element.templates.length === 0) {
        return [new EmptyTemplatesTreeItem("No templates", "None in this group yet")];
      }
      return element.templates.map((template) => new TemplateTreeItem(template));
    }
    if (element) return [];

    const [builtIn, project] = await Promise.all([
      Promise.resolve(listBuiltInTemplates()),
      listProjectTemplates(this.workspaceRoot),
    ]);
    return [
      new TemplateGroupTreeItem("Built-in", builtIn),
      new TemplateGroupTreeItem("Project", project),
    ];
  }
}
