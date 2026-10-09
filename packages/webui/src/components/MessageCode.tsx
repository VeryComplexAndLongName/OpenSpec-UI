// A message's identifier, said before its words as a small label that links
// to its entry in docs/messages.md: what it means, why, and what to do
// (ADR 0046, every-message-has-an-identifier). Nothing for a message not
// yet in the register.

import { messageEntryUrl } from "@openspec-ui/core/browser";

export interface MessageCodeProps {
  code: string | undefined;
}

export function MessageCode({ code }: MessageCodeProps): JSX.Element | null {
  if (code === undefined) return null;
  return (
    <>
      <a
        className="openspec-message-code"
        data-testid="message-code"
        href={messageEntryUrl(code)}
        target="_blank"
        rel="noreferrer"
        title="What this message means, and what to do"
      >
        {code}
      </a>
      {": "}
    </>
  );
}
