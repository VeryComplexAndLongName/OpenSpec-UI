// 2.4 Отображение связей между changes — размечены неявно: change A связан
// с change B, если имя B упоминается в тексте proposal.md change'а A (тот же
// принцип, что и cross-links между requirements в Specs, см. RequirementView).

export interface ChangeRelationsProps {
  proposalText: string;
  /** Все известные имена changes (кроме текущего) — источник правды для
   * "что вообще может быть связью", не эвристика самого компонента. */
  knownChangeNames: string[];
  onNavigate?: (name: string) => void;
}

export function findRelatedChangeNames(proposalText: string, knownChangeNames: string[]): string[] {
  return knownChangeNames.filter((name) => proposalText.includes(name));
}

export function ChangeRelations({ proposalText, knownChangeNames, onNavigate }: ChangeRelationsProps) {
  const related = findRelatedChangeNames(proposalText, knownChangeNames);

  if (related.length === 0) {
    return <p className="openspec-change-relations-empty">No related changes mentioned.</p>;
  }

  return (
    <ul className="openspec-change-relations" data-testid="change-relations">
      {related.map((name) => (
        <li key={name}>
          <button type="button" data-testid={`relation-${name}`} onClick={() => onNavigate?.(name)}>
            {name}
          </button>
        </li>
      ))}
    </ul>
  );
}
