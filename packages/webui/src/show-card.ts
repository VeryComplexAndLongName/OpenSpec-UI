// The host's request to show a change's card on the Pipeline - a change
// chosen in the editor's Workspace navigator (the-side-panel-is-the-workspace).
// Read by the Pipeline's webview and by the standalone page the editor
// embeds; kept apart so neither entry imports the other.

/** Posted by the host: show this change's card. */
export const SHOW_CARD_MESSAGE_TYPE = "openspec-ui/show-card";

/** Posted once the Pipeline's page runs, so a card asked for while the
 * page loaded is shown. */
export const PIPELINE_READY_MESSAGE_TYPE = "openspec-ui/pipeline-ready";

/** A change named by a request to show its card, or `undefined`. */
export function shownCardOf(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const message = data as { type?: unknown; changeName?: unknown };
  return message.type === SHOW_CARD_MESSAGE_TYPE && typeof message.changeName === "string" ? message.changeName : undefined;
}
