import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DelegatedReply } from "./DelegatedReply.js";

// a-change-says-where-it-stands 8.5: the reply reaches the inbox, and says
// how it left the item.

describe("DelegatedReply", () => {
  it("says how the reply left the item, and holds what the agent last said", () => {
    render(
      <DelegatedReply
        reply={{ at: "2026-09-14T00:05:00.000Z", body: "It stays open: the server was down.", outcome: "left-open" }}
        testId="delegated-reply-demo:0"
      />,
    );

    const reply = screen.getByTestId("delegated-reply-demo:0");
    expect(reply).toHaveTextContent("The agent's last reply: it left the item open");
    expect(reply).toHaveTextContent("It stays open: the server was down.");
  });
});
