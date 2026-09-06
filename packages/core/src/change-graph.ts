// The relation changes state about each other, read once for every
// caller — the gate, the terminal renderer, and the editor surfaces.
//
// It lived in `scripts/check-change-graph.mjs` first, deliberately: that
// script runs before any build and carries no dependencies. The extension
// broke that arrangement, because it runs in someone else's workspace
// where this repository's `scripts/` do not exist, and must read *that*
// workspace's `openspec/changes` itself. The repository's own invariant
// then says where this belongs — business logic in `packages/core`, with
// `server` and `extension` as thin adapters.
//
// The gate that used to be `npm run lint:change-graph` is a test over
// this module instead. Vitest runs TypeScript directly, so the check
// needs no build; `harness-config.test.ts` and `task-checklist.test.ts`
// already read this repository's own `openspec/` tree the same way.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CHANGES_DIR = "openspec/changes";
const ARCHIVE_DIR = "openspec/changes/archive";

/** `openspec archive` renames `<id>` to `<YYYY-MM-DD>-<id>`. A relation
 * names the id, so archiving must never break one — most relations point
 * at archived work, which is where their value is. */
const ARCHIVE_PREFIX = /^\d{4}-\d{2}-\d{2}-/u;

const CHANGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

/** The three relations a change may state about another.
 *
 * `follows` and `supersedes` are history and never resolve: a change
 * either grew out of another or corrected a decision it made, and that
 * stays true forever. `blockedBy` is a schedule and resolves the moment
 * the change it names is archived — which is why an unmet blocker is
 * reported rather than failed, while a cycle among blockers is a
 * deadlock rather than a confused record. */
export const CHANGE_RELATION_KEYS = ["follows", "supersedes", "blocked_by"] as const;

export type ChangeRelationKey = (typeof CHANGE_RELATION_KEYS)[number];

export interface ChangeRelations {
  follows: string[];
  supersedes: string[];
  blockedBy: string[];
  /** A key present in a shape the parser does not accept. Reported, never
   * swallowed: an unreadable relation that read as "none stated" would
   * pass the gate while going unverified. */
  errors: string[];
}

export interface ChangeGraphNode extends ChangeRelations {
  id: string;
  archived: boolean;
  /** Repository-relative, so a caller can name the file it rejects. */
  metadataPath: string;
}

export type ChangeGraph = Map<string, ChangeGraphNode>;

export interface ChangeGraphViolation {
  filePath: string;
  changeId: string;
  reason: string;
}

const KEY_PATTERN = /^(follows|supersedes|blocked_by)\s*:(.*)$/u;
const KEY_ANYWHERE = /\S(follows|supersedes|blocked_by)\s*:/u;
const LIST_ITEM = /^\s+-\s*(.+?)\s*$/u;

function field(key: ChangeRelationKey): keyof Omit<ChangeRelations, "errors"> {
  return key === "blocked_by" ? "blockedBy" : key;
}

/** Reads the relation keys, and only those. Accepted shapes:
 *
 *     follows: one-change-id
 *     follows: [first, second]
 *     follows:
 *       - first
 *       - second
 *
 * A narrow parser rather than a YAML dependency, because this runs from
 * `scripts/` as well and those carry none. Anything outside these shapes
 * is reported rather than guessed at — a misread relation is worse than a
 * missing one. */
