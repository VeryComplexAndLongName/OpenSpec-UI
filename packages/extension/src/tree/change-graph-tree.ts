import * as vscode from "vscode";
import { landedBranches, readChangeGraph, type ChangeGraph, type ChangeGraphNode } from "@openspec-ui/core";
import { EmptyTreeItem } from "./changes-tree.js";
import { ViewFilterState } from "./view-filter-state.js";

/** A change as it appears in the relation view.
 *
 * `id` carries the path it was reached by, not just the change id: a
 * change with more than one parent appears under each, and VS Code needs
 * distinct ids for rows that coexist. Dropping an edge to keep ids unique
 * would hide half of why such a change exists — the relation is a DAG and
 * this is a rendering of it.
 *
 * Read-only by design. Every action that mutates a change lives in the
 * Changes and Archive views, where each change appears exactly once; a
 * row offering Archive three times for one change is what that separation
 * avoids. */
export class ChangeGraphTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: ChangeGraphNode,
    /** Ids of blockers named by this change that have not landed. */
    public readonly waitingOn: string[],
    /** The chain of ancestors this row was reached through, for a stable
     * id and for cycle detection while expanding. */
    public readonly ancestry: string[],
    hasChildren: boolean,
  ) {
    super(
      node.id,
      hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );
    this.id = [...ancestry, node.id].join(">");
    this.description = [
      node.archived ? "archived" : undefined,
      waitingOn.length > 0 ? `waiting on ${waitingOn.join(", ")}` : undefined,
      node.supersedes.length > 0 ? `supersedes ${node.supersedes.join(", ")}` : undefined,
      ancestry.includes(node.id) ? "cycle" : undefined,
    ]
      .filter(Boolean)
      .join(" · ");
    this.contextValue = node.archived
      ? "openspec-ui.graphArchivedChange"
      : "openspec-ui.graphActiveChange";
    this.iconPath = new vscode.ThemeIcon(
      ancestry.includes(node.id) ? "warning" : waitingOn.length > 0 ? "watch" : node.archived ? "archive" : "circle-outline",
    );
  }
}

/** A heading for changes no root reaches, which a cycle causes. Without
 * it the subgraph would simply not render: everything in a cycle follows
 * something, so none of it is a root. The terminal renderer had exactly
 * that defect, and a view that hides a cycle is worse than one that shows
 * it awkwardly. */
export class ChangeGraphNoticeTreeItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.id = `notice:${label}`;
    this.contextValue = "openspec-ui.graphNotice";
    this.iconPath = new vscode.ThemeIcon("warning");
  }
}

/** The branches whose every change has landed, folded away with their
 * count. Nothing goes quiet: the row is drawn whenever anything is folded,
 * and pressing it shows them (the-views-are-searched-and-landed-relations-fold). */
export class ChangeGraphFoldedTreeItem extends vscode.TreeItem {
  constructor(public readonly hidden: number) {
    super(
      `${hidden} landed ${hidden === 1 ? "relation" : "relations"} hidden`,
      vscode.TreeItemCollapsibleState.None,
    );
    this.id = "folded:landed";
    // Read live against this repository, where 184 branches are folded and
    // the rest of the view is short: without this the row states a fact and
    // a reader has no reason to think it can be pressed.
    this.description = "Press to show";
    this.contextValue = "openspec-ui.graphFolded";
    this.iconPath = new vscode.ThemeIcon("archive");
    this.tooltip = "Every change in these branches is archived";
    this.command = { command: "openspec-ui.showLandedRelations", title: "Show landed relations" };
  }
}

export type GraphTreeNode = ChangeGraphTreeItem | ChangeGraphNoticeTreeItem | ChangeGraphFoldedTreeItem | EmptyTreeItem;

