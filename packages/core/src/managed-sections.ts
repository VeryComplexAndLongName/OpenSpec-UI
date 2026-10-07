// The markers of the sections this product writes into a person's agent
// instruction files, in one place, since each writer must recognise the
// other's (repo-bootstrap-snippets; agents-are-told-how-work-is-done-here).

/** The project-type guidelines (repo-bootstrap.ts). */
export const GUIDELINES_SECTION_START = "<!-- openspec-ui:managed start -->";
export const GUIDELINES_SECTION_END = "<!-- openspec-ui:managed end -->";

/** How work is done in the repository (agent-workflow-rules.ts). */
export const WORKFLOW_SECTION_START = "<!-- openspec-ui:workflow start -->";
export const WORKFLOW_SECTION_END = "<!-- openspec-ui:workflow end -->";