export function parseChangeRelations(source: string): ChangeRelations {
  const relations: ChangeRelations = { follows: [], supersedes: [], blockedBy: [], errors: [] };
  const lines = source.split(/\r?\n/u);

  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*#/u.test(lines[i]!)) continue;
    const match = KEY_PATTERN.exec(lines[i]!);
    if (!match) {
      // A key that does not start its line is not a key. Several of these
      // files end without a trailing newline, so appending `follows:` to
      // one yields `created: 2026-09-04follows:` — valid-looking, and
      // silently ignored by every reader. Caught here rather than left to
      // read as "no relation stated".
      if (KEY_ANYWHERE.test(lines[i]!)) {
        relations.errors.push(
          `line ${i + 1}: a relation key must start its own line, found ${JSON.stringify(lines[i]!.trim())}`,
        );
      }
      continue;
    }

    const key = match[1] as ChangeRelationKey;
    const rest = match[2]!.replace(/#.*$/u, "").trim();

    let values: string[];
    if (rest.startsWith("[")) {
      if (!rest.endsWith("]")) {
        relations.errors.push(`${key}: a flow sequence must open and close on one line`);
        continue;
      }
      values = rest.slice(1, -1).split(",").map((value) => value.trim()).filter(Boolean);
    } else if (rest.length > 0) {
      values = [rest];
    } else {
      values = [];
      for (let j = i + 1; j < lines.length; j += 1) {
        const item = LIST_ITEM.exec(lines[j]!);
        if (!item) {
          if (lines[j]!.trim() === "" || /^\s*#/u.test(lines[j]!)) continue;
          break;
        }
        values.push(item[1]!.replace(/#.*$/u, "").trim());
        i = j;
      }
      if (values.length === 0) {
        relations.errors.push(`${key}: stated with no value — remove the key or name a change`);
        continue;
      }
    }

    for (const value of values) {
      const id = value.replace(/^["']|["']$/gu, "");
      if (!CHANGE_ID.test(id)) {
        relations.errors.push(`${key}: ${JSON.stringify(id)} is not a change id`);
        continue;
      }
      relations[field(key)].push(id);
    }
  }

  return relations;
}

async function directories(root: string, relative: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

/** Every change a workspace knows about, active or archived, keyed by the
 * id a relation would name. */
export async function readChangeGraph(root: string): Promise<ChangeGraph> {
  const nodes: ChangeGraph = new Map();

  for (const name of await directories(root, CHANGES_DIR)) {
    if (name === "archive") continue;
    nodes.set(name, {
      id: name,
      archived: false,
      metadataPath: `${CHANGES_DIR}/${name}/.openspec.yaml`,
      follows: [],
      supersedes: [],
      blockedBy: [],
      errors: [],
    });
  }
  for (const name of await directories(root, ARCHIVE_DIR)) {
    const id = name.replace(ARCHIVE_PREFIX, "");
    // An active change of the same id wins: it is the one being worked
    // on, and its metadata is the one an author edits.
    if (nodes.has(id)) continue;
    nodes.set(id, {
      id,
      archived: true,
      metadataPath: `${ARCHIVE_DIR}/${name}/.openspec.yaml`,
      follows: [],
      supersedes: [],
      blockedBy: [],
      errors: [],
    });
  }

  for (const node of nodes.values()) {
    let source: string;
    try {
      source = await readFile(path.join(root, node.metadataPath), "utf8");
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
      source = "";
    }
    Object.assign(node, parseChangeRelations(source));
  }

  return nodes;
}

function relationsOf(node: ChangeGraphNode): string[] {
  return [...node.follows, ...node.supersedes, ...node.blockedBy];
}

/** Depth-first, three-colour. Reports the changes in each cycle rather
 * than only that one exists — a cycle among archived work is not
 * something a reader can find by eye. */
export function findChangeGraphCycles(nodes: ChangeGraph): string[][] {
  const state = new Map<string, "open" | "done">();
  const stack: string[] = [];
  const cycles: string[][] = [];

  function visit(id: string): void {
    const node = nodes.get(id);
    if (!node || state.get(id) === "done") return;
    if (state.get(id) === "open") {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    state.set(id, "open");
    stack.push(id);
    for (const next of relationsOf(node)) visit(next);
    stack.pop();
    state.set(id, "done");
  }

  for (const id of [...nodes.keys()].sort()) visit(id);
  return cycles;
}

/** A change stating `blocked_by` on one that is still active. Not a
 * violation: it states a plan, and a plan not yet carried out is not a
 * defect. Surfaces report it; the gate does not fail on it. */
export interface UnmetBlocker {
  changeId: string;
  blockedBy: string;
}

export function findUnmetBlockers(nodes: ChangeGraph): UnmetBlocker[] {
  const unmet: UnmetBlocker[] = [];
  for (const node of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const blocker of node.blockedBy) {
      const target = nodes.get(blocker);
      if (target && !target.archived) unmet.push({ changeId: node.id, blockedBy: blocker });
    }
  }
  return unmet;
}

/** What the gate fails on: a relation that cannot be read, a relation
 * naming a change that does not exist, and a cycle. An unmet blocker is
 * deliberately absent — see `findUnmetBlockers`. */
export function checkChangeGraph(nodes: ChangeGraph): ChangeGraphViolation[] {
  const violations: ChangeGraphViolation[] = [];

  for (const node of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const message of node.errors) {
      violations.push({ filePath: node.metadataPath, changeId: node.id, reason: message });
    }
    for (const key of CHANGE_RELATION_KEYS) {
      for (const target of node[field(key)]) {
        if (nodes.has(target)) continue;
        violations.push({
          filePath: node.metadataPath,
          changeId: node.id,
          reason: `${key}: ${JSON.stringify(target)} matches no change, active or archived`
            + " — a successor that was named but never created is what this check exists to catch",
        });
      }
    }
  }

  for (const cycle of findChangeGraphCycles(nodes)) {
    const first = nodes.get(cycle[0]!);
    violations.push({
      filePath: first?.metadataPath ?? `${CHANGES_DIR}/${cycle[0]}/.openspec.yaml`,
      changeId: cycle[0]!,
      reason: `the stated relations form a cycle: ${cycle.join(" -> ")}`,
    });
  }

  return violations;
}
