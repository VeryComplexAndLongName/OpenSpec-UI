// Writing a relation back, beside `change-graph.ts` which reads it
// (a-relation-is-set-where-it-is-read).
//
// DW asked to add and remove `blocked_by` and `follows` with a mouse
// rather than by editing `.openspec.yaml` by hand. The reading has always
// been core's; the writing is core's for the same reason - the rules an
// edit has to respect are the ones the relation gate applies, and a host
// that wrote the file itself would restate them and drift.
//
// A text edit rather than a YAML round trip: these files are written by
// hand as well, and a parse-and-serialise would come back reordered and
// stripped of its comments. Every line the edit does not concern is
// passed through as it was found, including the file's own line endings.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  findChangeGraphCycles,
  readChangeGraph,
  type ChangeGraph,
  type ChangeRelationKey,
} from "./change-graph.js";

const KEY_LINE = /^(follows|supersedes|blocked_by)\s*:(.*)$/u;
const COMMENT = /^\s*#/u;
const LIST_ITEM = /^(\s+)-\s*(.+?)\s*$/u;

function fieldOf(key: ChangeRelationKey): "follows" | "supersedes" | "blockedBy" {
  return key === "blocked_by" ? "blockedBy" : key;
}

/** Rewrites one relation key in a change's metadata.
 *
 * The key's lines are replaced where the file states it, the key is
 * appended where it does not, and the key is removed where `ids` is
 * empty - a key left stating nothing is what `parseChangeRelations`
 * reports as an error. The shape is kept: a flow sequence stays a flow
 * sequence, a single scalar stays one while it names a single change, and
 * anything else is written as a block sequence with the indent the file
 * already uses. */
export function applyRelationEdit(source: string, key: ChangeRelationKey, ids: string[]): string {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = /\r?\n$/u.test(source);
  const lines = source.length === 0 ? [] : source.split(/\r?\n/u);
  if (endsWithNewline) lines.pop();

  let start = -1;
  let end = -1;
  let rest = "";
  for (let i = 0; i < lines.length; i += 1) {
    if (COMMENT.test(lines[i]!)) continue;
    const match = KEY_LINE.exec(lines[i]!);
    if (!match || match[1] !== key) continue;
    start = i;
    end = i;
    rest = match[2]!.replace(/#.*$/u, "").trim();
    if (rest.length === 0) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!LIST_ITEM.test(lines[j]!)) break;
        end = j;
      }
    }
    break;
  }

  const indent = (() => {
    for (const line of lines) {
      const item = LIST_ITEM.exec(line);
      if (item) return item[1]!;
    }
    return "  ";
  })();

  const written = ((): string[] => {
    if (ids.length === 0) return [];
    if (rest.startsWith("[")) return [`${key}: [${ids.join(", ")}]`];
    if (ids.length === 1 && (start < 0 || rest.length > 0)) return [`${key}: ${ids[0]}`];
    return [`${key}:`, ...ids.map((id) => `${indent}- ${id}`)];
  })();

  const next = start < 0 ? [...lines, ...written] : [...lines.slice(0, start), ...written, ...lines.slice(end + 1)];
  if (next.length === 0) return "";
  return next.join(eol) + (endsWithNewline || start < 0 ? eol : "");
}

export type RelationRefusalReason =
  | "unknown-change"
  | "self-relation"
  | "cycle"
  | "archived-change"
  | "unreadable-metadata";

export interface RelationEditRefusal {
  ok: false;
  reason: RelationRefusalReason;
  /** The changes the refusal is about: the id nothing matches, or the
   * changes in the cycle, in the order they close it. */
  ids: string[];
  /** One sentence, ready to show. A host decides where it goes; core
   * decides what is wrong with the edit. */
  message: string;
}

export interface RelationEditApplied {
  ok: true;
  change: string;
  key: ChangeRelationKey;
  /** What that key states now. */
  ids: string[];
  /** Repository-relative, so a caller can name the file it wrote. */
  metadataPath: string;
  /** False where the edit asked for what the file already said. */
  written: boolean;
}

export type RelationEditResult = RelationEditApplied | RelationEditRefusal;

export interface RelationEdit {
  /** The change whose metadata states the relation. */
  change: string;
  key: ChangeRelationKey;
  /** The change to name. Exactly one of `add` and `remove` is given. */
  add?: string;
  remove?: string;
}

function cycleKeys(graph: ChangeGraph): Set<string> {
  return new Set(findChangeGraphCycles(graph).map((cycle) => [...cycle].sort().join(">")));
}

/** Adds or removes one relation, and writes the change's metadata.
 *
 * Refused, with nothing written, where the edit names a change the
 * workspace does not have, where a change would relate to itself, where
 * the relations would form a cycle, or where the change being edited is
 * archived. The cycle check is `findChangeGraphCycles` over the graph as
 * it would be after the edit - the same answer the relation gate gives,
 * given while the author can still act on it. */
export async function editChangeRelation(root: string, edit: RelationEdit): Promise<RelationEditResult> {
  const graph = await readChangeGraph(root, { changes: "all" });
  const node = graph.get(edit.change);
  if (!node) {
    return { ok: false, reason: "unknown-change", ids: [edit.change], message: `No change named ${edit.change}` };
  }
  if (node.archived) {
    return {
      ok: false,
      reason: "archived-change",
      ids: [edit.change],
      message: `${edit.change} is archived, and an archived change's relations are history`,
    };
  }
  if (node.errors.length > 0) {
    return {
      ok: false,
      reason: "unreadable-metadata",
      ids: [edit.change],
      message: `${node.metadataPath} cannot be read as relations: ${node.errors[0]}`,
    };
  }

  const named = edit.add ?? edit.remove;
  if (named === undefined) {
    return { ok: false, reason: "unknown-change", ids: [], message: "The edit names no change to relate" };
  }
  if (named === edit.change) {
    return {
      ok: false,
      reason: "self-relation",
      ids: [edit.change],
      message: `A change cannot state ${edit.key} on itself`,
    };
  }
  if (edit.add !== undefined && !graph.has(edit.add)) {
    return {
      ok: false,
      reason: "unknown-change",
      ids: [edit.add],
      message: `No change named ${edit.add}, active or archived`,
    };
  }

  const field = fieldOf(edit.key);
  const current = node[field];
  const ids = edit.add !== undefined
    ? current.includes(edit.add) ? current : [...current, edit.add]
    : current.filter((id) => id !== edit.remove);

  if (edit.add !== undefined) {
    const before = cycleKeys(graph);
    const after: ChangeGraph = new Map(graph);
    after.set(node.id, { ...node, [field]: ids });
    const closed = findChangeGraphCycles(after).find((cycle) => !before.has([...cycle].sort().join(">")));
    if (closed) {
      return {
        ok: false,
        reason: "cycle",
        ids: closed,
        message: `That would close a cycle: ${closed.join(" then ")}`,
      };
    }
  }

  const file = path.join(root, node.metadataPath);
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    source = "";
  }
  const next = applyRelationEdit(source, edit.key, ids);
  const written = next !== source;
  if (written) await writeFile(file, next, "utf8");
  return { ok: true, change: node.id, key: edit.key, ids, metadataPath: node.metadataPath, written };
}
