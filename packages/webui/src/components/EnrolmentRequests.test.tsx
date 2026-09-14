import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EnrolmentRequest } from "@openspec-ui/core/browser";
import { EnrolmentRequests } from "./EnrolmentRequests.js";

const KEY_ID = "0123456789abcdef0123456789abcdef";

const REQUEST: EnrolmentRequest = {
  keyId: KEY_ID,
  publicKey: "MCowBQYDK2VwAyEA",
  label: "alpha",
  workingDirectory: "/wt/repo/alpha",
  machine: "ada-laptop",
  gitAuthor: "ada@example.com",
  seenAt: "2026-09-14T00:00:00.000Z",
};

describe("EnrolmentRequests (a-run-is-signed-by-its-person 5.2)", () => {
  it("shows each request's label, path, machine and git author, with one action that confirms it", () => {
    const onConfirm = vi.fn();
    render(<EnrolmentRequests requests={[REQUEST]} confirming={null} outcomes={{}} onConfirm={onConfirm} />);

    const row = screen.getByTestId(`enrolment-${KEY_ID}`);
    expect(row).toHaveTextContent("alpha — /wt/repo/alpha, on ada-laptop, git author ada@example.com, last seen");
    expect(screen.getAllByRole("button")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "It was me" }));
    expect(onConfirm).toHaveBeenCalledWith(KEY_ID);
  });

  it("says a confirmation is under way, allows no second one, and shows what it reported", () => {
    render(
      <EnrolmentRequests
        requests={[REQUEST]}
        confirming={KEY_ID}
        outcomes={{ [KEY_ID]: "Enrolled as Ada." }}
        onConfirm={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Enrolling..." })).toBeDisabled();
    expect(screen.getByTestId(`enrolment-outcome-${KEY_ID}`)).toHaveTextContent("Enrolled as Ada.");
  });

  it("draws nothing where no key waits", () => {
    const { container } = render(<EnrolmentRequests requests={[]} confirming={null} outcomes={{}} onConfirm={() => undefined} />);

    expect(container).toBeEmptyDOMElement();
  });
});
