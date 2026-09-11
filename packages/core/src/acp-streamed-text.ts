// Whether an ACP `session/update` payload carries a slice of streamed
// text, and what that text is.
//
// An ACP-flavored adapter forwards the peer's `session/update` payload
// verbatim as an `agentUpdate` event's `update` (see
// agents/acp-session-driver.ts and protocol.ts's `AgentUpdateEvent`), so
// the payload's shape is knowledge nothing in this package had written
// down. Both delivery targets render that stream — the standalone
// shell's AI panel and the VS Code timeline webview — and both have to
// answer the same question before they can show a streamed reply as the
// prose it was written as rather than as the slices it arrived in. One
// answer, beside the protocol, rather than one per surface.
//
// A leaf module: no Node built-ins, so the browser bundle can carry it
// (`browser.ts`, gated by packages/server/src/static.test.ts).
//
// Reading only. Deciding which consecutive events fold into one stays
// with the surface that already owns that rule — see
// openspec/changes/acp-text-reads-as-prose/design.md, "the reading rule
// lives in core, the joining stays in the panel".

/** The `sessionUpdate` kinds that carry a slice of streamed text.
 *
 * Two, and deliberately not more. Everything else an update can be — a
 * tool call, a plan, a usage figure, a permission request — is not
 * prose, and an unfamiliar kind is not guessed at (see
 * `readAcpStreamedText`). */
export const ACP_TEXT_CHUNK_KINDS = ["agent_message_chunk", "agent_thought_chunk"] as const;

export type AcpTextChunkKind = (typeof ACP_TEXT_CHUNK_KINDS)[number];

/** A slice of streamed text, and which kind of text it is.
 *
 * The kind travels with the text because two slices only belong
 * together when they are the same kind: what an agent offers as its
 * message and what it offers as its thinking are different statements,
 * and running them together shows one that was never made. */
export interface AcpStreamedText {
  kind: AcpTextChunkKind;
  text: string;
}

function isTextChunkKind(value: unknown): value is AcpTextChunkKind {
  return typeof value === "string" && (ACP_TEXT_CHUNK_KINDS as readonly string[]).includes(value);
}

/** The ACP content block this module recognises: `{ type: "text", text }`.
 *
 * `type` is checked, not merely tolerated. A content block is a tagged
 * union in ACP's own schema — an image, an audio clip, a resource link,
 * an embedded resource — and only the text variant is prose. Accepting
 * any block that happens to have a `text` property would read a future
 * variant's caption or filename as part of the reply. */
function textOfContentBlock(content: unknown): string | undefined {
  if (typeof content !== "object" || content === null || Array.isArray(content)) return undefined;
  const block = content as Record<string, unknown>;
  if (block.type !== "text") return undefined;
  return typeof block.text === "string" ? block.text : undefined;
}

/** Reads a slice of streamed text out of an ACP update payload, or
 * `undefined` when the update carries none.
 *
 * `undefined` is the answer for everything this module does not
 * recognise, and that is the point: ACP is not this project's protocol,
 * the payload is carried verbatim, and a shape nobody here has seen is
 * left exactly as it is. Guessing would turn an addition to that
 * protocol into silently mangled output, while not guessing leaves the
 * behaviour at worst unchanged. */
export function readAcpStreamedText(update: Record<string, unknown>): AcpStreamedText | undefined {
  const kind = update.sessionUpdate;
  if (!isTextChunkKind(kind)) return undefined;
  const text = textOfContentBlock(update.content);
  if (text === undefined) return undefined;
  return { kind, text };
}

/** The same payload with its streamed text replaced, as a new object —
 * the write side of `readAcpStreamedText`, so a surface joining two
 * slices never has to know where in the payload the text sits.
 *
 * Everything else the update carries is preserved, because the joined
 * event stands in for the first slice and that slice's payload may say
 * more than its text. Nothing is mutated: the caller's update, and the
 * event holding it, are left as they were.
 *
 * Returns `undefined` when the update carries no streamed text to
 * replace, for the same reason the reader does. */
export function withAcpStreamedText(
  update: Record<string, unknown>,
  text: string,
): Record<string, unknown> | undefined {
  if (readAcpStreamedText(update) === undefined) return undefined;
  const content = update.content as Record<string, unknown>;
  return { ...update, content: { ...content, text } };
}
