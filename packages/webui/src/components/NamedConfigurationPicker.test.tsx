import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { templatesForScope } from "@openspec-ui/core/browser";
import { NamedConfigurationPicker } from "./NamedConfigurationPicker.js";

// a-change-is-configured-from-the-change. The configurations used to be
// bordered titles followed by paragraphs, which read as text and filled a
// screen. One list, the chosen one's description beside it, one button.

function renderPicker(props: Partial<Parameters<typeof NamedConfigurationPicker>[0]> = {}) {
  const onApply = vi.fn();
  const view = render(
    <NamedConfigurationPicker
      scope="change"
      onApply={onApply}
      note="Applying one fills the fields below; nothing is saved until you save."
      testIdPrefix="picker"
      {...props}
    />,
  );
  return { onApply, ...view };
}

/** The configurations offered, as the radios of their group. */
function radios(): HTMLInputElement[] {
  return within(screen.getByRole("radiogroup", { name: "Named configuration" })).getAllByRole("radio") as HTMLInputElement[];
}

function choose(value: string): void {
  const radio = radios().find((candidate) => candidate.value === value);
  if (!radio) throw new Error(`no configuration ${value} is offered`);
  fireEvent.click(radio);
}

function chosen(): string | undefined {
  return radios().find((radio) => radio.checked)?.value;
}

describe("NamedConfigurationPicker", () => {
  it("offers exactly the configurations its scope may write, in one list", () => {
    renderPicker({ scope: "global" });

    const offered = radios().map((radio) => radio.value);
    expect(offered).toEqual(templatesForScope("global").map((template) => template.id));
  });

  it("chooses the recommended configuration first, and marks it", () => {
    renderPicker({ recommendedId: "balanced" });

    expect(chosen()).toBe("balanced");
    expect(radios().find((radio) => radio.value === "balanced")?.closest("label")?.textContent).toContain("(recommended)");
  });

  it("chooses the first configuration when nothing is recommended", () => {
    renderPicker();

    expect(chosen()).toBe(templatesForScope("change")[0]!.id);
  });

  it("describes the chosen configuration, and changes the description with the choice", () => {
    renderPicker();
    const economy = templatesForScope("change").find((template) => template.id === "economy")!;

    choose("economy");

    const description = screen.getByTestId("picker-named-configuration-description").textContent ?? "";
    expect(description).toContain(economy.intent);
    // What it is not for is a line of its own, not the end of the purpose.
    const notFor = screen.getByTestId("picker-named-configuration-not-for");
    expect(notFor.textContent).toMatch(/^Not for:/u);
    expect(notFor.textContent).toContain(economy.notFor);
    expect(notFor.previousElementSibling?.textContent).not.toContain("Not for:");
  });

  it("applies nothing until Apply is pressed, then applies the chosen one", () => {
    const { onApply } = renderPicker();

    choose("economy");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: "economy" }));
  });

  it("says what applying did beside the button, and clears it when another is chosen", () => {
    const { rerender } = renderPicker();
    choose("economy");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    rerender(
      <NamedConfigurationPicker
        scope="change"
        onApply={vi.fn()}
        note="n"
        testIdPrefix="picker"
        status="Filled from Economy."
      />,
    );
    expect(screen.getByTestId("picker-named-configuration-status").textContent).toContain("Filled from Economy.");

    choose("thorough");
    expect(screen.queryByTestId("picker-named-configuration-status")).toBeNull();
  });

  it("describes the effort in the host's words where the host gives them", () => {
    renderPicker({ describeEffort: (template) => `${template.effortLevel} — codex-cli high` });

    expect(screen.getByTestId("picker-named-configuration-description").textContent).toContain("codex-cli high");
  });
});
