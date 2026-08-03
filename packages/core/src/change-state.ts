// Derived state machine для статуса change'а — единственное место, где это
// вычисляется (см. ADR 0001 п.5, design.md "Derived state — чистая функция").
//
// `deriveChangeState` сама по себе — чистая функция без побочных эффектов:
// она принимает уже прочитанное содержимое `tasks.md` (или `null`, если
// файла нет), а не читает файловую систему сама. Чтение файла — отдельная
// обёртка (`readChangeState`), которой пользуются `server`/`extension`;
// сама эвристика остаётся тестируемой без диска.

import { readFile } from "node:fs/promises";
import path from "node:path";

export type ChangeState = "draft" | "in-progress" | "implemented" | "archived";

function isArchived(changeDir: string): boolean {
  const segments = changeDir.split(/[\\/]+/).filter(Boolean);
  return segments.includes("archive");
}

interface TaskCounts {
  total: number;
  checked: number;
}

const TASK_CHECKBOX_RE = /^[ \t]*-\s\[( |x|X)\]/gm;

function countTasks(tasksMarkdown: string): TaskCounts {
  let total = 0;
  let checked = 0;
  for (const match of tasksMarkdown.matchAll(TASK_CHECKBOX_RE)) {
    total += 1;
    if (match[1]?.toLowerCase() === "x") checked += 1;
  }
  return { total, checked };
}

/**
 * Вычисляет статус change'а по расположению его директории и содержимому
 * `tasks.md` (или `null`, если файл отсутствует/ещё не создан).
 *
 * - `archived` — директория лежит под `.../archive/...` (перекрывает всё
 *   остальное — не важно, что в `tasks.md` заархивированного change'а);
 * - `draft` — `tasks.md` отсутствует, пуст (нет пунктов) или ни один пункт не
 *   отмечен `[x]`;
 * - `implemented` — все пункты отмечены `[x]`;
 * - `in-progress` — отмечена часть пунктов.
 */
export function deriveChangeState(changeDir: string, tasksMarkdown: string | null): ChangeState {
  if (isArchived(changeDir)) return "archived";
  if (tasksMarkdown === null) return "draft";

  const { total, checked } = countTasks(tasksMarkdown);
  if (total === 0 || checked === 0) return "draft";
  if (checked === total) return "implemented";
  return "in-progress";
}

/** Удобная обёртка для реальных потребителей: читает `tasks.md` с диска и
 * применяет `deriveChangeState`. Файл может отсутствовать — это не ошибка,
 * а сигнал состояния `draft`. */
export async function readChangeState(changeDir: string): Promise<ChangeState> {
  let tasksMarkdown: string | null;
  try {
    tasksMarkdown = await readFile(path.join(changeDir, "tasks.md"), "utf8");
  } catch {
    tasksMarkdown = null;
  }
  return deriveChangeState(changeDir, tasksMarkdown);
}
