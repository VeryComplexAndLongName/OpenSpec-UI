import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FailureDiagnosisNote } from "./FailureDiagnosisNote.js";

// the-supervisor-advises 4.1
describe("FailureDiagnosisNote", () => {
  it("shows the cause, what was printed, the remedy and its command as text", () => {
    render(<FailureDiagnosisNote diagnosis={{
      cause: "not-signed-in",
      repeatHelps: "no",
      evidence: "Error: Authentication required",
      remedy: "Run `copilot` in a terminal and sign in, then start the run again.",
      commands: ["copilot"],
    }} />);

    const note = screen.getByTestId("failure-diagnosis");
    expect(note.textContent).toContain("the agent is not signed in: repeating will not help");
    expect(note.textContent).toContain("Error: Authentication required");
    expect(note.textContent).toContain("sign in, then start the run again");
    expect(note.querySelector("pre")?.textContent).toBe("copilot");
    // A suggestion that acts is no longer one: no control runs the command.
    expect(note.querySelector("button")).toBeNull();
  });

  it("shows nothing for an unknown cause or no diagnosis", () => {
    const { container: unknown } = render(<FailureDiagnosisNote diagnosis={{ cause: "unknown", repeatHelps: "unknown" }} />);
    const { container: none } = render(<FailureDiagnosisNote diagnosis={undefined} />);
    expect(unknown.innerHTML).toBe("");
    expect(none.innerHTML).toBe("");
  });
});
