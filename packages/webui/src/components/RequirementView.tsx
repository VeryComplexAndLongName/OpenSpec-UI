// 3.2 Read-only markdown-рендер требования/сценария.
// 3.4 Ссылки между требованиями — упоминание `capability-id` в тексте
// требования (в code-span, как это делает сам OpenSpec CLI) рендерится как
// переход к этому spec'у.

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
  /** Известные id других specs — источник правды для того, что считать
   * переходом, а не просто отформатированным кодом. */
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
