// 2.2 Diff между версиями архивного change'а — используется собственный
// рендер ТОЛЬКО там, где хост не предоставляет нативный diff (standalone).
// Для VS Code extension этот компонент не используется вовсе — делегируется
// `vscode.diff` (см. design.md, "Decisions").

import { diffLines } from "diff";

export interface ChangeDiffProps {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export function ChangeDiff({ before, after, beforeLabel = "before", afterLabel = "after" }: ChangeDiffProps) {
  const parts = diffLines(before, after);

  return (
    <div className="openspec-diff" data-testid="change-diff">
      <div className="openspec-diff-header">
        <span>{beforeLabel}</span>
        <span>{afterLabel}</span>
      </div>
      <pre className="openspec-diff-body">
        {parts.map((part, index) => {
          const marker = part.added ? "+" : part.removed ? "-" : " ";
          const kind = part.added ? "added" : part.removed ? "removed" : "unchanged";
          const lines = part.value.replace(/\n$/, "").split("\n");
          return lines.map((line, lineIndex) => (
            <div key={`${index}-${lineIndex}`} className={`openspec-diff-line openspec-diff-line--${kind}`}>
              {marker} {line}
            </div>
          ));
        })}
      </pre>
    </div>
  );
}
