import type { FailureCause } from "./failure-diagnosis.js";

export const WORKBENCH_ISSUE_DRAFT = "https://github.com/VeryComplexAndLongName/OpenSpec-UI/issues/new";

export interface FeedbackFacts {
  workbench?: string;
  openspec?: string;
  platform?: string;
  cause?: FailureCause;
}

function version(value: string | undefined): string {
  return value !== undefined && /^v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]{1,48})?$/u.test(value) ? value : "unknown";
}

export function formatFeedbackDiagnostics(facts: FeedbackFacts): string {
  return [
    "### Workbench diagnostics",
    "",
    `- Workbench: ${version(facts.workbench)}`,
    `- OpenSpec CLI: ${version(facts.openspec)}`,
    `- Platform: ${facts.platform && /^(win32|darwin|linux|freebsd|openbsd|aix|sunos|android)$/u.test(facts.platform) ? facts.platform : "unknown"}`,
    `- Failure category: ${facts.cause ?? "unknown"}`,
  ].join("\n");
}
