import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BusyFieldset } from "./BusyFieldset.js";

function Controls({ busy }: { busy: boolean }) {
  return (
    <BusyFieldset busy={busy}>
      <select aria-label="Change"><option>alpha</option></select>
      <button type="button">Refresh</button>
    </BusyFieldset>
  );
}

// a-screen-says-what-it-is-doing 3.6
describe("BusyFieldset", () => {
  it("holds every control inside it while busy, and gives them back after", () => {
    const { rerender } = render(<Controls busy />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Change" })).toBeDisabled();
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");

    rerender(<Controls busy={false} />);

    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Change" })).toBeEnabled();
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "false");
  });
});