export class ChangeGraphTreeProvider implements vscode.TreeDataProvider<GraphTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  // The graph a reveal's `getParent` chain should resolve against — set on
  // every `getChildren` read, which `reveal` always triggers alongside
  // `getParent` while walking a row's ancestry. `getParent` falls back to
  // its own read only when called with no prior `getChildren` in this
  // provider's lifetime (design.md, "a cost decision, not a correctness
  // one" — this avoids re-reading `openspec/` once per level of a reveal,
  // it does not need to be a full cache with invalidation).
  private lastRead: ChangeGraph | undefined;
  /** The one reading every `getChildren` and `getParent` shares until the
   * next refresh (the-change-graph-reads-once). VS Code asks for the root
   * and then for every expanded row, often at once; each used to read the
   * whole graph, archive included, so ten open rows were ten full reads
   * per drawing. A promise rather than the result, so calls that arrive
   * together share one read instead of each starting their own. */
  private reading: Promise<ChangeGraph> | undefined;
  /** What this view is narrowed by. */
  readonly filter = new ViewFilterState();
  /** Whether the branches whose every change has landed are drawn. Off by
   * default: the view exists to show what is being decided now, and a
   * finished cluster that stays in the way is what was reported. */
  private showLanded = false;

  constructor(private readonly workspaceRoot: string) { }

  /** Whether the landed branches are being drawn, for the title bar's two
   * commands and their `when` clause. */
  get landedShown(): boolean {
    return this.showLanded;
  }

  setShowLanded(shown: boolean): void {
    this.showLanded = shown;
    this.refresh();
  }

  refresh(): void {
    this.lastRead = undefined;
    this.reading = undefined;
    this.onDidChangeTreeDataEmitter.fire();
  }

  /** The graph for this drawing: read once, then shared. */
  private async graph(): Promise<ChangeGraph> {
    this.reading ??= readChangeGraph(this.workspaceRoot);
    try {
      const nodes = await this.reading;
      this.lastRead = nodes;
      return nodes;
    } catch (error) {
      // A read that failed is not kept: the next drawing tries again.
      this.reading = undefined;
      throw error;
    }
  }

  getTreeItem(element: GraphTreeNode): vscode.TreeItem {
    return element;
  }

  async getParent(element: GraphTreeNode): Promise<GraphTreeNode | undefined> {
    if (!(element instanceof ChangeGraphTreeItem) || element.ancestry.length === 0) return undefined;
    const nodes = this.lastRead ?? await this.graph();
    const parentId = element.ancestry[element.ancestry.length - 1];
    if (parentId === undefined) return undefined;
    const node = nodes.get(parentId);
    if (!node) return undefined;
    const children = childrenByParent(nodes);
    const waiting = unmetBlockers(nodes);
    return item(node, waiting, element.ancestry.slice(0, -1), children);
  }

  async getChildren(element?: GraphTreeNode): Promise<GraphTreeNode[]> {
    const nodes = await this.graph();
    const children = childrenByParent(nodes);
    const waiting = unmetBlockers(nodes);

    if (element instanceof ChangeGraphTreeItem) {
      // A row reached through a cycle expands no further; the id it would
      // repeat is already on its own ancestry.
      if (element.ancestry.includes(element.node.id)) return [];
      const ancestry = [...element.ancestry, element.node.id];
      return (children.get(element.node.id) ?? [])
        .map((id) => nodes.get(id))
        .filter((node): node is ChangeGraphNode => node !== undefined)
        .map((node) => item(node, waiting, ancestry, children));
    }
    if (element) return [];

    const connected = [...nodes.values()].filter((node) => isConnected(node, children));
    if (connected.length === 0) {
      return [new EmptyTreeItem("No change states a relation", "Add follows, supersedes or blocked_by to a change")];
    }

    // A branch whose every change is archived is folded away, unless the
    // reader asked for it or the filter found something inside it: a
    // reader who types a name expects to be shown that change, whatever
    // state it is in.
    // A finished branch that something unfinished is waiting on stays
    // drawn: folding it would leave a row reading "waiting on base" with
    // no base anywhere in the view.
    const awaited = new Set<string>();
    for (const node of nodes.values()) {
      if (node.archived) continue;
      for (const blocker of node.blockedBy) awaited.add(blocker);
    }
    // Only the roots this view actually draws can be folded away. Read
    // live against this repository: counting every landed branch in the
    // graph promised 184 hidden relations where the view held 28 roots,
    // because a change that states no relation at all is not in this view
    // to begin with.
    const drawnRoots = new Set(connected.filter((node) => node.follows.length === 0).map((node) => node.id));
    const landed = new Set(
      landedBranches(nodes)
        .filter((branch) => branch.landed && !branch.members.some((id) => awaited.has(id)))
        .map((branch) => branch.root)
        .filter((root) => drawnRoots.has(root)),
    );
    // Only a filter unfolds a branch: with nothing typed `branchMatches`
    // is true of everything, and taking that as a match would fold away
    // nothing at all.
    const matchedRoots = new Set(
      this.filter.active ? [...landed].filter((root) => branchMatches(root, nodes, children, this.filter)) : [],
    );
    const folded = this.showLanded ? new Set<string>() : new Set([...landed].filter((root) => !matchedRoots.has(root)));

    const rootNodes = connected
      .filter((node) => node.follows.length === 0)
      .filter((node) => !folded.has(node.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    const shownRoots = rootNodes.filter((node) => branchMatches(node.id, nodes, children, this.filter));
    this.filter.counted(shownRoots.length, connected.filter((node) => node.follows.length === 0).length);
    const roots = shownRoots.map((node) => item(node, waiting, [], children));
    const foldedRow = folded.size > 0 ? [new ChangeGraphFoldedTreeItem(folded.size)] : [];

    const reachable = reachableFromRoots(nodes, children);
    const stranded = connected
      .filter((node) => !reachable.has(node.id))
      .filter((node) => this.filter.matches([node.id]))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (stranded.length === 0) {
      if (roots.length === 0 && this.filter.active) {
        return [new EmptyTreeItem(`Nothing matches "${this.filter.text}"`, "Clear the filter to see every relation")];
      }
      return [...roots, ...foldedRow];
    }

    return [
      ...roots,
      ...foldedRow,
      new ChangeGraphNoticeTreeItem("Not reachable from any root, which a cycle causes"),
      ...stranded.map((node) => item(node, waiting, [], children)),
    ];
  }
}

/** Whether a filter finds anything in a branch. A row whose child matches
 * is kept, or the match could not be reached. */
function branchMatches(
  root: string,
  nodes: ChangeGraph,
  children: Map<string, string[]>,
  filter: ViewFilterState,
): boolean {
  if (!filter.active) return true;
  const seen = new Set<string>();
  const queue = [root];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = nodes.get(id);
    if (node && filter.matches([node.id, node.archived ? "archived" : undefined])) return true;
    queue.push(...(children.get(id) ?? []));
  }
  return false;
}

