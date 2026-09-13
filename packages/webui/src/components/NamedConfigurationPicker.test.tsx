import { fireEvent, render, screen } from "@testing-library/react";
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

function select(): HTMLSelectElement {
  return screen.getByLabelText("Named configuration") as HTMLSelectElement;
}

describe("NamedConfigurationPicker", () => {
  it("offers exactly the configurations its scope may write, in one list", () => {
    renderPicker({ scope: "global" });

    const offered = [...select().querySelectorAll("option")].map((option) => option.value);
    expect(offered).toEqual(templatesForScope("global").map((template) => template.id));
  });

  it("chooses the recommended configuration first, and marks it", () => {
    renderPicker({ recommendedId: "balanced" });

    expect(select()).toHaveValue("balanced");
    expect(select().querySelector("option[value='balanced']")?.textContent).toContain("(recommended)");
  });

  it("chooses the first configuration when nothing is recommended", () => {
    renderPicker();

    expect(select()).toHaveValue(templatesForScope("change")[0]!.id);
  });

  it("describes the chosen configuration, and changes the description with the choice", () => {
    renderPicker();
    const economy = templatesForScope("change").find((template) => template.id === "economy")!;

    fireEvent.change(select(), { target: { value: "economy" } });

    const description = screen.getByTestId("picker-named-configuration-description").textContent ?? "";
    expect(description).toContain(economy.intent);
    expect(description).toContain("Not for:");
    expect(description).toContain(economy.notFor);
  });

  it("applies nothing until Apply is pressed, then applies the chosen one", () => {
    const { onApply } = renderPicker();

    fireEvent.change(select(), { target: { value: "economy" } });
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ id: "economy" }));
  });

  it("says what applying did beside the button, and clears it when another is chosen", () => {
    const { rerender } = renderPicker();
    fireEvent.change(select(), { target: { value: "economy" } });
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

    fireEvent.change(select(), { target: { value: "thorough" } });
    expect(screen.queryByTestId("picker-named-configuration-status")).toBeNull();
  });

  it("describes the effort in the host's words where the host gives them", () => {
    renderPicker({ describeEffort: (template) => `${template.effortLevel} — codex-cli high` });

    expect(screen.getByTestId("picker-named-configuration-description").textContent).toContain("codex-cli high");
  });
});
