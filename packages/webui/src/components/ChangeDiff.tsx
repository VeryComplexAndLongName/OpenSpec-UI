// A change's uncommitted work as a unified diff, the text git itself
// produced (a-screen-says-what-it-is-doing). Standalone only: the VS Code
// extension delegates diffs to `vscode.diff` and does not use this.
//
// It used to take `before` and `after` and diff them in the browser, and the
// Diff Preview tab passed it two literal strings — a sample that never showed
// anything of the person's own. Git has already decided what changed; this
// only colours each line by its first character.

export interface ChangeDiffProps {
  unified: string;
}

type LineKind = "added" | "removed" | "unchanged" | "meta" | "hunk";

const META_PREFIXES = ["diff --git ", "index ", "new file mode ", "deleted file mode ", "--- ", "+++ ", "Binary files ", "\\ "];

function kindOf(line: string): LineKind {
  if (META_PREFIXES.some((prefix) => line.startsWith(prefix))) return "meta";
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "added";
  if (line.startsWith("-")) return "removed";
  return "unchanged";
}

export function ChangeDiff({ unified }: ChangeDiffProps) {
  const lines = unified.length === 0 ? [] : unified.replace(/\r?\n$/u, "").split(/\r?\n/u);

  return (
    <div className="openspec-diff" data-testid="change-diff">
      <pre className="openspec-diff-body">
        {lines.map((line, index) => (
          <div key={index} className={`openspec-diff-line openspec-diff-line--${kindOf(line)}`}>
            {line}
          </div>
        ))}
      </pre>
    </div>
  );
}
