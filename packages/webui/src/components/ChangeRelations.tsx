// 2.4 Displays relations between changes — marked implicitly: change A is
// related to change B if B's name is mentioned in change A's proposal.md
// text (the same principle as cross-links between requirements in Specs,
// see RequirementView).

export interface ChangeRelationsProps {
  proposalText: string;
  /** All known change names (other than the current one) — the source of
   * truth for "what could even be a relation", not a heuristic of the
   * component itself. */
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
