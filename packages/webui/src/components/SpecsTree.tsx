// 3.1 Tree view of specs: the top level is the capability (spec id),
// expanding into a list of requirements.

import { useState } from "react";
import type { OpenSpecRequirement } from "@openspec-ui/core";

export interface SpecSummary {
  id: string;
  requirements: OpenSpecRequirement[];
}

export interface SpecsTreeProps {
  specs: SpecSummary[];
  onSelectRequirement?: (specId: string, requirementIndex: number) => void;
}

export function SpecsTree({ specs, onSelectRequirement }: SpecsTreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <ul className="openspec-specs-tree" data-testid="specs-tree">
      {specs.map((spec) => {
        const isOpen = expanded.has(spec.id);
        return (
          <li key={spec.id}>
            <button type="button" data-testid={`spec-toggle-${spec.id}`} onClick={() => toggle(spec.id)}>
              {isOpen ? "▾" : "▸"} {spec.id} ({spec.requirements.length})
            </button>
            {isOpen && (
              <ul>
                {spec.requirements.map((requirement, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      data-testid={`requirement-${spec.id}-${index}`}
                      onClick={() => onSelectRequirement?.(spec.id, index)}
                    >
                      {requirement.text.length > 60 ? `${requirement.text.slice(0, 60)}…` : requirement.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