function item(
  node: ChangeGraphNode,
  waiting: Map<string, string[]>,
  ancestry: string[],
  children: Map<string, string[]>,
): ChangeGraphTreeItem {
  const hasChildren = (children.get(node.id)?.length ?? 0) > 0 && !ancestry.includes(node.id);
  return new ChangeGraphTreeItem(node, waiting.get(node.id) ?? [], ancestry, hasChildren);
}

/** Children keyed by the change they follow. Neither `supersedes` nor
 * `blocked_by` is a parent: the first says this change corrected a
 * decision, the second that it is waiting on one, and nesting under
 * either would claim an order the repository never stated. Both appear in
 * the row's description instead. */
export function childrenByParent(nodes: ChangeGraph): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const node of nodes.values()) {
    for (const parent of node.follows) {
      const existing = children.get(parent);
      if (existing) existing.push(node.id);
      else children.set(parent, [node.id]);
    }
  }
  for (const list of children.values()) list.sort();
  return children;
}

function isConnected(node: ChangeGraphNode, children: Map<string, string[]>): boolean {
  return (
    node.follows.length > 0
    || node.supersedes.length > 0
    || node.blockedBy.length > 0
    || (children.get(node.id)?.length ?? 0) > 0
  );
}

function unmetBlockers(nodes: ChangeGraph): Map<string, string[]> {
  const waiting = new Map<string, string[]>();
  for (const node of nodes.values()) {
    const unmet = node.blockedBy.filter((id) => {
      const target = nodes.get(id);
      return target !== undefined && !target.archived;
    });
    if (unmet.length > 0) waiting.set(node.id, unmet);
  }
  return waiting;
}

function reachableFromRoots(nodes: ChangeGraph, children: Map<string, string[]>): Set<string> {
  const reachable = new Set<string>();
  const walk = (id: string): void => {
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of children.get(id) ?? []) walk(child);
  };
  for (const node of nodes.values()) {
    if (node.follows.length === 0) walk(node.id);
  }
  return reachable;
}

/** The chain of changes one change grew out of, breadth-first so the
 * nearest reason comes first. Answers the question the graph exists for —
 * why is this here — from the change rather than from the graph. */
export function ancestryOf(nodes: ChangeGraph, id: string): ChangeGraphNode[] {
  const start = nodes.get(id);
  if (!start) return [];

  const seen = new Set<string>([id]);
  const ordered: ChangeGraphNode[] = [];
  let frontier = [...start.follows];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const current of frontier) {
      if (seen.has(current)) continue;
      seen.add(current);
      const node = nodes.get(current);
      if (!node) continue;
      ordered.push(node);
      next.push(...node.follows);
    }
    frontier = next;
  }
  return ordered;
}

/** Every row a change occupies, not the first found — a change following
 * more than one other change appears once per path (design.md, "every
 * row, and say how many"). Walks the graph the same way `getChildren`
 * renders it — roots, then the stranded subgraph a cycle produces — so a
 * row returned here is exactly one `reveal` can find, including rows
 * under a collapsed subtree the tree view has never rendered. */
export async function findGraphRows(workspaceRoot: string, changeId: string): Promise<ChangeGraphTreeItem[]> {
  const nodes = await readChangeGraph(workspaceRoot);
  const children = childrenByParent(nodes);
  const waiting = unmetBlockers(nodes);
  const rows: ChangeGraphTreeItem[] = [];

  const walk = (id: string, ancestry: string[]): void => {
    if (ancestry.includes(id)) return;
    const node = nodes.get(id);
    if (!node) return;
    if (id === changeId) rows.push(item(node, waiting, ancestry, children));
    const nextAncestry = [...ancestry, id];
    for (const childId of children.get(id) ?? []) walk(childId, nextAncestry);
  };

  const connected = [...nodes.values()].filter((node) => isConnected(node, children));
  for (const root of connected.filter((node) => node.follows.length === 0)) walk(root.id, []);

  const reachable = reachableFromRoots(nodes, children);
  for (const node of connected.filter((n) => !reachable.has(n.id))) walk(node.id, []);

  return rows;
}
