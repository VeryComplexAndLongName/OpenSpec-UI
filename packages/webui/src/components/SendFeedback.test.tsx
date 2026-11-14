// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { FeedbackFactsContext, SendFeedback } from "./SendFeedback.js";

it("previews and copies only diagnostic metadata and opens a blank issue draft", async () => {
  const writeText = vi.fn(async () => undefined);
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    render(<FeedbackFactsContext.Provider value={{ workbench: "1.2.3", openspec: "C:/private/path", platform: "linux" }}>
      <SendFeedback cause="not-signed-in" />
    </FeedbackFactsContext.Provider>);
    fireEvent.click(screen.getByText("Preview diagnostics"));
    const preview = screen.getByLabelText("Diagnostic preview").textContent;
    expect(preview).toContain("Workbench: 1.2.3");
    expect(preview).toContain("OpenSpec CLI: unknown");
    expect(preview).toContain("Platform: linux");
    expect(preview).toContain("Failure category: not-signed-in");
    expect(screen.getByRole("link", { name: "Send Feedback" }).getAttribute("href"))
      .toBe("https://github.com/VeryComplexAndLongName/OpenSpec-UI/issues/new");
    fireEvent.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    expect(await screen.findByText("Diagnostics copied.")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(preview);
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
