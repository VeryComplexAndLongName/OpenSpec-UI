import * as vscode from "vscode";
import { listBuiltInTemplates, listProjectTemplates, type CatalogTemplate } from "@openspec-ui/core";

export class TemplateTreeItem extends vscode.TreeItem {
  constructor(public readonly template: CatalogTemplate) {
    super(template.manifest.title, vscode.TreeItemCollapsibleState.None);
    this.id = `template:${template.origin}:${template.manifest.id}`;
    this.description = template.manifest.forkedFrom ? "customized" : undefined;
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

/** Intermediate grouping level under a `TemplateGroupTreeItem` — one per
 * distinct `manifest.category` value among that origin's templates,
 * alphabetically sorted. A template is never a direct child of the
 * origin group. See openspec/changes/templates-grouped-by-category/. */
export class TemplateCategoryGroupTreeItem extends vscode.TreeItem {
  constructor(
    public readonly originLabel: string,
    public readonly category: string,
    public readonly templates: CatalogTemplate[],
  ) {
    super(category, vscode.TreeItemCollapsibleState.Collapsed);
    this.id = `template-category-group:${originLabel}:${category}`;
    this.description = `${templates.length}`;
    this.contextValue = "openspec-ui.templateCategoryGroup";
    this.iconPath = new vscode.ThemeIcon("folder");
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

export type TemplatesTreeItem =
  | TemplateGroupTreeItem
  | TemplateCategoryGroupTreeItem
  | TemplateTreeItem
  | EmptyTemplatesTreeItem;

function groupByCategory(originLabel: string, templates: CatalogTemplate[]): TemplateCategoryGroupTreeItem[] {
  const byCategory = new Map<string, CatalogTemplate[]>();
  for (const template of templates) {
    const bucket = byCategory.get(template.manifest.category);
    if (bucket) {
      bucket.push(template);
    } else {
      byCategory.set(template.manifest.category, [template]);
    }
  }
  return [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, categoryTemplates]) => new TemplateCategoryGroupTreeItem(originLabel, category, categoryTemplates));
}

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
      return groupByCategory(element.label as string, element.templates);
    }
    if (element instanceof TemplateCategoryGroupTreeItem) {
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
