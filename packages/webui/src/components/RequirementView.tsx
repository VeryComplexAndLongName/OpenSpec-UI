// 3.2 Read-only markdown rendering of a requirement/scenario.
// 3.4 Cross-links between requirements — a `capability-id` mention inside
// requirement text (in a code span, the same way the OpenSpec CLI itself
// does it) is rendered as a link to that spec.

import type { OpenSpecRequirement } from "@openspec-ui/core";
import { renderInlineMarkdown } from "../markdown.js";

const CODE_SPAN_RE = /`([^`]+)`/g;

export function extractCapabilityMentions(text: string, knownSpecIds: string[]): string[] {
  const found = new Set<string>();
  CODE_SPAN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_SPAN_RE.exec(text)) !== null) {
    const candidate = match[1];
    if (candidate && knownSpecIds.includes(candidate)) {
      found.add(candidate);
    }
  }
  return [...found];
}

export interface RequirementViewProps {
  requirement: OpenSpecRequirement;
  /** Known ids of other specs — the source of truth for what counts as a
   * link versus just formatted code. */
  knownSpecIds?: string[];
  onNavigateToSpec?: (specId: string) => void;
}

export function RequirementView({ requirement, knownSpecIds = [], onNavigateToSpec }: RequirementViewProps) {
  const mentions = extractCapabilityMentions(requirement.text, knownSpecIds);

  return (
    <article className="openspec-requirement-view" data-testid="requirement-view">
      <p className="openspec-requirement-text">{renderInlineMarkdown(requirement.text)}</p>

      {mentions.length > 0 && (
        <ul className="openspec-requirement-links" data-testid="requirement-links">
          {mentions.map((id) => (
            <li key={id}>
              <button type="button" data-testid={`nav-${id}`} onClick={() => onNavigateToSpec?.(id)}>
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}

      {requirement.scenarios.length > 0 && (
        <ul className="openspec-requirement-scenarios" data-testid="requirement-scenarios">
          {requirement.scenarios.map((scenario, index) => (
            <li key={index}>
              <pre>{scenario.rawText}</pre>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
